import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { notificationSendSchema } from '@/lib/validation/schemas';
import webpush from 'web-push';

// Configure web-push
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 POST: Sending notification for user:', user.id);

      // Parse and validate request body using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        const tempSchema = notificationSendSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
      } catch (validationError: any) {
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      const { title, body: notificationBody, user_id: targetUserId } = validatedData;

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const householdId = household.id;

      // Determine who to send notifications to
      let targetUserIds = [user.id];
      
      if (targetUserId) {
        targetUserIds = [targetUserId];
      } else if (householdId) {
        // Get all users in the household
        const supabase = getDatabaseClient();
        const { data: householdMembers, error } = await supabase
          .from('household_members')
          .select('user_id')
          .eq('household_id', householdId);

        if (error) {
          return createErrorResponse('Failed to fetch household members', 500, error.message);
        }

        targetUserIds = householdMembers.map(member => member.user_id);
      }

      // Get push subscriptions for target users
      const supabase = getDatabaseClient();
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .in('user_id', targetUserIds);

      if (subscriptionsError) {
        return createErrorResponse('Failed to fetch subscriptions', 500, subscriptionsError.message);
      }

      if (!subscriptions || subscriptions.length === 0) {
        return createSuccessResponse({
          success: false,
          message: 'No active subscriptions found'
        }, 'No subscriptions found');
      }

      // Prepare notification payload
      const notificationPayload = {
        title,
        body: notificationBody,
        icon: '/icons/icon-192x192.png', // Default icon
        badge: '/icons/icon-72x72.png', // Default badge
        tag: 'home-management', // Default tag
        url: '/', // Default URL
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
            await supabase
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

      // Create audit log
      await createAuditLog({
        user_id: user.id,
        household_id: household.id,
        action: 'notification_sent',
        details: { 
          title, 
          body: notificationBody, 
          target_users: targetUserIds,
          results: { total: results.length, successful: successCount, failed: failureCount }
        }
      });

      return createSuccessResponse({
        message: `Notifications sent: ${successCount} successful, ${failureCount} failed`,
        results: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
        }
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      return handleApiError(error);
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
