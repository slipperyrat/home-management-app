-- Function to complete shopping item with XP and coin rewards
-- This function uses a transaction to ensure all updates are atomic
CREATE OR REPLACE FUNCTION complete_shopping_item_with_rewards(
  p_item_id UUID,
  p_user_id UUID,
  p_xp_reward INTEGER DEFAULT 10,
  p_coin_reward INTEGER DEFAULT 1
)
RETURNS TABLE(
  id UUID,
  list_id UUID,
  name TEXT,
  quantity INTEGER,
  completed BOOLEAN,
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_current_xp INTEGER;
  v_current_coins INTEGER;
BEGIN
  -- Start transaction
  BEGIN
    -- Get current user XP and coins
    SELECT xp, coins INTO v_current_xp, v_current_coins
    FROM users
    WHERE id = p_user_id;
    
    -- Check if user exists
    IF NOT FOUND THEN
      RAISE EXCEPTION 'User not found with ID: %', p_user_id;
    END IF;
    
    -- Update shopping item completion status
    UPDATE shopping_items
    SET 
      completed = true,
      completed_by = p_user_id,
      completed_at = NOW()
    WHERE id = p_item_id;
    
    -- Check if shopping item was updated
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Shopping item not found with ID: %', p_item_id;
    END IF;
    
    -- Update user XP and coins
    UPDATE users
    SET 
      xp = COALESCE(v_current_xp, 0) + p_xp_reward,
      coins = COALESCE(v_current_coins, 0) + p_coin_reward
    WHERE id = p_user_id;
    
    -- Return the updated shopping item
    RETURN QUERY
    SELECT 
      si.id,
      si.list_id,
      si.name,
      si.quantity,
      si.completed,
      si.completed_by,
      si.completed_at,
      si.created_at
    FROM shopping_items si
    WHERE si.id = p_item_id;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on any error
      RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql; 