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
  console.log('🔧 Fix onboarding API called');
  
  const { userId } = await getAuth(request);

  if (!userId) {
    console.log('❌ No userId found, unauthorized');
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log('🔧 Fixing onboarding status for user:', userId);

    // First, check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking user:', checkError);
      return NextResponse.json({ 
        error: "Failed to check user",
        details: checkError
      }, { status: 500 });
    }

    if (!existingUser) {
      console.log('❌ User not found in database');
      return NextResponse.json({ 
        error: "User not found in database"
      }, { status: 404 });
    }

    // Update the user's onboarding status
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({ 
        has_onboarded: true,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_id', userId)
      .select();

    if (updateError) {
      console.error('❌ Error updating user:', updateError);
      return NextResponse.json({ 
        error: "Failed to update user",
        details: updateError
      }, { status: 500 });
    }

    console.log('✅ Successfully updated user onboarding status:', updateData);

    return NextResponse.json({ 
      success: true,
      message: "User onboarding status fixed",
      user: updateData?.[0] || null
    });

  } catch (error) {
    console.error('❌ Exception in fix onboarding API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
