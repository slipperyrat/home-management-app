import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Must be service role key
)

export async function syncUser(clerkUser: { id: string; email: string; name: string }) {
  console.log("🔁 Running syncUser");
  const { id, email } = clerkUser;
  console.log("✅ Current user:", clerkUser);

  // Test service role key access
  console.log("🔑 Testing service role key access...");
  const { data: allUsers, error: testError } = await supabase
    .from('users')
    .select('id, email')
    .limit(5);
  
  console.log('Service role test:', { 
    allUsers: allUsers?.length || 0, 
    error: testError?.message || null 
  });

  // Ensure user exists in users table
  console.log("👤 Ensuring user exists in users table...");
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', id)
    .single();
  
  console.log('User check result:', { userRow, userError });
  
  if (userError && userError.code !== 'PGRST116') {
    console.error('❌ Error checking users table:', userError);
  }

  // 2. Check if any households exist
  console.log("📡 Fetching household list...");
  const { data: existingHouseholds, error: householdsError } = await supabase
    .from('households')
    .select('id')
    .limit(1)
  if (householdsError) console.error('❌ Error fetching households:', householdsError);

  let householdId: string;
  let role: string;

  if (!existingHouseholds || existingHouseholds.length === 0) {
    // No households → create one + become owner
    console.log("🏠 Creating household since none found...");
    const { data: newHousehold, error: householdError } = await supabase
      .from('households')
      .insert({ 
        name: `${clerkUser.name || email}'s Household`,
        game_mode: 'default'
      })
      .select()
      .single();
    if (householdError) console.error('❌ Error creating household:', householdError);
    householdId = newHousehold?.id;
    role = 'owner';
  } else {
    // Join existing household as member
    householdId = existingHouseholds[0].id;
    role = 'member';
  }

  // Upsert user (without household_id since it's in household_members table)
  console.log('🔄 Upserting user...');
  
  // Only upsert if user doesn't exist, or update without overwriting XP/coins
  if (!userRow) {
    // New user - set initial values
    const { error: upsertError } = await supabase.from('users').upsert({
      id: id,
      clerk_id: id,
      email: email,
      role: role,
      xp: 0,
      coins: 0,
    });
    if (upsertError) {
      console.error('❌ Error upserting user:', upsertError);
    } else {
      console.log('✅ Created new user:', { id, clerk_id: id, email, role, xp: 0, coins: 0 });
    }
  } else {
    // Existing user - only update email and role, preserve XP/coins
    const { error: updateError } = await supabase.from('users').update({
      email: email,
      role: role,
    }).eq('clerk_id', id);
    if (updateError) {
      console.error('❌ Error updating user:', updateError);
    } else {
      console.log('✅ Updated existing user:', { id, clerk_id: id, email, role });
    }
  }

  // 1. Check if user is already in household_members
  console.log("🔎 Checking if user already exists in household_members table...");
  const { data: existingMembership, error: membershipError } = await supabase
    .from('household_members')
    .select('*')
    .eq('user_id', id)
    .single();
  if (membershipError && membershipError.code !== 'PGRST116') {
    console.error('❌ Error checking membership:', membershipError);
  }

  if (existingMembership) {
    console.log("✅ User already exists in household_members, skipping sync.");
    return;
  }

  console.log(`👤 Creating user as ${role}:`, email, role);
  console.log("📥 Inserting into household_members:", {
    user_id: id,
    household_id: householdId,
    role,
  });
  const { error: insertMemberError } = await supabase.from('household_members').insert({
    user_id: id,
    household_id: householdId,
    role,
  });
  if (insertMemberError) console.error('❌ Error inserting member into household_members:', insertMemberError);

  console.log(`✅ Synced ${email} to household ${householdId} as ${role}`);
} 