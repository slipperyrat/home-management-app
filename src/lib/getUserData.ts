import { clerkClient } from '@clerk/nextjs/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';

export async function getUserData() {
  const { getToken, userId } = auth();
  const supabase = createServerClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies,
  });

  const { data: user } = await supabase
    .from('users')
    .select('id, role, household_id, households(plan)')
    .eq('id', userId!)
    .single();

  const plan = user?.households?.plan || 'free';

  return {
    userId: user?.id,
    householdId: user?.household_id,
    role: user?.role,
    plan,
  };
} 