# Supabase Setup Guide

## Deploying the Shopping Item Completion Function

If you want to use the more robust transaction-based approach for shopping item completion, you need to deploy the stored procedure to your Supabase database.

### Option 1: Use Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - Navigate to your project at https://supabase.com/dashboard
   - Select your project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the Function**
   - Copy the contents of `supabase/functions/complete_shopping_item_with_rewards.sql`
   - Paste it into the SQL editor

4. **Execute the Function**
   - Click "Run" to create the stored procedure

### Option 2: Use Supabase CLI

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase db push
```

### Current Implementation

The current implementation uses a simpler approach without stored procedures:

- ✅ **Works immediately** without database setup
- ✅ **Awards XP and coins** when completing shopping items
- ⚠️ **Not atomic** - if one operation fails, the other might still succeed
- ⚠️ **Less robust** than the stored procedure approach

### Benefits of the Stored Procedure Approach

If you deploy the stored procedure, you'll get:

- ✅ **Atomic transactions** - all operations succeed or fail together
- ✅ **Better performance** - single database call
- ✅ **More robust** error handling
- ✅ **Easier to maintain** - all logic in one place

### Switching to Stored Procedure

Once you deploy the stored procedure, you can switch back by updating the `completeShoppingItemWithRewards` function in `src/lib/shoppingLists.ts` to use the RPC call instead of the current implementation.

## Database Schema Requirements

Make sure your database has these tables and columns:

### Setting Up Rewards Tables

To use the rewards system, you need to create the rewards, reward_claims, and power_ups tables:

1. **Go to your Supabase Dashboard**
   - Navigate to your project at https://supabase.com/dashboard
   - Select your project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Rewards Schema**
   - Copy the contents of `supabase/alter_rewards_schema.sql`
   - Paste it into the SQL editor
   - Click "Run" to create the tables and sample data

4. **Run the Power-ups Schema**
   - Copy the contents of `supabase/power_ups_schema.sql`
   - Paste it into the SQL editor
   - Click "Run" to create the power_ups table

This will create:
- `rewards` table with sample rewards and types
- `reward_claims` table for tracking user claims
- `power_ups` table for tracking user power-ups
- Sample rewards including free and premium options

### `users` table
- `id` (UUID, primary key)
- `clerk_id` (UUID)
- `email` (text)
- `role` (text)
- `xp` (integer, default 0)
- `coins` (integer, default 0)

### `shopping_items` table
- `id` (UUID, primary key)
- `list_id` (UUID, foreign key to shopping_lists)
- `name` (text)
- `quantity` (integer)
- `completed` (boolean, default false)
- `completed_by` (UUID, nullable)
- `completed_at` (timestamp, nullable)
- `created_at` (timestamp)

### `households` table
- `id` (UUID, primary key)
- `name` (text)
- `plan` (text, default 'free')
- `game_mode` (text, default 'default')
- `created_at` (timestamp)

### `household_members` table
- `user_id` (UUID, foreign key to users)
- `household_id` (UUID, foreign key to households)
- `role` (text)

### `rewards` table
- `id` (UUID, primary key)
- `name` (text, not null)
- `description` (text)
- `xp_cost` (integer, default 0)
- `coin_cost` (integer, default 0)
- `pro_only` (boolean, default false)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `reward_claims` table
- `id` (UUID, primary key)
- `user_id` (TEXT, foreign key to users.clerk_id)
- `reward_id` (UUID, foreign key to rewards)
- `created_at` (timestamp)
- Unique constraint on (user_id, reward_id)

### `power_ups` table
- `id` (UUID, primary key)
- `user_id` (TEXT, foreign key to users.clerk_id)
- `type` (TEXT, not null)
- `expires_at` (timestamp, nullable)
- `created_at` (timestamp)
- Unique constraint on (user_id, type) 