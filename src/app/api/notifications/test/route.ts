import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    // Sample notifications for different scenarios
    const sampleNotifications = [
      {
        title: '🏠 Welcome to Home Management!',
        body: 'Your notifications are working perfectly. Start managing your household with ease!',
        tag: 'welcome',
        url: '/dashboard'
      },
      {
        title: '✅ Chore Reminder',
        body: 'Don\'t forget to take out the trash today!',
        tag: 'chore-reminder',
        url: '/chores'
      },
      {
        title: '🍽️ Meal Planning',
        body: 'Time to plan your meals for this week.',
        tag: 'meal-planning',
        url: '/meal-planner'
      },
      {
        title: '🛒 Shopping List',
        body: 'You have 5 items on your shopping list.',
        tag: 'shopping',
        url: '/shopping-lists'
      },
      {
        title: '🎉 Achievement Unlocked!',
        body: 'You\'ve completed 10 chores this week. Great job!',
        tag: 'achievement',
        url: '/rewards'
      }
    ];

    // Pick a random notification
    const randomNotification = sampleNotifications[Math.floor(Math.random() * sampleNotifications.length)];

    // Send the notification using our send endpoint
    const response = await fetch(`${request.nextUrl.origin}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || '',
      },
      body: JSON.stringify({
        ...randomNotification,
        recipients: 'self'
      }),
    });

    if (!response.ok) {
      throw new ServerError('Failed to send test notification', 500);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Test notification sent!',
      notification: randomNotification,
      result
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
