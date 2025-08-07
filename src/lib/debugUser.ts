import { supabase } from './supabaseClient';

export async function debugUser(userId: string) {
  console.log(`🔍 Debugging user: ${userId}`);
  
  // Check users table
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId);
  
  console.log('Users table results:', { users, error: usersError });
  
  // Check household_members table
  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select('*')
    .eq('user_id', userId);
  
  console.log('Household members results:', { members, error: membersError });
  
  return { users, members, usersError, membersError };
} 