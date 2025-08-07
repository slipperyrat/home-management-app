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
  console.log('Update plan API called');
  
  const { userId } = await getAuth(request);

  if (!userId) {
    console.log('No userId found, unauthorized');
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse request body
    const body = await request.json();
    const { plan } = body;

    // Validate request body
    if (!plan) {
      return NextResponse.json({ 
        error: "Missing required field: plan" 
      }, { status: 400 });
    }

    if (!['free', 'premium'].includes(plan)) {
      return NextResponse.json({ 
        error: "Invalid plan. Must be 'free' or 'premium'" 
      }, { status: 400 });
    }

    console.log(`User ${userId} attempting to update plan to ${plan}`);

    // Check if current user is an owner
    const { data: currentUser, error: currentUserError } = await supabase
      .from('household_members')
      .select('role, household_id')
      .eq('user_id', userId)
      .single();

    if (currentUserError) {
      console.error('Error fetching current user:', currentUserError);
      return NextResponse.json({ 
        error: "Failed to verify current user permissions" 
      }, { status: 500 });
    }

    if (!currentUser) {
      return NextResponse.json({ 
        error: "Current user not found in household" 
      }, { status: 404 });
    }

    if (currentUser.role !== 'owner') {
      return NextResponse.json({ 
        error: "Insufficient permissions. Only owners can update plan" 
      }, { status: 403 });
    }

    // Update the household's plan
    const { data: updatedHousehold, error: updateError } = await supabase
      .from('households')
      .update({ plan })
      .eq('id', currentUser.household_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating household plan:', updateError);
      return NextResponse.json({ 
        error: "Failed to update household plan" 
      }, { status: 500 });
    }

    if (!updatedHousehold) {
      return NextResponse.json({ 
        error: "Household not found" 
      }, { status: 404 });
    }

    console.log(`Successfully updated household ${currentUser.household_id} plan to ${plan}`);
    return NextResponse.json({ 
      success: true,
      message: `Plan updated successfully to ${plan}`,
      household: {
        id: updatedHousehold.id,
        plan: updatedHousehold.plan
      }
    });

  } catch (error) {
    console.error('Exception in update plan API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 