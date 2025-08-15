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
    const { userId } = await getAuth(request);

    if (!userId) {
      return apiResponse.unauthorized('User not authenticated');
    }

    // Optimized query: Join users with household_members and households in one query
    const { data, error } = await supabase
      .from('users')
      .select(`
        email, 
        role,
        xp,
        coins,
        has_onboarded,
        updated_at,
        household_members(
          role,
          household_id,
          households(
            plan,
            game_mode,
            created_at
          )
        )
      `)
      .eq('clerk_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return apiResponse.internalError('Failed to fetch user data');
    }

    // If user doesn't exist yet, return a default response
    if (!data) {
      const defaultUser = {
        email: '',
        role: 'member',
        plan: 'free',
        xp: 0,
        coins: 0,
        household: null
      };

      const response = apiResponse.success(defaultUser, 'Default user data created');
      return setCacheHeaders(response, 300, 60);
    }

    // Extract data from the optimized query
    const householdMember = data.household_members?.[0];
    const household = householdMember?.households as any; // Type assertion for nested object
    const householdId = householdMember?.household_id;
    
    // Safe access with fallbacks
    let plan = 'free';
    let createdAt = null;
    let gameMode = 'default';
    
    if (household && typeof household === 'object') {
      plan = household.plan || 'free';
      createdAt = household.created_at;
      gameMode = household.game_mode || 'default';
    }

    // Auto-upgrade logic for free plans after 7 days
    if (plan === "free" && createdAt) {
      const createdDate = new Date(createdAt);
      const now = new Date();
      const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceCreation >= 7) {
        console.log(`Auto-upgrading household ${householdId} to premium (${daysSinceCreation} days old)`);
        
        const { error: updateError } = await supabase
          .from("households")
          .update({ plan: "premium" })
          .eq("id", householdId);

        if (updateError) {
          console.error('Error updating plan:', updateError);
        } else {
          plan = "premium"; // Update the plan variable
          console.log(`Successfully auto-upgraded household ${householdId} to premium`);
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
      has_onboarded: data.has_onboarded,
      updated_at: data.updated_at,
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
    console.error('Unexpected error in user-data API:', error);
    return apiResponse.internalError('An unexpected error occurred');
  }
} 