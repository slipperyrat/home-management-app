import { NextRequest } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { apiResponse, setCacheHeaders } from '@/lib/api/response';
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
      return apiResponse.unauthorized('User not authenticated');
    }

    // Query users table directly since it has household_id
    const { data, error } = await supabase
      .from('users')
      .select(`
        email, 
        role,
        xp,
        coins,
        onboarding_completed,
        updated_at,
        household_id
      `)
      .eq('id', userId)  // Use 'id' field which stores the Clerk user ID
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch user data', error, { userId });
      return apiResponse.internalError(`Failed to fetch user data: ${error.message}`);
    }

    // If user doesn't exist yet, return a default response
    if (!data) {
      const defaultUser = {
        email: '',
        role: 'member',
        plan: 'free',
        xp: 0,
        coins: 0,
        has_onboarded: false,
        updated_at: null,
        household_id: null,
        household: null
      };

      const response = apiResponse.success(defaultUser, 'Default user data created');
      return setCacheHeaders(response, 300, 60);
    }

    // Extract data from the direct query
    const householdId = data.household_id;
    
    // Query household details to get the actual plan
    let plan = 'free';
    let createdAt = null;
    let gameMode = 'default';
    
    if (householdId) {
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('plan, created_at, game_mode')
        .eq('id', householdId)
        .maybeSingle();
      
      if (householdError) {
        logger.error('Failed to fetch household data', householdError, { householdId });
      } else if (householdData) {
        plan = householdData.plan || 'free';
        createdAt = householdData.created_at;
        gameMode = householdData.game_mode || 'default';
      }
    }

    // Auto-upgrade logic for free plans after 7 days
    if (plan === "free" && createdAt) {
      const createdDate = new Date(createdAt);
      const now = new Date();
      const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceCreation >= 7) {
        const { error: updateError } = await supabase
          .from("households")
          .update({ plan: "pro" })
          .eq("id", householdId);

        if (updateError) {
          logger.error('Failed to auto-upgrade household plan', updateError, { householdId });
        }
      }
    }
    
    // Create userData object with household information
    const userData = {
      email: data.email,
      role: data.role,
      plan,
      xp: data.xp || 0,
      coins: data.coins || 0,
      has_onboarded: data.onboarding_completed,
      updated_at: data.updated_at,
      household_id: householdId, // Add direct household_id
      household: {
        id: householdId,
        plan,
        game_mode: gameMode,
        created_at: createdAt
      }
    };
    const response = apiResponse.success(userData, 'User data fetched successfully');
    
    // Smart caching: Cache for 5 minutes, allow stale for 1 minute
    return setCacheHeaders(response, 300, 60);
  } catch (error) {
    logger.error('Unexpected error in user-data API', error instanceof Error ? error : new Error(String(error)));
    return apiResponse.internalError(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 