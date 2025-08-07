import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  console.log('Update game mode API called');
  
  const { userId } = await getAuth(request);

  if (!userId) {
    console.log('No userId found, unauthorized');
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse request body
    const body = await request.json();
    const { game_mode } = body;

    // Validate request body
    if (!game_mode) {
      return NextResponse.json({ 
        error: "Missing required field: game_mode" 
      }, { status: 400 });
    }

    const validGameModes = ['single', 'couple', 'family', 'roommates', 'custom'];
    if (!validGameModes.includes(game_mode)) {
      return NextResponse.json({ 
        error: `Invalid game_mode. Must be one of: ${validGameModes.join(', ')}` 
      }, { status: 400 });
    }

    console.log(`User ${userId} attempting to update game_mode to ${game_mode}`);

    // Check if current user is part of a household
    const { data: currentUser, error: currentUserError } = await supabase
      .from('household_members')
      .select('role, household_id')
      .eq('user_id', userId)
      .single();

    if (currentUserError) {
      console.error('Error fetching current user:', currentUserError);
      return NextResponse.json({ 
        error: "Failed to verify current user household membership" 
      }, { status: 500 });
    }

    if (!currentUser) {
      return NextResponse.json({ 
        error: "Current user not found in any household" 
      }, { status: 404 });
    }

    // Update the household's game_mode
    const { data: updatedHousehold, error: updateError } = await supabase
      .from('households')
      .update({ game_mode })
      .eq('id', currentUser.household_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating household game_mode:', updateError);
      return NextResponse.json({ 
        error: "Failed to update household game mode" 
      }, { status: 500 });
    }

    if (!updatedHousehold) {
      return NextResponse.json({ 
        error: "Household not found" 
      }, { status: 404 });
    }

    console.log(`Successfully updated household ${currentUser.household_id} game_mode to ${game_mode}`);
    return NextResponse.json({ 
      success: true,
      message: `Game mode updated successfully to ${game_mode}`,
      household: {
        id: updatedHousehold.id,
        game_mode: updatedHousehold.game_mode
      }
    });

  } catch (error) {
    console.error('Exception in update game mode API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 