import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getGoogleAuthUrl } from '@/lib/googleCalendar';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const AuthRequestSchema = z.object({
  household_id: z.string().uuid(),
});

/**
 * Initiate Google Calendar OAuth flow
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { household_id } = AuthRequestSchema.parse(body);

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id, role')
      .eq('household_id', household_id)
      .eq('user_id', userId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 });
    }

    // Check entitlements for Google Calendar import
    const { data: entitlements, error: entitlementsError } = await supabase
      .from('entitlements')
      .select('google_import, tier')
      .eq('household_id', household_id)
      .single();

    if (entitlementsError || !entitlements) {
      return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
    }

    if (entitlements.tier !== 'pro' || !entitlements.google_import) {
      return NextResponse.json({ 
        error: 'Google Calendar import requires Pro plan',
        code: 'UPGRADE_REQUIRED'
      }, { status: 403 });
    }

    // Generate Google OAuth URL
    const authUrl = getGoogleAuthUrl();

    // Store the household_id in the state parameter for the callback
    const state = Buffer.from(JSON.stringify({ household_id, user_id: userId })).toString('base64');
    const urlWithState = `${authUrl}&state=${state}`;

    return NextResponse.json({
      success: true,
      auth_url: urlWithState
    });

  } catch (error) {
    console.error('Error initiating Google Calendar auth:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
