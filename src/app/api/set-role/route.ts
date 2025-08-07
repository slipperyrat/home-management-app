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
  console.log('Set role API called');
  
  const { userId } = await getAuth(request);

  if (!userId) {
    console.log('No userId found, unauthorized');
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse request body
    const body = await request.json();
    const { clerkId, role } = body;

    // Validate request body
    if (!clerkId || !role) {
      return NextResponse.json({ 
        error: "Missing required fields: clerkId and role" 
      }, { status: 400 });
    }

    if (!['owner', 'member'].includes(role)) {
      return NextResponse.json({ 
        error: "Invalid role. Must be 'owner' or 'member'" 
      }, { status: 400 });
    }

    console.log(`User ${userId} attempting to set role of ${clerkId} to ${role}`);

    // Check if current user is an owner in household_members
    const { data: currentUser, error: currentUserError } = await supabase
      .from('household_members')
      .select('role')
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
        error: "Insufficient permissions. Only owners can set user roles" 
      }, { status: 403 });
    }

    // Update the target user's role in household_members
    const { data: updatedUser, error: updateError } = await supabase
      .from('household_members')
      .update({ role })
      .eq('user_id', clerkId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user role in household_members:', updateError);
      return NextResponse.json({ 
        error: "Failed to update user role in household" 
      }, { status: 500 });
    }

    if (!updatedUser) {
      return NextResponse.json({ 
        error: "Target user not found in household" 
      }, { status: 404 });
    }

    // Also update the role in the users table
    const { data: updatedUserInUsers, error: usersUpdateError } = await supabase
      .from('users')
      .update({ role })
      .eq('clerk_id', clerkId)
      .select()
      .single();

    if (usersUpdateError) {
      console.error('Error updating user role in users table:', usersUpdateError);
      // Don't fail the request, just log the error since household_members was updated successfully
      console.warn('Warning: Failed to sync role to users table, but household_members was updated');
    }

    console.log(`Successfully updated user ${clerkId} role to ${role}`);
    return NextResponse.json({ 
      success: true,
      message: `User role updated successfully to ${role}`,
      user: {
        userId: updatedUser.user_id,
        role: updatedUser.role
      }
    });

  } catch (error) {
    console.error('Exception in set role API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 