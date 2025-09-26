// Standardized Authentication Helper
// Provides consistent authentication across all API routes

import { currentUser } from '@clerk/nextjs/server';
import { ServerError } from '@/lib/server/supabaseAdmin';

export interface AuthenticatedUser {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
}

/**
 * Get authenticated user with consistent error handling
 * @returns Authenticated user object
 * @throws ServerError if user is not authenticated
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser> {
  try {
    const user = await currentUser();
    
    if (!user) {
      throw new ServerError('Unauthorized - Please sign in to continue', 401);
    }

    return {
      id: user.id,
      emailAddresses: user.emailAddresses || [],
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl
    };
  } catch (error) {
    if (error instanceof ServerError) {
      throw error;
    }
    
    console.error('Authentication error:', error);
    throw new ServerError('Authentication failed', 401);
  }
}

/**
 * Get user's primary email address
 * @param user - Authenticated user object
 * @returns Primary email address or empty string
 */
export function getUserEmail(user: AuthenticatedUser): string {
  return user.emailAddresses?.[0]?.emailAddress || '';
}

/**
 * Get user's full name
 * @param user - Authenticated user object
 * @returns Full name or empty string
 */
export function getUserFullName(user: AuthenticatedUser): string {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  
  return firstName || lastName || '';
}

/**
 * Get user's display name (first name or full name)
 * @param user - Authenticated user object
 * @returns Display name
 */
export function getUserDisplayName(user: AuthenticatedUser): string {
  return user.firstName || getUserFullName(user) || 'User';
}

/**
 * Check if user is authenticated (non-throwing version)
 * @returns Promise<AuthenticatedUser | null>
 */
export async function tryGetAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    return await getAuthenticatedUser();
  } catch {
    return null;
  }
}
