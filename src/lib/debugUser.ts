import { logger } from '@/lib/logging/logger';
import { supabase } from './supabaseClient';

interface DebugUserResult {
  users: unknown;
  members: unknown;
  usersError: Error | null;
  membersError: Error | null;
}

export async function debugUser(userId: string): Promise<DebugUserResult> {
  logger.info('Debugging user', { userId });
  
  // Check users table
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId);
  
  logger.info('Users table results', {
    hasUsers: Boolean(users?.length),
    userCount: users?.length ?? 0,
    hasError: Boolean(usersError),
    userId,
  });
  
  // Check household_members table
  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select('*')
    .eq('user_id', userId);
  
  logger.info('Household members results', {
    hasMembers: Boolean(members?.length),
    memberCount: members?.length ?? 0,
    hasError: Boolean(membersError),
    userId,
  });
  
  return {
    users,
    members,
    usersError: usersError ? new Error(usersError.message) : null,
    membersError: membersError ? new Error(membersError.message) : null,
  };
} 