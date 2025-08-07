import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

// Service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Regular client for user operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rewardId } = await request.json();
    if (!rewardId) {
      return NextResponse.json({ error: 'Reward ID is required' }, { status: 400 });
    }

    console.log(`🎯 Claiming reward ${rewardId} for user ${userId}`);

    // 1. Insert into reward_claims
    const { error: claimError } = await supabase
      .from('reward_claims')
      .insert({
        reward_id: rewardId,
        user_id: userId
      });

    if (claimError) {
      console.error('❌ Error claiming reward:', claimError);
      return NextResponse.json({ error: `Error claiming reward: ${claimError.message}` }, { status: 500 });
    }

    console.log('✅ Reward claimed successfully');

    // 2. Fetch the full reward row by ID
    const { data: reward, error: rewardError } = await supabaseAdmin
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError) {
      console.error('❌ Error fetching reward details:', rewardError);
      return NextResponse.json({ error: `Error fetching reward details: ${rewardError.message}` }, { status: 500 });
    }

    if (!reward) {
      console.error('❌ Reward not found:', rewardId);
      return NextResponse.json({ error: `Reward not found: ${rewardId}` }, { status: 404 });
    }

    console.log('📦 Reward details:', { name: reward.name, type: reward.type });

    // 3. Check if reward has a recognized type and handle power-ups
    if (reward.type) {
      console.log(`🎁 Processing power-up for type: ${reward.type}`);
      
      let expiresAt = null;
      
      // Set expiration based on type
      switch (reward.type) {
        case 'xp_boost':
        case 'double_coin':
          expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days
          break;
        case 'custom_theme':
        case 'pro_badge':
        case 'priority_support':
        case 'analytics':
          expiresAt = null; // Permanent
          break;
        default:
          console.log(`⚠️ Unknown reward type: ${reward.type}`);
          return NextResponse.json({ success: true });
      }

      // 4. Insert into power_ups table
      const { error: powerUpError } = await supabaseAdmin
        .from('power_ups')
        .upsert({
          user_id: userId,
          type: reward.type,
          expires_at: expiresAt
        }, {
          onConflict: 'user_id,type'
        });

      if (powerUpError) {
        console.error('❌ Error creating power-up:', powerUpError);
        return NextResponse.json({ error: `Error creating power-up: ${powerUpError.message}` }, { status: 500 });
      }

      console.log(`✅ Power-up created: ${reward.type}${expiresAt ? ` (expires: ${expiresAt})` : ' (permanent)'}`);
    } else {
      console.log('ℹ️ No power-up type specified for this reward');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error in claim reward API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 