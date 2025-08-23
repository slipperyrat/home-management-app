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

    // Parse and validate input
    let body;
    try {
      body = await request.json();
      console.log('📥 Received request body:', body);
    } catch (parseError) {
      return NextResponse.json({ 
        error: 'Invalid JSON in request body', 
        details: 'Failed to parse request body' 
      }, { status: 400 });
    }

    // Check for required fields
    if (!body.itemId) {
      return NextResponse.json({ 
        error: 'Missing required field: itemId', 
        details: 'Request must include itemId' 
      }, { status: 400 });
    }

    const itemId = body.itemId;
    // For now, assume we're toggling to complete (true)
    // In the future, we can add logic to determine the target state
    const is_complete = true;

    console.log(`🔄 API: Toggling shopping item ${itemId} for user ${userId} to ${is_complete}`);

    // First get the current item to check its completion status and household
    const { data: currentItem, error: fetchError } = await supabase
      .from('shopping_items')
      .select(`
        completed,
        shopping_lists!inner(household_id)
      `)
      .eq('id', itemId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching shopping item:', fetchError);
      return NextResponse.json({ error: `Failed to fetch shopping item: ${fetchError.message}` }, { status: 500 });
    }

    console.log(`📦 Current item completion status:`, currentItem);

    // Check if item was previously incomplete (to award rewards only once)
    const wasIncomplete = !currentItem.completed;
    // Fix: Access household_id correctly from the joined shopping_lists
    const householdId = (currentItem.shopping_lists as any)?.household_id;

    if (!householdId) {
      console.error('❌ No household_id found for shopping item');
      return NextResponse.json({ error: 'Shopping item not associated with a household' }, { status: 400 });
    }

    console.log(`🔄 Item was incomplete: ${wasIncomplete}, household: ${householdId}`);

    if (is_complete && wasIncomplete) {
      // Complete the item and award rewards
      console.log(`🎁 Awarding rewards for completing item`);
      
      // First, get the current user's XP and coins
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('xp, coins')
        .eq('id', userId);

      console.log(`👤 User data query result:`, { userData, userError });

      if (userError) {
        console.error(`❌ Error fetching user data:`, userError);
        return NextResponse.json({ error: `Failed to fetch user data: ${userError.message}` }, { status: 500 });
      }

      if (!userData || userData.length === 0) {
        console.error(`❌ No user data found for id: ${userId}`);
        return NextResponse.json({ error: `User not found with id: ${userId}` }, { status: 404 });
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
        .eq('id', userId);

      if (updateError) {
        console.error(`❌ Error updating user rewards:`, updateError);
        return NextResponse.json({ error: `Failed to update user rewards: ${updateError.message}` }, { status: 500 });
      }

      // Add audit log entry for completion
      try {
        await supabase.rpc('add_audit_log', {
          p_action: 'shopping_item.completed',
          p_target_table: 'shopping_items',
          p_target_id: itemId,
          p_meta: { 
            household_id: householdId,
            xp_awarded: 10,
            coins_awarded: 1,
            previous_status: false
          }
        });
      } catch (auditError) {
        console.warn('Failed to add audit log:', auditError);
        // Don't fail the request if audit logging fails
      }

      console.log(`✅ Successfully completed shopping item and awarded rewards`);
      return NextResponse.json({ 
        success: true, 
        item: updatedItem,
        rewards: { xp: 10, coins: 1 }
      });
    } else {
      // Toggle the item to the requested state
      const { data: updatedItem, error: itemError } = await supabase
        .from('shopping_items')
        .update({
          completed: is_complete,
          completed_by: is_complete ? userId : null,
          completed_at: is_complete ? new Date().toISOString() : null
        })
        .eq('id', itemId)
        .select()
        .single();

      if (itemError) {
        console.error(`❌ Error updating shopping item:`, itemError);
        return NextResponse.json({ error: `Failed to update shopping item: ${itemError.message}` }, { status: 500 });
      }

      // Add audit log entry for status change
      try {
        await supabase.rpc('add_audit_log', {
          p_action: is_complete ? 'shopping_item.completed' : 'shopping_item.uncompleted',
          p_target_table: 'shopping_items',
          p_target_id: itemId,
          p_meta: { 
            household_id: householdId,
            previous_status: !is_complete,
            new_status: is_complete
          }
        });
      } catch (auditError) {
        console.warn('Failed to add audit log:', auditError);
        // Don't fail the request if audit logging fails
      }

      console.log(`✅ Successfully ${is_complete ? 'completed' : 'uncompleted'} shopping item`);
      return NextResponse.json({ success: true, item: updatedItem });
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 