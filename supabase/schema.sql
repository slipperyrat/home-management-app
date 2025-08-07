-- Create rewards table
CREATE TABLE IF NOT EXISTS rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  xp_cost INTEGER NOT NULL DEFAULT 0,
  coin_cost INTEGER NOT NULL DEFAULT 0,
  pro_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reward_claims table
CREATE TABLE IF NOT EXISTS reward_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, reward_id)
);

-- Insert some sample rewards
INSERT INTO rewards (name, description, xp_cost, coin_cost, pro_only) VALUES
  ('Extra XP Boost', 'Get 50 bonus XP', 100, 0, false),
  ('Coin Multiplier', 'Double your next coin earnings', 0, 10, false),
  ('Pro Badge', 'Show off your premium status', 0, 50, true),
  ('Custom Theme', 'Unlock a special dashboard theme', 200, 20, true),
  ('Priority Support', 'Get faster customer support', 0, 100, true),
  ('Advanced Analytics', 'View detailed household statistics', 300, 0, true)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reward_claims_user_id ON reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_claims_reward_id ON reward_claims(reward_id);
CREATE INDEX IF NOT EXISTS idx_rewards_created_at ON rewards(created_at); 