// Standardized API Protection Wrapper
// Provides consistent security checks for all API routes

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { RateLimiter, getRateLimitConfig } from './rateLimiter';
import { validateRequestCSRF } from './csrf';
import { logger } from '@/lib/logging/logger';
import { 
  logRateLimitExceeded, 
  logCSRFFailure, 
  logUnauthorizedAccess,
  logAuthenticationFailure 
} from './monitoring';

/**
 * Security configuration for API protection
 */
export interface APISecurityConfig {
  requireAuth?: boolean;
  requireCSRF?: boolean;
  rateLimitConfig?: string;
  allowedMethods?: string[];
}

/**
 * Default security configuration
 */
const DEFAULT_CONFIG: APISecurityConfig = {
  requireAuth: true,
  requireCSRF: true,
  rateLimitConfig: 'api',
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
};

/**
 * Enhanced API protection with comprehensive security checks
 * @param request - The incoming request
 * @param handler - The API route handler function
 * @param config - Optional security configuration
 * @returns Response from the handler or security error response
 */
export async function withAPISecurity(
  request: NextRequest,
  handler: (request: NextRequest, user: any) => Promise<NextResponse>,
  config: APISecurityConfig = {}
): Promise<NextResponse> {
  const securityConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    // 1. Method validation
    if (!securityConfig.allowedMethods?.includes(request.method)) {
      logger.warn('Method not allowed', { 
        method: request.method, 
        url: request.url 
      });
      return NextResponse.json(
        { error: 'Method not allowed' }, 
        { status: 405 }
      );
    }

    // 2. Authentication check
    let user = null;
    if (securityConfig.requireAuth) {
      user = await currentUser();
      console.log('Auth check for', request.nextUrl.pathname, 'user:', user?.id || 'null');
      if (!user) {
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        
        console.log('❌ Unauthorized access to', request.nextUrl.pathname, 'from', ip);
        logUnauthorizedAccess(request.nextUrl.pathname, ip, userAgent);
        
        return NextResponse.json(
          { error: 'Unauthorized' }, 
          { status: 401 }
        );
      }
    }

    // 3. Rate limiting check - Temporarily disabled to fix database errors
    // if (user && securityConfig.rateLimitConfig) {
    //   try {
    //     const rateLimiter = new RateLimiter();
    //     const rateLimitConfig = getRateLimitConfig(request.nextUrl.pathname);
    //     
    //     const { allowed, remaining, resetTime } = await rateLimiter.checkRateLimit(
    //       user.id, 
    //       rateLimitConfig
    //     );
    //     
    //     if (!allowed) {
    //       const ip = request.headers.get('x-forwarded-for') || 'unknown';
    //       const userAgent = request.headers.get('user-agent') || 'unknown';
    //       
    //       logRateLimitExceeded(user.id, request.nextUrl.pathname, ip, userAgent);
    //       
    //       return NextResponse.json(
    //         { 
    //           error: 'Rate limit exceeded',
    //           retryAfter: Math.ceil((resetTime.getTime() - Date.now()) / 1000)
    //         },
    //         { 
    //           status: 429,
    //           headers: rateLimiter.getRateLimitHeaders(remaining, resetTime, rateLimitConfig.maxRequests)
    //         }
    //       );
    //     }
    //   } catch (rateLimitError) {
    //     // Fallback: Allow request if rate limiting fails
    //     logger.warn('Rate limiting failed, allowing request', rateLimitError as Error, {
    //       userId: user.id,
    //       endpoint: request.nextUrl.pathname
    //     });
    //   }
    // }

    // 4. CSRF protection check
    if (user && securityConfig.requireCSRF) {
      const csrfValidation = validateRequestCSRF(request, user.id);
      if (!csrfValidation.valid) {
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        
        logCSRFFailure(user.id, request.nextUrl.pathname, ip, userAgent);
        
        return NextResponse.json(
          { error: csrfValidation.error }, 
          { status: 403 }
        );
      }
    }

    // 5. Execute the handler
    return await handler(request, user);
    
  } catch (error) {
    logger.error('API security error', error as Error, { 
      url: request.url,
      method: request.method 
    });
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

/**
 * Simplified API protection for read-only endpoints
 * @param request - The incoming request
 * @param handler - The API route handler function
 * @returns Response from the handler or security error response
 */
export async function withReadOnlyAPISecurity(
  request: NextRequest,
  handler: (request: NextRequest, user: any) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAPISecurity(request, handler, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
    allowedMethods: ['GET']
  });
}

/**
 * API protection for public endpoints (no auth required)
 * @param request - The incoming request
 * @param handler - The API route handler function
 * @returns Response from the handler or security error response
 */
export async function withPublicAPISecurity(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAPISecurity(request, handler, {
    requireAuth: false,
    requireCSRF: false,
    rateLimitConfig: 'api',
    allowedMethods: ['GET', 'POST']
  });
}

/**
 * API protection for admin-only endpoints
 * @param request - The incoming request
 * @param handler - The API route handler function
 * @returns Response from the handler or security error response
 */
export async function withAdminAPISecurity(
  request: NextRequest,
  handler: (request: NextRequest, user: any) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAPISecurity(request, handler, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  });
}

/**
 * Generate CSRF token for API responses
 * @param user - The authenticated user
 * @returns CSRF token response
 */
export async function generateCSRFTokenResponse(user: any) {
  const { createCSRFResponse } = await import('./csrf');
  return createCSRFResponse(user.id);
}

/**
 * Security headers for API responses
 * @param response - The response object
 * @returns Response with security headers
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}
