import { NextResponse } from 'next/server';
import { logger } from '@/lib/logging/logger';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: number;
  timestamp?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const apiResponse = {
  success: <T>(data: T, message?: string, code = 200): NextResponse<ApiResponse<T>> => {
    const response: ApiResponse<T> = {
      success: true,
      data,
      code,
      timestamp: new Date().toISOString(),
    };

    if (message) {
      response.message = message;
    }

    return NextResponse.json(response, { status: code });
  },

  error: (message: string, code = 400, error?: string): NextResponse<ApiResponse> => {
    const response: ApiResponse = {
      success: false,
      error: error ?? message,
      message,
      code,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: code });
  },

  badRequest: (message: string, error?: string) => apiResponse.error(message, 400, error),
  unauthorized: (message = 'Unauthorized', error?: string) => apiResponse.error(message, 401, error),
  forbidden: (message = 'Forbidden', error?: string) => apiResponse.error(message, 403, error),
  notFound: (message = 'Not Found', error?: string) => apiResponse.error(message, 404, error),
  conflict: (message: string, error?: string) => apiResponse.error(message, 409, error),
  tooManyRequests: (message = 'Too Many Requests', error?: string) => apiResponse.error(message, 429, error),
  internalError: (message = 'Internal Server Error', error?: string) => apiResponse.error(message, 500, error),
  serviceUnavailable: (message = 'Service Unavailable', error?: string) => apiResponse.error(message, 503, error),
};

export const createPaginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string,
): NextResponse<PaginatedResponse<T>> => {
  const totalPages = Math.ceil(total / limit);

  const response: PaginatedResponse<T> = {
    success: true,
    data,
    code: 200,
    timestamp: new Date().toISOString(),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };

  if (message) {
    response.message = message;
  }

  return NextResponse.json(response);
};

type ValidationError = string | { path?: unknown; message: string; code?: string };

export const createValidationErrorResponse = (errors: ValidationError[]): NextResponse<ApiResponse> => {
  const message = errors
    .map((err) => (typeof err === 'string' ? err : err.message))
    .filter(Boolean)
    .join('; ');

  return apiResponse.badRequest('Validation failed', message || 'Validation errors occurred');
};

export const createDatabaseErrorResponse = (error: unknown): NextResponse<ApiResponse> => {
  logger.error('Database operation failed', error instanceof Error ? error : new Error(String(error)));

  return apiResponse.internalError('Database operation failed', 'Database error occurred');
};

export const createRateLimitResponse = (retryAfter = 10): NextResponse<ApiResponse> => {
  const response = apiResponse.tooManyRequests('Rate limit exceeded', 'Too many requests');

  response.headers.set('Retry-After', retryAfter.toString());
  response.headers.set('X-RateLimit-Limit', '60');
  response.headers.set('X-RateLimit-Remaining', '0');

  return response;
};

export const setCacheHeaders = (
  response: NextResponse,
  maxAge = 300,
  staleWhileRevalidate?: number,
): NextResponse => {
  const cacheControl = staleWhileRevalidate
    ? `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
    : `public, s-maxage=${maxAge}`;

  response.headers.set('Cache-Control', cacheControl);
  response.headers.set('Vary', 'Authorization');

  return response;
};

export const setNoCacheHeaders = (response: NextResponse): NextResponse => {
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
};
