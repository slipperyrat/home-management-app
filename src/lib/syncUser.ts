import { createClient } from '@supabase/supabase-js'

import { logger } from '@/lib/logging/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Must be service role key
)

export async function syncUser(clerkUser: { id: string; email: string; name: string }) {
  logger.info('Running syncUser', { clerkUserId: clerkUser.id })
  const { id, email } = clerkUser
  logger.info('Current Clerk user snapshot', { clerkUserId: id, email, name: clerkUser.name })

  // Test service role key access
  logger.debug('Testing service role key access', { clerkUserId: id })
  const { data: allUsers, error: testError } = await supabase
    .from('users')
    .select('id, email')
    .limit(5);
  
  logger.debug('Service role test results', {
    clerkUserId: id,
    totalUsers: allUsers?.length ?? 0,
    hasError: Boolean(testError),
  })

  // Ensure user exists in users table
  logger.debug('Ensuring user exists in users table', { clerkUserId: id })
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)  // Changed from clerk_id to id
    .single();
  
  logger.debug('User check result', {
    clerkUserId: id,
    hasRow: Boolean(userRow),
    hasError: Boolean(userError),
  })
  
  if (userError && userError.code !== 'PGRST116') {
    logger.error('Error checking users table during sync', userError, { clerkUserId: id })
  }

  // 2. Check if any households exist
  logger.debug('Fetching household list for sync', { clerkUserId: id })
  const { data: existingHouseholds, error: householdsError } = await supabase
    .from('households')
    .select('id')
    .limit(1)
  if (householdsError) {
    logger.error('Error fetching households during sync', householdsError, { clerkUserId: id })
  }

  let householdId: string;
  let role: string;

  if (!existingHouseholds || existingHouseholds.length === 0) {
    // No households → create one + become owner
    logger.info('Creating initial household during sync', { clerkUserId: id })
    const { data: newHousehold, error: householdError } = await supabase
      .from('households')
      .insert({ 
        name: `${clerkUser.name || email}'s Household`,
        game_mode: 'default'
      })
      .select()
      .single();
    if (householdError) {
      logger.error('Error creating household during sync', householdError, { clerkUserId: id })
    }
    householdId = newHousehold?.id;
    role = 'owner';
  } else {
    // Join existing household as member
    householdId = existingHouseholds[0]?.id || '';
    role = 'member';
  }

  // Upsert user (without household_id since it's in household_members table)
  logger.debug('Upserting user during sync', { clerkUserId: id })
  
  // Only upsert if user doesn't exist, or update without overwriting XP/coins
  if (!userRow) {
    // New user - set initial values
    const { error: upsertError } = await supabase.from('users').upsert({
      id,  // Changed from clerk_id to id
      email,
      role,
      xp: 0,
      coins: 0,
      household_id: householdId, // Add household_id
      onboarding_completed: false, // Set initial onboarding status for new users only
    });
    if (upsertError) {
      logger.error('Error upserting user during sync', upsertError, { clerkUserId: id })
    } else {
      logger.info('Created new user during sync', {
        clerkUserId: id,
        email,
        role,
        xp: 0,
        coins: 0,
        householdId,
      })
    }
  } else {
    // Existing user - update email, role, and household_id, but preserve has_onboarded status
    const { error: updateError } = await supabase.from('users').update({
      email,
      role,
      household_id: householdId, // Add household_id
      // Note: We don't update has_onboarded for existing users to preserve their onboarding status
    }).eq('id', id);  // Changed from clerk_id to id
    if (updateError) {
      logger.error('Error updating existing user during sync', updateError, { clerkUserId: id })
    } else {
      logger.info('Updated existing user during sync', {
        clerkUserId: id,
        email,
        role,
        householdId,
      })
    }
  }

  // 1. Check if user is already in household_members
  logger.debug('Checking household membership during sync', { clerkUserId: id })
  const { data: existingMembership, error: membershipError } = await supabase
    .from('household_members')
    .select('*')
    .eq('user_id', id)
    .single();
  if (membershipError && membershipError.code !== 'PGRST116') {
    logger.error('Error checking membership during sync', membershipError, { clerkUserId: id })
  }

  if (existingMembership) {
    logger.info('User already exists in household_members, skipping insert', { clerkUserId: id })
    return
  }

  logger.info('Creating household membership during sync', { clerkUserId: id, householdId, role })
  const { error: insertMemberError } = await supabase.from('household_members').insert({
    user_id: id,
    household_id: householdId,
    role,
  });
  if (insertMemberError) {
    logger.error('Error inserting member into household_members', insertMemberError, {
      clerkUserId: id,
      householdId,
      role,
    })
  } else {
    logger.info('Synced user to household', { clerkUserId: id, email, householdId, role })
  }
} 