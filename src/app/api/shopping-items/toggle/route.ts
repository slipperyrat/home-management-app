import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = await request.json();

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    console.log(`🔄 API: Toggling shopping item ${itemId} for user ${userId}`);

    // First get the current item to check its completion status
    const { data: currentItem, error: fetchError } = await supabase
      .from('shopping_items')
      .select('completed')
      .eq('id', itemId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching shopping item:', fetchError);
      return NextResponse.json({ error: `Failed to fetch shopping item: ${fetchError.message}` }, { status: 500 });
    }

    console.log(`📦 Current item completion status:`, currentItem);

    // Check if item was previously incomplete (to award rewards only once)
    const wasIncomplete = !currentItem.completed;

    console.log(`🔄 Item was incomplete: ${wasIncomplete}`);

    if (wasIncomplete) {
      // Complete the item and award rewards
      console.log(`🎁 Awarding rewards for completing item`);
      
      // First, get the current user's XP and coins
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('xp, coins')
        .eq('clerk_id', userId);

      console.log(`👤 User data query result:`, { userData, userError });

      if (userError) {
        console.error(`❌ Error fetching user data:`, userError);
        return NextResponse.json({ error: `Failed to fetch user data: ${userError.message}` }, { status: 500 });
      }

      if (!userData || userData.length === 0) {
        console.error(`❌ No user data found for clerk_id: ${userId}`);
        return NextResponse.json({ error: `User not found with clerk_id: ${userId}` }, { status: 404 });
      }

      const user = userData[0];
      console.log(`✅ Found user:`, user);

      // Update the shopping item completion status
      const { data: updatedItem, error: itemError } = await supabase
        .from('shopping_items')
        .update({
          completed: true,
          completed_by: userId,
          completed_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .select()
        .single();

      if (itemError) {
        console.error(`❌ Error updating shopping item:`, itemError);
        return NextResponse.json({ error: `Failed to update shopping item: ${itemError.message}` }, { status: 500 });
      }

      // Update user XP and coins
      const currentXp = user?.xp ?? 0;
      const currentCoins = user?.coins ?? 0;
      const newXp = currentXp + 10;
      const newCoins = currentCoins + 1;
      
      console.log(`💰 Updating user rewards: XP ${currentXp} → ${newXp}, Coins ${currentCoins} → ${newCoins}`);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({
          xp: newXp,
          coins: newCoins
        })
        .eq('clerk_id', userId);

      if (updateError) {
        console.error(`❌ Error updating user rewards:`, updateError);
        return NextResponse.json({ error: `Failed to update user rewards: ${updateError.message}` }, { status: 500 });
      }

      console.log(`✅ Successfully completed shopping item and awarded rewards`);
      return NextResponse.json({ success: true, item: updatedItem });
    } else {
      // Uncomplete the item (no rewards)
      const { data: updatedItem, error: itemError } = await supabase
        .from('shopping_items')
        .update({
          completed: false,
          completed_by: null,
          completed_at: null
        })
        .eq('id', itemId)
        .select()
        .single();

      if (itemError) {
        console.error(`❌ Error uncompleting shopping item:`, itemError);
        return NextResponse.json({ error: `Failed to uncomplete shopping item: ${itemError.message}` }, { status: 500 });
      }

      console.log(`✅ Successfully uncompleted shopping item`);
      return NextResponse.json({ success: true, item: updatedItem });
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 