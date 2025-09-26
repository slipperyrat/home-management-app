import { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { createClient } from '@supabase/supabase-js';
import { apiResponse, setCacheHeaders } from "@/lib/api/response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 User data API called');
    
    const { userId } = await getAuth(request);
    console.log('🔍 Auth result:', { userId });

    if (!userId) {
      console.log('❌ No user ID from auth');
      return apiResponse.unauthorized('User not authenticated');
    }

    console.log('🔍 Querying users table for clerk_id:', userId);
    
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

    console.log('🔍 Database query result:', { data, error });

    if (error) {
      console.error('❌ Database error:', error);
      return apiResponse.internalError(`Failed to fetch user data: ${error.message}`);
    }

    // If user doesn't exist yet, return a default response
    if (!data) {
      console.log('🔍 No user data found, returning default');
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

    console.log('🔍 User data found:', data);

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
        console.error('❌ Household query error:', householdError);
      } else if (householdData) {
        plan = householdData.plan || 'free';
        createdAt = householdData.created_at;
        gameMode = householdData.game_mode || 'default';
        console.log('🔍 Household data found:', { plan, createdAt, gameMode });
      }
    }

    // Auto-upgrade logic for free plans after 7 days
    if (plan === "free" && createdAt) {
      const createdDate = new Date(createdAt);
      const now = new Date();
      const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceCreation >= 7) {
        console.log(`Auto-upgrading household ${householdId} to pro (${daysSinceCreation} days old)`);
        
        const { error: updateError } = await supabase
          .from("households")
          .update({ plan: "pro" })
          .eq("id", householdId);

        if (updateError) {
          console.error('Error updating plan:', updateError);
        } else {
          console.log(`Successfully auto-upgraded household ${householdId} to pro`);
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
    
    console.log('🔍 Returning user data:', userData);
    
    const response = apiResponse.success(userData, 'User data fetched successfully');
    
    // Smart caching: Cache for 5 minutes, allow stale for 1 minute
    return setCacheHeaders(response, 300, 60);
  } catch (error) {
    console.error('❌ Unexpected error in user-data API:', error);
    return apiResponse.internalError(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 