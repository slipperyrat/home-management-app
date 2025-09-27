import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserHouseholdId, getUserOnboardingStatus } from "@/lib/api/database";

export default clerkMiddleware(async (auth, req) => {
  const url = new URL(req.url);
  
  // Create response to add security headers
  const response = NextResponse.next();
  
  // Add comprehensive security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy - Re-enabled with proper Clerk domains
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://*.supabase.co https://*.vercel.com; " +
    "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );
  
  // Add HSTS header for all requests (will be ignored on HTTP)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Get user authentication info - this is crucial for Clerk to work
  const { userId } = await auth();
  
  // Skip onboarding check for specific routes
  const staticAssetPattern = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|json|map)$/i;
  const skipOnboardingCheck = 
    url.pathname.startsWith('/dev/') ||
    url.pathname === '/onboarding' ||
    url.pathname.startsWith('/onboarding/') ||
    url.pathname.startsWith('/sign-in') ||
    url.pathname.startsWith('/sign-up') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname === '/favicon.ico' ||
    staticAssetPattern.test(url.pathname) ||
    url.pathname === '/' ||
    url.pathname.startsWith('/user-button');

  // Protected routes that require authentication
  const protectedRoutes = [
    '/dashboard',
    '/shopping-lists',
    '/chores',
    '/bills',
    '/meal-planner',
    '/recipes',
    '/rewards',
    '/calendar',
    '/inbox'
  ];

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    url.pathname === route || url.pathname.startsWith(route + '/')
  );

  // Skip API routes from redirect logic - let them handle auth themselves
  if (url.pathname.startsWith('/api/')) {
    return response;
  }

  // Redirect to sign-in if accessing protected route without authentication
  if (isProtectedRoute && !userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }
  
  // Check onboarding status for signed-in users on app routes (but NOT API routes)
  if (userId && !skipOnboardingCheck) {
    try {
      const [hasHousehold, hasOnboarded] = await Promise.all([
        getUserHouseholdId(userId),
        getUserOnboardingStatus(userId)
      ]);

      if ((!hasHousehold || !hasOnboarded) && !url.pathname.startsWith('/onboarding')) {
        const onboardingUrl = new URL('/onboarding', req.url);
        onboardingUrl.searchParams.set('redirect', url.pathname);
        return NextResponse.redirect(onboardingUrl);
      }
    } catch (error) {
      console.error('Error in onboarding check middleware:', error);
    }
  }
  
  return response;
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/",
    "/(api|trpc)(.*)"
  ],
}; 