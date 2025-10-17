import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { notificationSendSchema } from '@/lib/validation/schemas';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      let validatedData;
      try {
        const body = await req.json();
        const tempSchema = notificationSendSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
      } catch (validationError: unknown) {
        return createErrorResponse('Invalid input', 400, validationError instanceof Error ? validationError : undefined);
      }

      const { title, body: notificationBody, user_id: targetUserId } = validatedData;

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const householdId = household.id;

      let targetUserIds = [user.id];

      if (targetUserId) {
        targetUserIds = [targetUserId];
      } else {
        const supabase = getDatabaseClient();
        const { data: householdMembers, error } = await supabase
          .from('household_members')
          .select('user_id')
          .eq('household_id', householdId);

        if (error) {
          return createErrorResponse('Failed to fetch household members', 500, error.message);
        }

        targetUserIds = (householdMembers ?? []).map((member) => member.user_id).filter((id): id is string => Boolean(id));
        if (targetUserIds.length === 0) {
          return createSuccessResponse({ success: false, message: 'No target users found' }, 'No recipients');
        }
      }

      const supabase = getDatabaseClient();
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('push_subscriptions')
        .select('endpoint, auth_key, p256dh_key, user_id')
        .in('user_id', targetUserIds);

      if (subscriptionsError) {
        return createErrorResponse('Failed to fetch subscriptions', 500, subscriptionsError.message);
      }

      if (!subscriptions || subscriptions.length === 0) {
        return createSuccessResponse({
          success: false,
          message: 'No active subscriptions found',
        }, 'No subscriptions found');
      }

      const notificationPayload = {
        title,
        body: notificationBody,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'home-management',
        url: '/',
        timestamp: Date.now(),
        requireInteraction: false,
        silent: false,
      } satisfies Record<string, unknown>;

      const sendPromises = subscriptions.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh_key,
              auth: subscription.auth_key,
            },
          } satisfies webpush.PushSubscription;

          await webpush.sendNotification(pushSubscription, JSON.stringify(notificationPayload));

          return { success: true, userId: subscription.user_id };
        } catch (error) {
          if (error instanceof Error && error.message.includes('410')) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', subscription.user_id)
              .eq('endpoint', subscription.endpoint);
          }

          return { success: false, userId: subscription.user_id, error };
        }
      });

      const results = await Promise.all(sendPromises);
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      await createAuditLog({
        action: 'notification.sent',
        targetTable: 'push_subscriptions',
        targetId: householdId,
        userId: user.id,
        metadata: {
          title,
          body: notificationBody,
          target_users: targetUserIds,
          results: { total: results.length, successful: successCount, failed: failureCount },
        },
      });

      return createSuccessResponse({
        message: `Notifications sent: ${successCount} successful, ${failureCount} failed`,
        results: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
        },
      });
    } catch (error) {
      return handleApiError(error, {
        route: '/api/notifications/send',
        method: 'POST',
        userId: user?.id ?? '',
      });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}
