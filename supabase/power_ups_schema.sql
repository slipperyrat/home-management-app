-- Create power_ups table for tracking user power-ups
CREATE TABLE IF NOT EXISTS power_ups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, type)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_power_ups_user_id ON power_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_power_ups_type ON power_ups(type);
CREATE INDEX IF NOT EXISTS idx_power_ups_expires_at ON power_ups(expires_at);

-- Add type column to rewards table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'rewards' AND column_name = 'type') THEN
        ALTER TABLE rewards ADD COLUMN type TEXT;
        
        -- Update existing rewards with types based on their names
        UPDATE rewards SET type = 'xp_boost' WHERE name LIKE '%XP%' OR name LIKE '%Boost%';
        UPDATE rewards SET type = 'double_coin' WHERE name LIKE '%Coin%' OR name LIKE '%Multiplier%';
        UPDATE rewards SET type = 'pro_badge' WHERE name LIKE '%Pro%' OR name LIKE '%Badge%';
        UPDATE rewards SET type = 'custom_theme' WHERE name LIKE '%Theme%';
        UPDATE rewards SET type = 'priority_support' WHERE name LIKE '%Support%';
        UPDATE rewards SET type = 'analytics' WHERE name LIKE '%Analytics%';
    END IF;
END $$; 