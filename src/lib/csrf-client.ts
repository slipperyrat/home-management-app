import { logger } from '@/lib/logging/logger';

// Client-side CSRF token utilities

let csrfToken: string | null = null;
let tokenExpiry: Date | null = null;

/**
 * Get a valid CSRF token, fetching a new one if needed
 * @returns Promise<string> - The CSRF token
 */
export async function getCSRFToken(): Promise<string> {
  // Check if we have a valid token
  if (csrfToken && tokenExpiry && new Date() < tokenExpiry) {
    return csrfToken;
  }

  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token (status ${response.status})`);
    }

    const { csrfToken: token, expiresAt } = (await response.json()) as {
      csrfToken: string;
      expiresAt: string;
    };
    csrfToken = token;
    tokenExpiry = new Date(expiresAt);
    
    return csrfToken;
  } catch (error) {
    logger.error('Error fetching CSRF token', error as Error);
    throw error;
  }
}

/**
 * Clear the cached CSRF token (useful for logout)
 */
export function clearCSRFToken(): void {
  csrfToken = null;
  tokenExpiry = null;
}

/**
 * Make a fetch request with CSRF token included
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Promise<Response>
 */
export async function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getCSRFToken();
  
  const headers = new Headers(options.headers);
  headers.set('X-CSRF-Token', token);
  
  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials ?? 'include',
  });
}
