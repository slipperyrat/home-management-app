import { supabase } from './supabaseClient';

export async function addXp(userId: string, xpToAdd: number = 5) {
  console.log(`🔍 Looking for user with id: ${userId}`);
  
  // First get the current XP value
  const { data: currentUsers, error: fetchError } = await supabase
    .from('users')
    .select('xp, id')
    .eq('id', userId);

  if (fetchError) {
    console.error(`❌ Error fetching user:`, fetchError);
    throw new Error(`Failed to fetch user XP: ${fetchError.message}`);
  }

  console.log(`📊 Found ${currentUsers?.length || 0} users with id ${userId}`);

  // Check if user exists
  if (!currentUsers || currentUsers.length === 0) {
    console.warn(`⚠️ User with id ${userId} not found in database`);
    return null;
  }

  // If multiple users found, use the first one (you might want to clean up duplicates)
  const currentUser = currentUsers[0];
  if (!currentUser) {
    console.warn(`⚠️ No user data found for id ${userId}`);
    return null;
  }
  const currentXp = currentUser.xp || 0;
  const newXp = currentXp + xpToAdd;

  console.log(`💰 Current XP: ${currentXp}, Adding: ${xpToAdd}, New XP: ${newXp}`);

  // Update with new XP value using the specific user ID
  const { data, error } = await supabase
    .from('users')
    .update({ xp: newXp })
    .eq('id', currentUser.id)
    .select('xp')
    .single();

  if (error) {
    console.error(`❌ Error updating XP:`, error);
    throw new Error(`Failed to add XP: ${error.message}`);
  }

  console.log(`✅ Successfully updated XP to: ${data.xp}`);
  return data;
} 