import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitizeDeep, SanitizePolicy } from '@/lib/security/sanitize';
import { createValidationErrorResponse } from '@/lib/validation';
import { ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

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

/**
 * Helper to create standardized error responses
 */
export function createApiError(message: string, status: number = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * Helper to create standardized success responses
 */
export function createApiSuccess<T>(data: T, status: number = 200) {
  return Response.json({ success: true, ...data }, { status });
}
