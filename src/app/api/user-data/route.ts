import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  console.log('User data API called');
  
  const { userId } = await getAuth(request);

  if (!userId) {
    console.log('No userId found, unauthorized');
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  }

  try {
    console.log('Fetching user data for:', userId);

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
      console.error('Error fetching user data:', error);
      const response = NextResponse.json({ 
        error: "Failed to fetch user data" 
      }, { status: 500 });
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }

    // If user doesn't exist yet, return a default response
    if (!data) {
      console.log('User not found in database, returning default data');
      const response = NextResponse.json({ 
        success: true,
        user: {
          email: '',
          role: 'member',
          plan: 'free',
          xp: 0,
          coins: 0,
          household: null
        }
      });
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }

    console.log('Raw data from database:', JSON.stringify(data, null, 2));

    // Extract data from the optimized query
    const householdMember = data.household_members?.[0];
    const household = householdMember?.households as any; // Type assertion for nested object
    const householdId = householdMember?.household_id;
    const userRole = householdMember?.role;
    
    console.log('Debug - Household extraction:', {
      householdMember: householdMember ? 'exists' : 'missing',
      household: household ? 'exists' : 'missing', 
      householdType: typeof household,
      householdKeys: household ? Object.keys(household) : 'none'
    });
    
    // Safe access with fallbacks
    let plan = 'free';
    let createdAt = null;
    let gameMode = 'default';
    
    if (household && typeof household === 'object') {
      plan = household.plan || 'free';
      createdAt = household.created_at;
      gameMode = household.game_mode || 'default';
    } else {
      console.log('Warning: household data not accessible, using defaults');
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
    
    console.log('Successfully fetched user data:', { 
      email: userData.email, 
      role: userData.role, 
      plan: userData.plan 
    });
    
    const response = NextResponse.json({ 
      success: true,
      user: userData
    });
    
    // Smart caching: Cache for 5 minutes, allow stale for 1 minute
    response.headers.set('Cache-Control', 'private, s-maxage=300, stale-while-revalidate=60');
    response.headers.set('Vary', 'Authorization'); // Vary by user
    
    return response;

  } catch (error) {
    console.error('Exception in user data API:', error);
    const response = NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  }
} 