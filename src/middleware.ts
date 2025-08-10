import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const buckets = new Map<string, { ts: number[] }>();

// Create Supabase admin client for onboarding checks - with error handling
let supabaseAdmin: any = null;
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
} catch (error) {
  console.error('Failed to create Supabase admin client in middleware:', error);
}

// Cache for onboarding status to reduce database calls
const onboardingCache = new Map<string, { hasOnboarded: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of onboardingCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      onboardingCache.delete(key);
    }
  }
  
  // If cache is still too large, remove oldest entries
  if (onboardingCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(onboardingCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => onboardingCache.delete(key));
  }
}, 10 * 60 * 1000); // Clean every 10 minutes

// Function to clear cache for a specific user (can be called after onboarding completion)
export function clearOnboardingCache(userId: string) {
  onboardingCache.delete(userId);
}

async function checkOnboardingStatus(userId: string): Promise<boolean> {
  // Check cache first
  const cached = onboardingCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.hasOnboarded;
  }

  // If Supabase client is not available, skip the check
  if (!supabaseAdmin) {
    console.warn('Supabase admin client not available in middleware, skipping onboarding check');
    return true; // Allow access to avoid blocking the app
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('has_onboarded')
      .eq('clerk_id', userId)
      .single();

    if (error || !data) {
      // If user doesn't exist or error occurs, assume they need onboarding
      return false;
    }

    const hasOnboarded = data.has_onboarded || false;
    
    // Cache the result
    onboardingCache.set(userId, {
      hasOnboarded,
      timestamp: Date.now()
    });

    return hasOnboarded;
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    // On error, assume they need onboarding to be safe
    return false;
  }
}

function allow(key: string, limit = 60, windowMs = 10_000) {
  const now = Date.now();
  const b = buckets.get(key) ?? { ts: [] };
  // drop old
  b.ts = b.ts.filter(t => now - t < windowMs);
  if (b.ts.length >= limit) return false;
  b.ts.push(now);
  buckets.set(key, b);
  return true;
}

export default clerkMiddleware(async (auth, req) => {
  const url = new URL(req.url);
  
  // Create response to add security headers
  const response = NextResponse.next();
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add CSP for non-API routes
  if (!url.pathname.startsWith("/api/")) {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://clerk.com https://*.clerk.accounts.dev https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://clerk.com https://*.clerk.accounts.dev https://va.vercel-scripts.com https://clerk-telemetry.com; frame-src https://clerk.com https://*.clerk.accounts.dev; worker-src 'self' blob:; manifest-src 'self';"
    );
  }

  // Get user authentication info
  const { userId } = await auth();
  
  // Skip onboarding check for specific routes
  const skipOnboardingCheck = 
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/dev/') ||
    url.pathname === '/onboarding' ||
    url.pathname.startsWith('/onboarding/') ||
    url.pathname.startsWith('/sign-in') ||
    url.pathname.startsWith('/sign-up') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/favicon') ||
    url.pathname.includes('.') ||  // Static files
    url.pathname === '/' ||  // Allow home page access
    url.pathname.startsWith('/user-button')  // Clerk user button routes
  
  // Check onboarding status for signed-in users on app routes
  if (userId && !skipOnboardingCheck) {
    try {
      const hasOnboarded = await checkOnboardingStatus(userId);
      
      if (!hasOnboarded) {
        console.log(`Redirecting user ${userId} to onboarding from ${url.pathname}`);
        return NextResponse.redirect(new URL('/onboarding', req.url));
      }
    } catch (error) {
      console.error('Error in onboarding check middleware:', error);
      // Continue without redirect on error to avoid blocking the app
    }
  }
  
  if (url.pathname.startsWith("/api/")) {
    // CSRF Protection for mutating requests
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (mutatingMethods.includes(req.method)) {
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_APP_URL,
        'https://home-management-app-two.vercel.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001'
      ].filter(Boolean); // Remove undefined values

      let origin = req.headers.get('origin');
      
      // If no origin header, try to extract from referer
      if (!origin) {
        const referer = req.headers.get('referer');
        if (referer) {
          try {
            origin = new URL(referer).origin;
          } catch {
            // Invalid referer URL, keep origin as null
          }
        }
      }

      // If origin is present and not in allowed list, block the request
      if (origin && !allowedOrigins.includes(origin)) {
        return new Response(JSON.stringify({ error: "CSRF: invalid origin" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // Rate Limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { userId } = await auth();
    const key = userId ? `u:${userId}` : `ip:${ip}`;
    if (!allow(key)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "10" },
      });
    }
  }
  
  return response;
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}; 