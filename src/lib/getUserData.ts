import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

export async function getUserData() {
  const { userId } = await auth();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  const { data: user } = await supabase
    .from('users')
    .select('id, role, household_id, households(plan)')
    .eq('id', userId!)
    .single();

  const plan = user?.households?.[0]?.plan || 'free';

  return {
    userId: user?.id,
    householdId: user?.household_id,
    role: user?.role,
    plan,
  };
} 