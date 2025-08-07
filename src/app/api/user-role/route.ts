import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuth } from "@clerk/nextjs/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('clerk_id', userId)
      .single();

    if (error) {
      // If user doesn't exist in database yet, return default role
      if (error.code === 'PGRST116') {
        console.log('User not found in database yet, returning default role');
        return NextResponse.json({ role: 'member' });
      }
      
      console.error('Error fetching user role:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ role: data?.role || 'member' });
  } catch (err: any) {
    console.error('Exception in user-role API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 