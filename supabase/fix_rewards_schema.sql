-- Drop existing tables if they exist (this will also drop reward_claims due to foreign key)
DROP TABLE IF EXISTS reward_claims CASCADE;
DROP TABLE IF EXISTS rewards CASCADE;

-- Create rewards table with correct schema
CREATE TABLE rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cost_xp INTEGER NOT NULL DEFAULT 0,
  cost_coins INTEGER NOT NULL DEFAULT 0,
  pro_only BOOLEAN NOT NULL DEFAULT false,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(clerk_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reward_claims table with correct schema
CREATE TABLE reward_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, reward_id)
);

-- Insert sample household-specific rewards (these will be filtered by household_id)
INSERT INTO rewards (title, description, cost_xp, cost_coins, pro_only, household_id, created_by) VALUES
  ('Extra XP Boost', 'Get 50 bonus XP', 100, 0, false, NULL, NULL),
  ('Coin Multiplier', 'Double your next coin earnings', 0, 10, false, NULL, NULL),
  ('Pro Badge', 'Show off your premium status', 0, 50, true, NULL, NULL),
  ('Custom Theme', 'Unlock a special dashboard theme', 200, 20, true, NULL, NULL),
  ('Priority Support', 'Get faster customer support', 0, 100, true, NULL, NULL),
  ('Advanced Analytics', 'View detailed household statistics', 300, 0, true, NULL, NULL);

-- Create indexes for better performance
CREATE INDEX idx_reward_claims_user_id ON reward_claims(user_id);
CREATE INDEX idx_reward_claims_reward_id ON reward_claims(reward_id);
CREATE INDEX idx_rewards_created_at ON rewards(created_at);
CREATE INDEX idx_rewards_household_id ON rewards(household_id); 