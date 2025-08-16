# Database Schema Fix Setup

## Issue Identified

The user sync error is caused by a mismatch between the database schema and what the `syncUser.ts` function expects. The `users` table is missing several important fields:

- `email` - User email address
- `role` - User role in household (owner/member)
- `xp` - Experience points for gamification
- `coins` - Coins for rewards system
- `has_onboarded` - Onboarding completion status

## Solution

### Step 1: Run Database Migrations

1. **Go to your Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Schema Fix Migration**
   - Copy the contents of `supabase/fix_users_schema.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute the migration

4. **Run the Onboarding Field Migration** (if not already done)
   - Copy the contents of `supabase/add_onboarding_field.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute the migration

5. **Run the Household ID Migration** (if not already done)
   - Copy the contents of `supabase/create_new_features_schema.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute the migration

6. **Run the Households Schema Fix** (if not already done)
   - Copy the contents of `supabase/fix_households_schema.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute the migration

7. **Run the Household Members Schema Fix** (if not already done)
   - Copy the contents of `supabase/fix_household_members_schema.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute the migration

### Step 2: Verify the Schema

After running the migrations, your tables should have these columns:

**`users` table:**
```sql
- id (UUID, primary key, auto-generated)
- clerk_id (TEXT, Clerk user ID)
- email (TEXT, user email)
- role (TEXT, user role)
- xp (INTEGER, experience points)
- coins (INTEGER, coins)
- household_id (UUID, optional, references households)
- has_onboarded (BOOLEAN, onboarding status)
- created_at (TIMESTAMP, auto-generated)
```

**`households` table:**
```sql
- id (UUID, primary key, auto-generated)
- name (TEXT, household name)
- plan (TEXT, subscription plan, default 'free')
- game_mode (TEXT, gamification mode, default 'default')
- created_at (TIMESTAMP, auto-generated)
```

**`household_members` table:**
```sql
- user_id (TEXT, Clerk user ID, part of composite primary key)
- household_id (UUID, references households, part of composite primary key)
- role (TEXT, user role in household)
- created_at (TIMESTAMP, auto-generated)
```

### Step 3: Test the Fix

1. **Restart your development server**
   ```bash
   npm run dev
   ```

2. **Try signing in with a user**
   - The sync should now work without errors
   - Check the browser console for success messages

3. **Verify in Supabase**
   - Check the `users` table has the new columns
   - Verify a user record was created/updated

## What Was Fixed

1. **Schema Mismatch**: Added missing fields to match the syncUser function
2. **ID Handling**: Fixed the confusion between `id` and `clerk_id` fields
3. **Type Safety**: Updated TypeScript types to match the actual database schema
4. **Performance**: Added proper indexes for the new fields

## Troubleshooting

If you still get errors after running the migrations:

1. **Check the migration output** for any error messages
2. **Verify the table structure** in Supabase Dashboard > Table Editor
3. **Check the browser console** for specific error messages
4. **Ensure environment variables** are properly set (SUPABASE_SERVICE_ROLE_KEY)

## Next Steps

After fixing the schema:

1. Test user registration and login
2. Verify household creation works
3. Test the rewards and XP system
4. Ensure onboarding flow works correctly

The user sync should now work properly and create users with all the required fields for the gamification and rewards system.
