import { createClient } from '@supabase/supabase-js';
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

// Create Supabase admin client
export function sb() {
  return createClient(supabaseUrl!, supabaseServiceKey!);
}

// Custom error class for typed errors
export class ServerError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message);
    this.name = 'ServerError';
  }
}

// Helper function to get user and household data
export async function getUserAndHousehold(): Promise<{ userId: string; householdId: string }> {
  try {
    // Get user from Clerk auth
    const user = await currentUser();
    
    if (!user) {
      throw new ServerError('Unauthorized', 403);
    }
    const userId = user.id;

    // Fetch user data and household from household_members table
    // This matches your existing data structure
    const { data: userData, error: userError } = await sb()
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user household data:', userError);
      throw new ServerError('User not found in any household', 404);
    }

    if (!userData?.household_id) {
      throw new ServerError('User not associated with any household', 404);
    }

    return {
      userId,
      householdId: userData.household_id
    };
  } catch (error) {
    if (error instanceof ServerError) {
      throw error;
    }
    
    console.error('Error in getUserAndHousehold:', error);
    throw new ServerError('Internal server error', 500);
  }
}

// Helper function to create error response
export function createErrorResponse(error: ServerError): NextResponse {
  return NextResponse.json(
    { error: error.message },
    { status: error.status }
  );
}
