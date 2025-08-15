import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import webpush from 'web-push';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

// Configure web-push
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const SendNotificationSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
  icon: z.string().optional(),
  badge: z.string().optional(),
  tag: z.string().optional(),
  url: z.string().optional(),
  recipients: z.enum(['self', 'household']).default('self'),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = SendNotificationSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid request body',
        details: validationResult.error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      }, { status: 400 });
    }

    const body = validationResult.data;

    // Get household ID from household_members table
    const { data: householdData, error: householdError } = await sb()
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();

    if (householdError || !householdData) {
      throw new ServerError('Household not found', 404);
    }

    const householdId = householdData.household_id;
    const { title, body: notificationBody, icon, badge, tag, url, recipients } = body;

    // Determine who to send notifications to
    let targetUserIds = [userId];
    
    if (recipients === 'household') {
      // Get all users in the household
      const { data: householdMembers, error } = await sb()
        .from('household_members')
        .select('user_id')
        .eq('household_id', householdId);

      if (error) {
        throw new ServerError('Failed to fetch household members', 500);
      }

      targetUserIds = householdMembers.map(member => member.user_id);
    }

    // Get push subscriptions for target users
    const { data: subscriptions, error: subscriptionsError } = await sb()
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (subscriptionsError) {
      throw new ServerError('Failed to fetch subscriptions', 500);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active subscriptions found'
      });
    }

    // Prepare notification payload
    const notificationPayload = {
      title,
      body: notificationBody,
      icon: icon || '/icons/icon-192x192.png',
      badge: badge || '/icons/icon-72x72.png',
      tag: tag || 'home-management',
      url: url || '/',
      timestamp: Date.now(),
      requireInteraction: false,
      silent: false,
    };

    // Send notifications
    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key,
          },
        };

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(notificationPayload)
        );

        console.log(`✅ Notification sent to user: ${subscription.user_id}`);
        return { success: true, userId: subscription.user_id };
      } catch (error) {
        console.error(`❌ Failed to send notification to user: ${subscription.user_id}`, error);
        
        // If subscription is invalid, remove it from database
        if (error instanceof Error && error.message.includes('410')) {
          await sb()
            .from('push_subscriptions')
            .delete()
            .eq('user_id', subscription.user_id);
        }
        
        return { success: false, userId: subscription.user_id, error };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`📊 Notification results: ${successCount} sent, ${failureCount} failed`);

    return NextResponse.json({
      success: true,
      message: `Notifications sent: ${successCount} successful, ${failureCount} failed`,
      results: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      }
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
