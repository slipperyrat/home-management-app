import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { securityConfig } from '@/lib/security/config';

// Improved rate limiting with better memory management
class RateLimiter {
  private buckets = new Map<string, { ts: number[]; count: number }>();
  private readonly maxSize = securityConfig.rateLimit.default.maxSize;
  
  allow(key: string, limit = securityConfig.rateLimit.default.limit, windowMs = securityConfig.rateLimit.default.windowMs): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    
    if (!bucket) {
      this.buckets.set(key, { ts: [now], count: 1 });
      this.cleanup();
      return true;
    }
    
    // Remove old timestamps outside the window
    bucket.ts = bucket.ts.filter(t => now - t < windowMs);
    
    if (bucket.ts.length >= limit) {
      return false;
    }
    
    bucket.ts.push(now);
    bucket.count++;
    return true;
  }
  
  private cleanup(): void {
    if (this.buckets.size <= this.maxSize) return;
    
    // Remove oldest entries when we exceed max size
    const entries = Array.from(this.buckets.entries());
    entries.sort((a, b) => a[1].count - b[1].count);
    
    const toRemove = entries.slice(0, entries.length - this.maxSize);
    toRemove.forEach(([key]) => this.buckets.delete(key));
  }
}

const rateLimiter = new RateLimiter();

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

// Improved cache for onboarding status with better memory management
class OnboardingCache {
  private cache = new Map<string, { hasOnboarded: boolean; timestamp: number }>();
  private readonly maxSize = securityConfig.cache.onboarding.maxSize;
  private readonly ttl = securityConfig.cache.onboarding.ttl;
  
  get(userId: string): { hasOnboarded: boolean; timestamp: number } | undefined {
    const entry = this.cache.get(userId);
    if (!entry) return undefined;
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(userId);
      return undefined;
    }
    
    return entry;
  }
  
  set(userId: string, hasOnboarded: boolean): void {
    this.cache.set(userId, {
      hasOnboarded,
      timestamp: Date.now()
    });
    
    // Cleanup if cache is too large
    if (this.cache.size > this.maxSize) {
      this.cleanup();
    }
  }
  
  delete(userId: string): void {
    this.cache.delete(userId);
  }
  
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Remove expired entries
    entries.forEach(([key, value]) => {
      if (now - value.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    });
    
    // If still too large, remove oldest entries
    if (this.cache.size > this.maxSize) {
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, entries.length - this.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }
}

const onboardingCache = new OnboardingCache();

// Function to clear cache for a specific user (can be called after onboarding completion)
export function clearOnboardingCache(userId: string) {
  onboardingCache.delete(userId);
}

async function checkOnboardingStatus(userId: string): Promise<boolean> {
  // Check cache first
  const cached = onboardingCache.get(userId);
  if (cached) {
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
      console.log(`Middleware: User ${userId} not found or error:`, error);
      return false;
    }

    const hasOnboarded = data.has_onboarded || false;
    console.log(`Middleware: User ${userId} has_onboarded: ${hasOnboarded}`);
    
    // Cache the result
    onboardingCache.set(userId, hasOnboarded);

    return hasOnboarded;
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    // On error, assume they need onboarding to be safe
    return false;
  }
}

export default clerkMiddleware(async (auth, req) => {
  const url = new URL(req.url);
  
  // Create response to add security headers
  const response = NextResponse.next();
  
  // Add security headers using centralized config
  Object.entries(securityConfig.headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Add CSP for non-API routes
  if (!url.pathname.startsWith("/api/")) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const csp = isDevelopment ? securityConfig.csp.development : securityConfig.csp.default;
    response.headers.set('Content-Security-Policy', csp);
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
    url.pathname === '/dashboard' ||  // Allow dashboard access (users can complete onboarding from there)
    url.pathname === '/inbox' ||  // Allow inbox access (users can complete onboarding from there)
    url.pathname.startsWith('/user-button')  // Clerk user button routes
  
  // Check onboarding status for signed-in users on app routes
  // Note: Dashboard and Inbox are excluded from this check so users can access them and complete onboarding from there
  if (userId && !skipOnboardingCheck) {
    try {
      // Check if user is forcing a cache refresh
      const forceRefresh = url.searchParams.get('refresh-onboarding') === 'true';
      if (forceRefresh) {
        console.log(`Forcing cache refresh for user ${userId}`);
        onboardingCache.delete(userId);
      }
      
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
      const allowedOrigins = securityConfig.allowedOrigins;

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

    // Rate Limiting with improved logic
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = userId ? `u:${userId}` : `ip:${ip}`;
    
    if (!rateLimiter.allow(key)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { 
          "content-type": "application/json", 
          "retry-after": "10",
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0"
        },
      });
    }
  }
  
  return response;
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}; 