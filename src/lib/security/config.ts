// Centralized security configuration
export const securityConfig = {
  // Security headers for all responses
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-DNS-Prefetch-Control': 'on',
  },

  // Content Security Policy for different contexts
  csp: {
    // Default CSP for most pages
    default: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://clerk.com https://*.clerk.accounts.dev https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://clerk.com https://*.clerk.accounts.dev https://va.vercel-scripts.com https://clerk-telemetry.com; frame-src https://clerk.com https://*.clerk.accounts.dev; worker-src 'self' blob:; manifest-src 'self';",
    
    // Strict CSP for API routes
    api: "default-src 'self'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'self' https://*.supabase.co; frame-src 'none'; worker-src 'none';",
    
    // Relaxed CSP for development
    development: "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://clerk.com https://*.clerk.accounts.dev; frame-src https://clerk.com https://*.clerk.accounts.dev; worker-src 'self' blob:; manifest-src 'self';"
  },

  // Rate limiting configuration
  rateLimit: {
    default: {
      limit: 60,
      windowMs: 10_000, // 10 seconds
      maxSize: 1000
    },
    strict: {
      limit: 30,
      windowMs: 10_000,
      maxSize: 500
    },
    api: {
      limit: 100,
      windowMs: 60_000, // 1 minute
      maxSize: 2000
    }
  },

  // Allowed origins for CSRF protection
  allowedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL,
    'https://home-management-app-two.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001'
  ].filter(Boolean),

  // Cache configuration
  cache: {
    onboarding: {
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000
    }
  }
};

// Helper function to get CSP based on environment and route
export function getCSP(route: string, isDevelopment: boolean = false): string {
  if (isDevelopment) {
    return securityConfig.csp.development;
  }
  
  if (route.startsWith('/api/')) {
    return securityConfig.csp.api;
  }
  
  return securityConfig.csp.default;
}

// Helper function to apply security headers to response
export function applySecurityHeaders(
  response: Response, 
  route: string, 
  isDevelopment: boolean = false
): Response {
  const headers = new Headers(response.headers);
  
  // Apply base security headers
  Object.entries(securityConfig.headers).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  // Apply CSP
  headers.set('Content-Security-Policy', getCSP(route, isDevelopment));
  
  // Create new response with security headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
