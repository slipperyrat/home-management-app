import { NextResponse, type NextRequest } from 'next/server';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';
import { sanitizeDeep, SanitizePolicy } from '@/lib/security/sanitize';
import { ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

// Standard API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string | undefined;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Define a type for the handler function
type ApiHandler<T> = (
  request: NextRequest,
  context: { params: Record<string, string>, body: T }
) => Promise<NextResponse>;

/**
 * A higher-order function to sanitize and validate the request body.
 * It automatically parses JSON, sanitizes it based on a Zod schema and optional policy,
 * and handles validation errors.
 *
 * @param schema The Zod schema to validate the request body against.
 * @param handler The actual API route handler function.
 * @param policy Optional sanitization policy for sanitizeDeep.
 * @returns A new handler function that includes sanitization and validation.
 */
export function withSanitizedBody<T extends z.ZodSchema>(
  schema: T,
  handler: ApiHandler<z.infer<T>>,
  policy?: SanitizePolicy
) {
  return async (request: NextRequest, context: { params: Record<string, string> }) => {
    try {
      const rawBody = await request.json();
      
      // Sanitize the raw body first
      const sanitizedBody = policy ? sanitizeDeep(rawBody, policy) : sanitizeDeep(rawBody);

      // Validate the sanitized body
      const validationResult = schema.safeParse(sanitizedBody);

      if (!validationResult.success) {
        return createValidationErrorResponse(
          validationResult.error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        );
      }

      // Pass the validated and sanitized data to the original handler
      return handler(request, { ...context, body: validationResult.data });

    } catch (error) {
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return createErrorResponse(new ServerError('Invalid JSON body', 400));
      }
      return createErrorResponse(error instanceof ServerError ? error : new ServerError('Internal server error'));
    }
  };
}

// Helper functions for creating consistent API responses
export function createSuccessResponse<T>(data: T, message?: string, status: number = 200): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };
  
  return NextResponse.json(response, { status });
}

export function createApiErrorResponse(error: string, status: number = 400): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error,
  };
  
  return NextResponse.json(response, { status });
}

export function createValidationErrorResponse(error: string): NextResponse<ApiResponse> {
  return createApiErrorResponse(`Validation Error: ${error}`, 400);
}

export function createUnauthorizedResponse(message: string = 'Unauthorized'): NextResponse<ApiResponse> {
  return createApiErrorResponse(message, 401);
}

export function createForbiddenResponse(message: string = 'Forbidden'): NextResponse<ApiResponse> {
  return createApiErrorResponse(message, 403);
}

export function createNotFoundResponse(message: string = 'Not Found'): NextResponse<ApiResponse> {
  return createApiErrorResponse(message, 404);
}

export function createInternalErrorResponse(message: string = 'Internal Server Error'): NextResponse<ApiResponse> {
  return createApiErrorResponse(message, 500);
}

export function createTooManyRequestsResponse(message: string = 'Too Many Requests'): NextResponse<ApiResponse> {
  return createApiErrorResponse(message, 429);
}

// Helper for pagination
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): NextResponse<PaginatedResponse<T>> {
  const totalPages = Math.ceil(total / limit);
  
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    message,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
  
  return NextResponse.json(response);
}

// Helper for setting cache headers
export function setCacheHeaders(response: NextResponse, maxAge: number = 300, staleWhileRevalidate?: number): NextResponse {
  const cacheControl = staleWhileRevalidate 
    ? `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
    : `public, s-maxage=${maxAge}`;
    
  response.headers.set('Cache-Control', cacheControl);
  response.headers.set('Vary', 'Authorization');
  
  return response;
}

// Helper for setting no-cache headers
export function setNoCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

// Helper for validation with Zod
export function validateWithZod<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError && error.issues) {
      const errorMessage = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return { success: false, error: errorMessage };
    }
    return { success: false, error: 'Validation failed' };
  }
}

// Helper for handling async operations with proper error handling
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string = 'Operation failed'
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    logger.error(errorMessage, error as Error);
    const message = error instanceof Error ? error.message : errorMessage;
    return { success: false, error: message };
  }
}

interface ParsedBody<T> {
  success: true;
  data: T;
}
interface ParsedBodyError {
  success: false;
  error: string;
}

type ParsedBodyResult<T> = ParsedBody<T> | ParsedBodyError;

export async function parseJsonBody<T>(request: NextRequest): Promise<ParsedBodyResult<T>> {
  try {
    const json = await request.json();
    return { success: true, data: json as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON payload',
    };
  }
}

export function getQueryParam(request: NextRequest, key: string): string | null {
  return request.nextUrl.searchParams.get(key);
}

export function getRequiredQueryParam(request: NextRequest, key: string): string {
  const value = getQueryParam(request, key);

  if (!value) {
    throw new Error(`Missing query parameter: ${key}`);
  }

  return value;
}
