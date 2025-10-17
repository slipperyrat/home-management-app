import { supabase } from './supabaseClient';
import { logger } from '@/lib/logging/logger';

export async function addXp(userId: string, xpToAdd: number = 5): Promise<{ xp: number | null } | null> {
  logger.info('Updating user XP', { userId, xpToAdd });

  const { data: currentUsers, error: fetchError } = await supabase
    .from('users')
    .select('xp, id')
    .eq('id', userId);

  if (fetchError) {
    logger.error('Error fetching user XP', fetchError, { userId });
    throw new Error(`Failed to fetch user XP: ${fetchError.message}`);
  }

  if (!currentUsers || currentUsers.length === 0) {
    logger.warn('User not found when updating XP', { userId });
    return null;
  }

  const currentUser = currentUsers[0];
  if (!currentUser) {
    logger.warn('No user data returned when updating XP', { userId });
    return null;
  }

  const currentXp = currentUser.xp || 0;
  const newXp = currentXp + xpToAdd;

  logger.info('Computed new XP value', { userId, currentXp, xpToAdd, newXp });

  const { data, error } = await supabase
    .from('users')
    .update({ xp: newXp })
    .eq('id', currentUser.id)
    .select('xp')
    .single();

  if (error) {
    logger.error('Error updating user XP', error, { userId });
    throw new Error(`Failed to add XP: ${error.message}`);
  }

  logger.info('Successfully updated user XP', { userId, updatedXp: data.xp });
  return data;
} 