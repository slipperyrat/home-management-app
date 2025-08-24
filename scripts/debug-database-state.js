const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDatabaseState() {
  console.log('🔍 Debugging database state...\n');

  try {
    // 1. Check if tables exist
    console.log('1. Checking table existence...');
    
    const tables = ['users', 'households', 'household_members', 'household_events', 'recipes'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Table ${table}: exists`);
        }
      } catch (err) {
        console.log(`❌ Table ${table}: ${err.message}`);
      }
    }

    console.log('\n2. Checking users table structure...');
    
    // 2. Check users table structure
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Error querying users: ${error.message}`);
      } else {
        console.log('✅ Users table accessible');
        if (data && data.length > 0) {
          const user = data[0];
          console.log('Sample user fields:', Object.keys(user));
          console.log('Sample user data:', user);
        }
      }
    } catch (err) {
      console.log(`❌ Error checking users table: ${err.message}`);
    }

    console.log('\n3. Checking households table structure...');
    
    // 3. Check households table structure
    try {
      const { data, error } = await supabase
        .from('households')
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Error querying households: ${error.message}`);
      } else {
        console.log('✅ Households table accessible');
        if (data && data.length > 0) {
          const household = data[0];
          console.log('Sample household fields:', Object.keys(household));
          console.log('Sample household data:', household);
        }
      }
    } catch (err) {
      console.log(`❌ Error checking households table: ${err.message}`);
    }

    console.log('\n4. Checking household_members table structure...');
    
    // 4. Check household_members table structure
    try {
      const { data, error } = await supabase
        .from('household_members')
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Error querying household_members: ${error.message}`);
      } else {
        console.log('✅ Household_members table accessible');
        if (data && data.length > 0) {
          const member = data[0];
          console.log('Sample member fields:', Object.keys(member));
          console.log('Sample member data:', member);
        }
      }
    } catch (err) {
      console.log(`❌ Error checking household_members table: ${err.message}`);
    }

    console.log('\n5. Checking household_events table structure...');
    
    // 5. Check household_events table structure
    try {
      const { data, error } = await supabase
        .from('household_events')
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Error querying household_events: ${error.message}`);
      } else {
        console.log('✅ Household_events table accessible');
        if (data && data.length > 0) {
          const event = data[0];
          console.log('Sample event fields:', Object.keys(event));
          console.log('Sample event data:', event);
        }
      }
    } catch (err) {
      console.log(`❌ Error checking household_events table: ${err.message}`);
    }

    console.log('\n6. Checking sample data...');
    
    // 6. Check for sample data
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, household_id, onboarding_completed')
        .limit(5);
      
      if (usersError) {
        console.log(`❌ Error fetching users: ${usersError.message}`);
      } else {
        console.log(`✅ Found ${users?.length || 0} users`);
        if (users && users.length > 0) {
          users.forEach((user, index) => {
            console.log(`  User ${index + 1}:`, {
              id: user.id,
              email: user.email,
              household_id: user.household_id,
              onboarding_completed: user.onboarding_completed
            });
          });
        }
      }
    } catch (err) {
      console.log(`❌ Error checking sample data: ${err.message}`);
    }

    console.log('\n7. Checking household relationships...');
    
    // 7. Check household relationships
    try {
      const { data: members, error: membersError } = await supabase
        .from('household_members')
        .select('user_id, household_id, role')
        .limit(5);
      
      if (membersError) {
        console.log(`❌ Error fetching household members: ${membersError.message}`);
      } else {
        console.log(`✅ Found ${members?.length || 0} household members`);
        if (members && members.length > 0) {
          members.forEach((member, index) => {
            console.log(`  Member ${index + 1}:`, {
              user_id: member.user_id,
              household_id: member.household_id,
              role: member.role
            });
          });
        }
      }
    } catch (err) {
      console.log(`❌ Error checking household relationships: ${err.message}`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the debug function
debugDatabaseState()
  .then(() => {
    console.log('\n✅ Database state check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug script failed:', error);
    process.exit(1);
  });
