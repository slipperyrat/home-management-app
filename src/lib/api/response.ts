import { NextResponse } from 'next/server';

// Standard API response types
export interface ApiResponse<T = any> {
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

// Helper functions for creating consistent API responses
export const apiResponse = {
  // Success responses
  success: <T>(data: T, message?: string, code: number = 200): NextResponse<ApiResponse<T>> => {
    const response: ApiResponse<T> = {
      success: true,
      data,
      code,
      timestamp: new Date().toISOString()
    };
    
    if (message) {
      response.message = message;
    }
    
    return NextResponse.json(response, { status: code });
  },

  // Error responses
  error: (message: string, code: number = 400, error?: string): NextResponse<ApiResponse> => {
    const response: ApiResponse = {
      success: false,
      error: error || message,
      message,
      code,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(response, { status: code });
  },

  // Specific error types
  badRequest: (message: string, error?: string) => 
    apiResponse.error(message, 400, error),
  
  unauthorized: (message: string = 'Unauthorized', error?: string) => 
    apiResponse.error(message, 401, error),
  
  forbidden: (message: string = 'Forbidden', error?: string) => 
    apiResponse.error(message, 403, error),
  
  notFound: (message: string = 'Not Found', error?: string) => 
    apiResponse.error(message, 404, error),
  
  conflict: (message: string, error?: string) => 
    apiResponse.error(message, 409, error),
  
  tooManyRequests: (message: string = 'Too Many Requests', error?: string) => 
    apiResponse.error(message, 429, error),
  
  internalError: (message: string = 'Internal Server Error', error?: string) => 
    apiResponse.error(message, 500, error),
  
  serviceUnavailable: (message: string = 'Service Unavailable', error?: string) => 
    apiResponse.error(message, 503, error)
};

// Pagination helper
export const createPaginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
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
      hasPrev: page > 1
    }
  };
  
  if (message) {
    response.message = message;
  }
  
  return NextResponse.json(response);
};

// Validation error response helper
export const createValidationErrorResponse = (errors: string[]): NextResponse<ApiResponse> => {
  return apiResponse.badRequest(
    'Validation failed',
    errors.join('; ')
  );
};

// Database error response helper
export const createDatabaseErrorResponse = (error: unknown): NextResponse<ApiResponse> => {
  console.error('Database error:', error);
  
  // Don't expose internal database errors to clients
  return apiResponse.internalError(
    'Database operation failed',
    'Database error occurred'
  );
};

// Rate limit error response helper
export const createRateLimitResponse = (retryAfter: number = 10): NextResponse<ApiResponse> => {
  const response = apiResponse.tooManyRequests(
    'Rate limit exceeded',
    'Too many requests'
  );
  
  response.headers.set('Retry-After', retryAfter.toString());
  response.headers.set('X-RateLimit-Limit', '60');
  response.headers.set('X-RateLimit-Remaining', '0');
  
  return response;
};

// Cache headers helper
export const setCacheHeaders = (
  response: NextResponse, 
  maxAge: number = 300, 
  staleWhileRevalidate?: number
): NextResponse => {
  const cacheControl = staleWhileRevalidate 
    ? `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
    : `public, s-maxage=${maxAge}`;
    
  response.headers.set('Cache-Control', cacheControl);
  response.headers.set('Vary', 'Authorization');
  
  return response;
};

// No-cache headers helper
export const setNoCacheHeaders = (response: NextResponse): NextResponse => {
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
};
