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
  console.log('🔍 Debug user status API called');
  
  const { userId } = await getAuth(request);

  if (!userId) {
    console.log('❌ No userId found, unauthorized');
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log('🔍 Fetching debug data for user:', userId);

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', userId)
      .maybeSingle();

    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      return NextResponse.json({ 
        error: "Failed to fetch user data",
        details: userError
      }, { status: 500 });
    }

    // Get household member data
    const { data: memberData, error: memberError } = await supabase
      .from('household_members')
      .select(`
        *,
        households(*)
      `)
      .eq('clerk_id', userId)
      .maybeSingle();

    if (memberError) {
      console.error('❌ Error fetching household member data:', memberError);
    }

    // Get household data
    let householdData = null;
    if (memberData?.household_id) {
      const { data: hhData, error: hhError } = await supabase
        .from('households')
        .select('*')
        .eq('id', memberData.household_id)
        .maybeSingle();

      if (hhError) {
        console.error('❌ Error fetching household data:', hhError);
      } else {
        householdData = hhData;
      }
    }

    const debugInfo = {
      userId,
      timestamp: new Date().toISOString(),
      user: userData || 'User not found',
      householdMember: memberData || 'Not a household member',
      household: householdData || 'No household data',
      hasOnboarded: userData?.has_onboarded || false,
      userRole: userData?.role || 'No role',
      householdRole: memberData?.role || 'No household role',
      householdPlan: householdData?.plan || 'No plan',
      householdId: memberData?.household_id || 'No household ID'
    };

    console.log('✅ Debug info:', debugInfo);

    return NextResponse.json({ 
      success: true,
      debug: debugInfo
    });

  } catch (error) {
    console.error('❌ Exception in debug API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
