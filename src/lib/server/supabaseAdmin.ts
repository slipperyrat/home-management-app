"use server";

import { createClient } from '@supabase/supabase-js';
import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

export function createSupabaseAdminClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

export class ServerError extends Error {
  constructor(message: string, public status: number = 500) {
    super(message);
    this.name = 'ServerError';
  }
}

export async function getUserAndHousehold(): Promise<{ userId: string; householdId: string }> {
  try {
    const user = await currentUser();

    if (!user) {
      throw new ServerError('Unauthorized', 403);
    }

    const supabase = createSupabaseAdminClient();

    const { data: userData, error: userError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (userError) {
      logger.error('Error fetching user household data', userError, { userId: user.id });
      throw new ServerError('User not found in any household', 404);
    }

    if (!userData?.household_id) {
      throw new ServerError('User not associated with any household', 404);
    }

    return {
      userId: user.id,
      householdId: userData.household_id,
    };
  } catch (error) {
    if (error instanceof ServerError) {
      throw error;
    }

    logger.error('getUserAndHousehold failed', error as Error);
    throw new ServerError('Internal server error', 500);
  }
}

export function createErrorResponse(error: ServerError): NextResponse {
  return NextResponse.json(
    { error: error.message },
    { status: error.status },
  );
}
