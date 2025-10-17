import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = SubscribeSchema.parse(body);
    const { endpoint, keys } = validatedData;

    // Check if subscription already exists
    const { data: existing } = await sb()
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .single();

    if (existing) {
      // Update existing subscription
      const { error: updateError } = await sb()
        .from('push_subscriptions')
        .update({
          auth_key: keys.auth,
          p256dh_key: keys.p256dh,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        throw new ServerError('Failed to update subscription', 500);
      }

      console.log(`✅ Updated push subscription for user: ${userId}`);
    } else {
      // Create new subscription
      const { error: insertError } = await sb()
        .from('push_subscriptions')
        .insert({
          user_id: userId,
          endpoint,
          auth_key: keys.auth,
          p256dh_key: keys.p256dh,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error creating subscription:', insertError);
        throw new ServerError('Failed to create subscription', 500);
      }

      console.log(`✅ Created push subscription for user: ${userId}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription saved successfully',
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
