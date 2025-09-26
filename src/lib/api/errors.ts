// Standardized Error Handling Helper
// Provides consistent error responses across all API routes

import { NextResponse } from 'next/server';
import { ServerError } from '@/lib/server/supabaseAdmin';
import { logger } from '@/lib/logging/logger';

export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

/**
 * Create standardized error response
 * @param error - Error object or message
 * @param status - HTTP status code
 * @param details - Additional error details
 * @returns NextResponse with error
 */
export function createErrorResponse(
  error: Error | string | ServerError,
  status: number = 500,
  details?: any
): NextResponse<ErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : error;
  const timestamp = new Date().toISOString();
  const requestId = generateRequestId();

  // Log error for monitoring
  logger.error('API Error', error instanceof Error ? error : new Error(errorMessage), {
    status,
    details,
    requestId,
    timestamp
  });

  const response: ErrorResponse = {
    success: false,
    error: errorMessage,
    timestamp,
    requestId
  };

  if (details) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Create validation error response
 * @param validationErrors - Zod validation errors
 * @returns NextResponse with validation error
 */
export function createValidationErrorResponse(validationErrors: any[]): NextResponse<ErrorResponse> {
  return createErrorResponse(
    'Validation failed',
    400,
    {
      type: 'validation_error',
      errors: validationErrors
    }
  );
}

/**
 * Create authentication error response
 * @param message - Error message
 * @returns NextResponse with auth error
 */
export function createAuthErrorResponse(message: string = 'Unauthorized'): NextResponse<ErrorResponse> {
  return createErrorResponse(message, 401);
}

/**
 * Create authorization error response
 * @param message - Error message
 * @returns NextResponse with auth error
 */
export function createAuthorizationErrorResponse(message: string = 'Forbidden'): NextResponse<ErrorResponse> {
  return createErrorResponse(message, 403);
}

/**
 * Create not found error response
 * @param resource - Resource that was not found
 * @returns NextResponse with not found error
 */
export function createNotFoundErrorResponse(resource: string = 'Resource'): NextResponse<ErrorResponse> {
  return createErrorResponse(`${resource} not found`, 404);
}

/**
 * Create rate limit error response
 * @param retryAfter - Seconds to wait before retrying
 * @returns NextResponse with rate limit error
 */
export function createRateLimitErrorResponse(retryAfter: number): NextResponse<ErrorResponse> {
  const response = createErrorResponse(
    'Rate limit exceeded',
    429,
    {
      type: 'rate_limit_error',
      retryAfter
    }
  );

  response.headers.set('Retry-After', retryAfter.toString());
  return response;
}

/**
 * Create server error response
 * @param message - Error message
 * @param details - Additional details
 * @returns NextResponse with server error
 */
export function createServerErrorResponse(
  message: string = 'Internal server error',
  details?: any
): NextResponse<ErrorResponse> {
  return createErrorResponse(message, 500, details);
}

/**
 * Handle API route errors consistently
 * @param error - Caught error
 * @param context - Error context for logging
 * @returns NextResponse with error
 */
export function handleApiError(
  error: unknown,
  context: { route: string; method: string; userId?: string }
): NextResponse<ErrorResponse> {
  if (error instanceof ServerError) {
    return createErrorResponse(error.message, error.status);
  }

  if (error instanceof Error) {
    logger.error(`API Error in ${context.method} ${context.route}`, error, {
      userId: context.userId,
      route: context.route,
      method: context.method
    });
    
    return createServerErrorResponse(error.message);
  }

  logger.error(`Unknown error in ${context.method} ${context.route}`, new Error('Unknown error'), {
    userId: context.userId,
    route: context.route,
    method: context.method,
    error
  });

  return createServerErrorResponse('An unexpected error occurred');
}

/**
 * Generate unique request ID for tracking
 * @returns Request ID string
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Success response helper
 * @param data - Response data
 * @param message - Success message
 * @param status - HTTP status code
 * @returns NextResponse with success
 */
export function createSuccessResponse<T>(
  data: T,
  message: string = 'Success',
  status: number = 200
): NextResponse<{ success: true; data: T; message: string; timestamp: string }> {
  return NextResponse.json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  }, { status });
}
