import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

const NotificationSettingsSchema = z.object({
  settings: z.object({
    choreReminders: z.boolean(),
    mealPlanningReminders: z.boolean(),
    shoppingListUpdates: z.boolean(),
    achievementNotifications: z.boolean(),
    householdUpdates: z.boolean(),
  })
});

// GET - Fetch user's notification settings
export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      console.log('❌ No userId found in auth()');
      throw new ServerError('Unauthorized', 401);
    }
    
    console.log('✅ Fetching notification settings for user:', userId);

    const { data, error } = await sb()
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching notification settings:', error);
      throw new ServerError('Failed to fetch settings', 500);
    }

    // Return default settings if none exist
    const defaultSettings = {
      choreReminders: true,
      mealPlanningReminders: true,
      shoppingListUpdates: true,
      achievementNotifications: true,
      householdUpdates: true,
    };

    return NextResponse.json({
      success: true,
      settings: data?.settings || defaultSettings
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}

// POST - Update user's notification settings
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = NotificationSettingsSchema.parse(body);
    const { settings } = validatedData;

    // Upsert the settings
    const { error } = await sb()
      .from('notification_settings')
      .upsert({
        user_id: userId,
        settings,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving notification settings:', error);
      throw new ServerError('Failed to save settings', 500);
    }

    console.log(`✅ Updated notification settings for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
