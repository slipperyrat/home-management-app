import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAuth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);

    if (!userId) {
      logger.warn('User role request missing Clerk userId', { securityEvent: true });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('clerk_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        logger.info('User role fallback to member (no DB record)', { userId });
        return NextResponse.json({ role: 'member' });
      }

      logger.error('Failed to fetch user role', error, { userId, securityEvent: true });
      return NextResponse.json({ error: 'Failed to fetch user role' }, { status: 500 });
    }

    return NextResponse.json({ role: data?.role || 'member' });
  } catch (err) {
    logger.error('Unexpected error fetching user role', err instanceof Error ? err : new Error(String(err)), {
      securityEvent: true,
    });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
} 