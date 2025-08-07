-- Check if rewards table exists and has the correct structure
DO $$
BEGIN
    -- Check if rewards table exists
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rewards') THEN
        -- Create rewards table if it doesn't exist
        CREATE TABLE rewards (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            xp_cost INTEGER NOT NULL DEFAULT 0,
            coin_cost INTEGER NOT NULL DEFAULT 0,
            pro_only BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Insert sample rewards
        INSERT INTO rewards (name, description, xp_cost, coin_cost, pro_only) VALUES
            ('Extra XP Boost', 'Get 50 bonus XP', 100, 0, false),
            ('Coin Multiplier', 'Double your next coin earnings', 0, 10, false),
            ('Pro Badge', 'Show off your premium status', 0, 50, true),
            ('Custom Theme', 'Unlock a special dashboard theme', 200, 20, true),
            ('Priority Support', 'Get faster customer support', 0, 100, true),
            ('Advanced Analytics', 'View detailed household statistics', 300, 0, true);
    END IF;
    
    -- Check if reward_claims table exists
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reward_claims') THEN
        -- Create reward_claims table if it doesn't exist
        CREATE TABLE reward_claims (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
            reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, reward_id)
        );
    ELSE
        -- Alter existing reward_claims table to fix the foreign key
        BEGIN
            -- Drop the existing foreign key constraint if it exists
            ALTER TABLE reward_claims DROP CONSTRAINT IF EXISTS reward_claims_user_id_fkey;
            
            -- Add the correct foreign key constraint
            ALTER TABLE reward_claims ADD CONSTRAINT reward_claims_user_id_fkey 
                FOREIGN KEY (user_id) REFERENCES users(clerk_id) ON DELETE CASCADE;
        EXCEPTION
            WHEN duplicate_object THEN
                -- Constraint already exists, do nothing
                NULL;
        END;
    END IF;
    
    -- Create indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_reward_claims_user_id ON reward_claims(user_id);
    CREATE INDEX IF NOT EXISTS idx_reward_claims_reward_id ON reward_claims(reward_id);
    CREATE INDEX IF NOT EXISTS idx_rewards_created_at ON rewards(created_at);
END $$; 