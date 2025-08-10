import { createClient } from '@supabase/supabase-js'

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
export const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Cleans up expired power-ups for a user (server-side only)
 */
export async function cleanupExpiredPowerUps(userId: string) {
  try {
    const now = new Date().toISOString();
    const { error: deleteError } = await supabaseService
      .from('power_ups')
      .delete()
      .eq('user_id', userId)
      .lt('expires_at', now)
      .not('expires_at', 'is', null);

    if (deleteError) {
      console.error('❌ Error deleting expired power-ups:', deleteError);
      return false;
    } else {
      console.log(`🧹 Cleaned up expired power-ups for user ${userId}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Error in cleanupExpiredPowerUps:', error);
    return false;
  }
}
