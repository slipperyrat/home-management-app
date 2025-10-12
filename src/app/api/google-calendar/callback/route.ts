import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exchangeCodeForTokens, GoogleCalendarService } from '@/lib/googleCalendar';
import { z } from 'zod';
import { logger } from '@/lib/logging/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CallbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

/**
 * Handle Google Calendar OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { code, state } = CallbackSchema.parse({
      code: searchParams.get('code'),
      state: searchParams.get('state'),
    });

    // Decode state to get household_id and user_id
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString()) as {
      household_id: string;
      user_id: string;
    };
    const { household_id, user_id } = stateData;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Initialize Google Calendar service
    const googleCalendar = new GoogleCalendarService(tokens.access_token);

    // Get user's calendars
    const calendars = await googleCalendar.getCalendarList();

    // Store tokens and calendar info in database
    const { error: insertError } = await supabase
      .from('google_calendar_imports')
      .upsert({
        household_id,
        google_calendar_id: 'primary', // We'll store primary calendar first
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        last_import_at: new Date().toISOString(),
        last_successful_import_at: new Date().toISOString(),
        import_status: 'active',
        calendars: calendars.map(cal => ({
          id: cal.id,
          summary: cal.summary,
          accessRole: cal.accessRole,
          selected: cal.selected || false
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'household_id,google_calendar_id'
      });

    if (insertError) {
      logger.error('Error storing Google Calendar tokens', insertError, {
        householdId: household_id,
        userId: user_id,
      });
      return NextResponse.json({ error: 'Failed to store authentication' }, { status: 500 });
    }

    // Redirect back to the app with success
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/calendar/sync?success=true&calendars=${calendars.length}`;
    
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    logger.error('Error in Google Calendar callback', error instanceof Error ? error : new Error(String(error)));
    
    // Redirect back to the app with error
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/calendar/sync?error=authentication_failed`;
    return NextResponse.redirect(redirectUrl);
  }
}
