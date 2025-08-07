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

    const { data, error } = await supabase
      .from('users')
      .select(`
        email, 
        role,
        xp,
        coins,
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
      .single();

    if (error) {
      console.error('Error fetching user data:', error);
      const response = NextResponse.json({ 
        error: "Failed to fetch user data" 
      }, { status: 500 });
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }

    if (!data) {
      const response = NextResponse.json({ 
        error: "User not found in database" 
      }, { status: 404 });
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }

    console.log('Raw data from database:', JSON.stringify(data, null, 2));

    // Extract plan and household data from the nested household data
    const householdData = data.household_members?.[0]?.households?.[0];
    let plan = householdData?.plan || 'free';
    const householdId = data.household_members?.[0]?.household_id;
    const userRole = data.household_members?.[0]?.role;
    const createdAt = householdData?.created_at;
    const gameMode = householdData?.game_mode || 'default';
    
    // After fetching the household
    const household = data?.household_members?.[0]?.households?.[0];

    // If we don't have household data, try to fetch it directly
    if (!household && householdId) {
      console.log('No household data found, fetching directly for household ID:', householdId);
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('plan, game_mode, created_at')
        .eq('id', householdId)
        .single();
      
      if (householdError) {
        console.error('Error fetching household data:', householdError);
      } else if (householdData) {
        console.log('Direct household data:', householdData);
        plan = householdData.plan || 'free';
        const createdAt = householdData.created_at;
        const gameMode = householdData.game_mode || 'default';
        
        // Update the household object
        const household = {
          plan: householdData.plan,
          game_mode: householdData.game_mode,
          created_at: householdData.created_at
        };
      }
    }

    console.log('Debug - Household data:', {
      household: household,
      plan: household?.plan,
      created_at: household?.created_at,
      householdId: householdId
    });

    if (household && household.plan === "free") {
      const createdDate = new Date(household.created_at);
      const now = new Date();
      const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log('Debug - Date calculation:', {
        createdDate: createdDate,
        now: now,
        daysSinceCreation: daysSinceCreation,
        shouldUpgrade: daysSinceCreation >= 7
      });

      if (daysSinceCreation >= 7) {
        console.log(`Auto-upgrading household ${householdId} to premium (${daysSinceCreation} days old)`);
        
        const { error: updateError } = await supabase
          .from("households")
          .update({ plan: "premium" })
          .eq("id", householdId);

        if (updateError) {
          console.error('Error updating plan:', updateError);
        } else {
          household.plan = "premium"; // Update locally too
          plan = "premium"; // Update the plan variable too
          console.log(`Successfully auto-upgraded household ${householdId} to premium`);
        }
      } else {
        console.log(`Household ${householdId} is ${daysSinceCreation} days old, not ready for upgrade yet`);
      }
    } else {
      console.log(`Household ${householdId} is not eligible for auto-upgrade:`, {
        exists: !!household,
        plan: household?.plan,
        isFree: household?.plan === "free"
      });
    }
    
    // Create userData object with household information
    const userData = {
      email: data.email,
      role: data.role,
      plan,
      xp: data.xp || 0,
      coins: data.coins || 0,
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
    
    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
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