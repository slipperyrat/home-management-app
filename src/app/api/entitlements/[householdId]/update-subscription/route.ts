import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuth } from '@clerk/nextjs/server';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const UpdateSubscriptionSchema = z.object({
  householdId: z.string().uuid(),
  tier: z.enum(['free', 'pro']),
  stripeSubscriptionId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const body = await request.json();
    const { householdId } = UpdateSubscriptionSchema.parse({ 
      householdId: (await params).householdId,
      ...body 
    });
    
    // Get user and verify household access
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Verify user has access to this household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id, role')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 });
    }
    
    // Only owners and admins can update subscriptions
    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Call the update_entitlements_for_subscription function
    const { error } = await supabase.rpc('update_entitlements_for_subscription', {
      p_household_id: householdId,
      p_tier: body.tier,
      p_stripe_subscription_id: body.stripeSubscriptionId || null
    });
    
    if (error) {
      console.error('Error updating entitlements:', error);
      return NextResponse.json({ error: 'Failed to update entitlements' }, { status: 500 });
    }
    
    // Log the subscription change for audit
    await supabase
      .from('audit_log')
      .insert({
        actor_id: userId,
        household_id: householdId,
        action: 'subscription.change',
        target_table: 'entitlements',
        target_id: householdId,
        meta: {
          old_tier: 'unknown', // Could be fetched from previous state
          new_tier: body.tier,
          stripe_subscription_id: body.stripeSubscriptionId
        }
      });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/entitlements/[householdId]/update-subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
