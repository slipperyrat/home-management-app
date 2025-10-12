import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

// Create a Supabase client with service role key for server-side operations
export const supabaseService = createClient<Database>(supabaseUrl, supabaseServiceKey);

/**
 * Cleans up expired power-ups for a user (server-side only)
 */
export async function cleanupExpiredPowerUps(userId: string): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const { error: deleteError } = await supabaseService
      .from('power_ups')
      .delete()
      .eq('user_id', userId)
      .lt('expires_at', now)
      .not('expires_at', 'is', null);

    if (deleteError) {
      logger.warn('Error deleting expired power-ups', { userId, error: deleteError });
      return false;
    }

    logger.info('Expired power-ups cleaned', { userId });
    return true;
  } catch (error) {
    logger.error('cleanupExpiredPowerUps failed', error as Error, { userId });
    return false;
  }
}
