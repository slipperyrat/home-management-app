import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Create a Supabase client with service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user via Clerk
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get rewardId from request body
    const body = await request.json();
    const { rewardId } = body;

    if (!rewardId) {
      return NextResponse.json({ error: 'Reward ID is required' }, { status: 400 });
    }

    // 3. Verify the reward exists and get its costs
    const { data: reward, error: rewardError } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError || !reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }

    // 4. Fetch the user's current XP and coins
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('xp, coins')
      .eq('clerk_id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 5. Check if user has enough resources
    const currentXp = user.xp || 0;
    const currentCoins = user.coins || 0;
    const requiredXp = reward.cost_xp || 0;
    const requiredCoins = reward.cost_coins || 0;

    if (currentXp < requiredXp || currentCoins < requiredCoins) {
      return NextResponse.json({ 
        error: 'Insufficient XP or coins',
        details: {
          current: { xp: currentXp, coins: currentCoins },
          required: { xp: requiredXp, coins: requiredCoins }
        }
      }, { status: 400 });
    }

    // 6. Check if user has already claimed this reward
    const { data: existingClaim, error: claimCheckError } = await supabase
      .from('claimed_rewards')
      .select('*')
      .eq('user_id', userId)
      .eq('reward_id', rewardId)
      .single();

    if (claimCheckError && claimCheckError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected if no claim exists
      return NextResponse.json({ error: 'Error checking existing claim' }, { status: 500 });
    }

    if (existingClaim) {
      return NextResponse.json({ error: 'Reward already claimed' }, { status: 400 });
    }

    // 7. Deduct resources from user and insert claim in a transaction
    const newXp = currentXp - requiredXp;
    const newCoins = currentCoins - requiredCoins;

    // Update user's resources
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        xp: newXp,
        coins: newCoins
      })
      .eq('clerk_id', userId);

    if (updateError) {
      console.error('Error updating user resources:', updateError);
      return NextResponse.json({ error: 'Failed to update user resources' }, { status: 500 });
    }

    // 8. Insert new claim into claimed_rewards table
    const { data: newClaim, error: insertError } = await supabase
      .from('claimed_rewards')
      .insert({
        user_id: userId,
        reward_id: rewardId
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting reward claim:', insertError);
      return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 });
    }

    console.log(`✅ Reward ${rewardId} claimed successfully by user ${userId}. Deducted ${requiredXp} XP and ${requiredCoins} coins.`);

    // 9. Return success response
    return NextResponse.json({ 
      success: true, 
      data: {
        claim: newClaim,
        reward: reward,
        resourcesDeducted: {
          xp: requiredXp,
          coins: requiredCoins
        },
        newBalance: {
          xp: newXp,
          coins: newCoins
        }
      }
    });

  } catch (error) {
    console.error('Exception in POST /api/claim-reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 