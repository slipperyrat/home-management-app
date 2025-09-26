// CSRF Protection Utilities
// Implements token-based CSRF protection for state-changing operations

import { createHash, randomBytes } from 'crypto';

/**
 * Generate a secure CSRF token
 * @param userId - The user ID to associate with the token
 * @returns A secure CSRF token
 */
export function generateCSRFToken(userId: string): string {
  const randomToken = randomBytes(32).toString('hex');
  const timestamp = Date.now().toString();
  const data = `${userId}:${randomToken}:${timestamp}`;
  
  // Create a hash of the data with a secret
  const secret = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';
  const hash = createHash('sha256').update(data + secret).digest('hex');
  
  // Return the token with hash for validation
  return `${data}:${hash}`;
}

/**
 * Validate a CSRF token
 * @param token - The CSRF token to validate
 * @param userId - The user ID to validate against
 * @returns True if the token is valid, false otherwise
 */
export function validateCSRFToken(token: string, userId: string): boolean {
  try {
    const parts = token.split(':');
    if (parts.length !== 4) return false;
    
    const [tokenUserId, randomToken, timestamp, hash] = parts;
    
    // Check if the user ID matches
    if (tokenUserId !== userId) return false;
    
    // Check if the token is not too old (24 hours)
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (now - tokenTime > maxAge) return false;
    
    // Recreate the hash and compare
    const secret = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';
    const data = `${userId}:${randomToken}:${timestamp}`;
    const expectedHash = createHash('sha256').update(data + secret).digest('hex');
    
    return hash === expectedHash;
  } catch (error) {
    console.error('CSRF token validation error:', error);
    return false;
  }
}

/**
 * Extract CSRF token from request headers
 * @param request - The request object
 * @returns The CSRF token or null if not found
 */
export function extractCSRFToken(request: Request): string | null {
  return request.headers.get('X-CSRF-Token') || 
         request.headers.get('X-Csrf-Token') || 
         request.headers.get('x-csrf-token') || 
         null;
}

/**
 * Check if a request method requires CSRF protection
 * @param method - The HTTP method
 * @returns True if CSRF protection is required
 */
export function requiresCSRFProtection(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

/**
 * Generate a CSRF token for API responses
 * @param userId - The user ID
 * @returns An object with the CSRF token and metadata
 */
export function createCSRFResponse(userId: string) {
  const token = generateCSRFToken(userId);
  return {
    csrfToken: token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    message: 'CSRF token generated successfully'
  };
}

/**
 * Validate CSRF token from request
 * @param request - The request object
 * @param userId - The user ID to validate against
 * @returns Validation result with success status and error message
 */
export function validateRequestCSRF(request: Request, userId: string): {
  valid: boolean;
  error?: string;
} {
  // Check if CSRF protection is required for this method
  if (!requiresCSRFProtection(request.method)) {
    return { valid: true };
  }
  
  // Extract token from headers
  const token = extractCSRFToken(request);
  if (!token) {
    return { 
      valid: false, 
      error: 'CSRF token is required for this operation' 
    };
  }
  
  // Validate the token
  if (!validateCSRFToken(token, userId)) {
    return { 
      valid: false, 
      error: 'Invalid or expired CSRF token' 
    };
  }
  
  return { valid: true };
}
