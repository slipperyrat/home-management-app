import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const syncSettingsSchema = z.object({
  enable_public_sync: z.boolean().optional(),
  include_private_events: z.boolean().optional(),
  sync_token_expiry_days: z.number().min(1).max(365).optional(),
});

/**
 * Get calendar sync settings and generate sync URLs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params for Next.js 15 compatibility
    const { householdId } = await params;

    const supabase = getDatabaseClient();
    
    // Verify user has access to this household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id, role')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userData.household_id !== householdId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get household sync settings
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('id, name, ics_token, ics_token_expires_at, public_sync_enabled')
      .eq('id', householdId)
      .single();

    if (householdError || !household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    // Check if token is expired or doesn't exist
    const now = new Date();
    const tokenExpired = !household.ics_token || 
      (household.ics_token_expires_at && new Date(household.ics_token_expires_at) < now);

    let icsToken = household.ics_token;
    let tokenExpiresAt = household.ics_token_expires_at;

    // Generate new token if expired or doesn't exist
    if (tokenExpired) {
      icsToken = randomBytes(32).toString('hex');
      tokenExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year

      const { error: updateError } = await supabase
        .from('households')
        .update({
          ics_token: icsToken,
          ics_token_expires_at: tokenExpiresAt
        })
        .eq('id', householdId);

      if (updateError) {
        console.error('Error updating ICS token:', updateError);
        return NextResponse.json({ error: 'Failed to generate sync token' }, { status: 500 });
      }
    }

    // Generate sync URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const publicSyncUrl = `${baseUrl}/api/calendars/public/${householdId}/ics?token=${icsToken}`;
    const privateSyncUrl = `${baseUrl}/api/calendars/${householdId}/ics`;

    return NextResponse.json({
      success: true,
      sync_settings: {
        household_id: householdId,
        household_name: household.name,
        public_sync_enabled: household.public_sync_enabled || false,
        ics_token: icsToken,
        token_expires_at: tokenExpiresAt,
        sync_urls: {
          public: publicSyncUrl,
          private: privateSyncUrl
        },
        instructions: {
          google_calendar: `Add calendar by URL: ${publicSyncUrl}`,
          apple_calendar: `Subscribe to calendar: ${publicSyncUrl}`,
          outlook: `Add calendar from web: ${publicSyncUrl}`,
          general: `Use this URL to subscribe to the calendar in any calendar application: ${publicSyncUrl}`
        }
      }
    });

  } catch (error) {
    console.error('Error getting calendar sync settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Update calendar sync settings
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params for Next.js 15 compatibility
    const { householdId } = await params;

    const body = await request.json();
    const validatedData = syncSettingsSchema.parse(body);

    const supabase = getDatabaseClient();
    
    // Verify user has access to this household and is admin/owner
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id, role')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userData.household_id !== householdId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Allow all household members to manage calendar sync settings
    // if (!['owner', 'admin'].includes(userData.role)) {
    //   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    // }

    // Update household sync settings
    const updateData: any = {};
    
    if (validatedData.enable_public_sync !== undefined) {
      updateData.public_sync_enabled = validatedData.enable_public_sync;
    }

    if (validatedData.sync_token_expiry_days) {
      const newExpiryDate = new Date(Date.now() + validatedData.sync_token_expiry_days * 24 * 60 * 60 * 1000);
      updateData.ics_token_expires_at = newExpiryDate.toISOString();
    }

    const { error: updateError } = await supabase
      .from('households')
      .update(updateData)
      .eq('id', householdId);

    if (updateError) {
      console.error('Error updating sync settings:', updateError);
      return NextResponse.json({ error: 'Failed to update sync settings' }, { status: 500 });
    }

    // If enabling public sync, ensure we have a token
    if (validatedData.enable_public_sync) {
      const { data: household, error: fetchError } = await supabase
        .from('households')
        .select('ics_token')
        .eq('id', householdId)
        .single();

      if (!fetchError && (!household.ics_token || household.ics_token.length < 20)) {
        // Generate new token
        const newToken = randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        await supabase
          .from('households')
          .update({
            ics_token: newToken,
            ics_token_expires_at: tokenExpiry
          })
          .eq('id', householdId);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sync settings updated successfully'
    });

  } catch (error) {
    console.error('Error updating calendar sync settings:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Regenerate ICS token
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params for Next.js 15 compatibility
    const { householdId } = await params;

    const supabase = getDatabaseClient();
    
    // Verify user has access to this household and is admin/owner
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id, role')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userData.household_id !== householdId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Allow all household members to manage calendar sync settings
    // if (!['owner', 'admin'].includes(userData.role)) {
    //   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    // }

    // Generate new token
    const newToken = randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('households')
      .update({
        ics_token: newToken,
        ics_token_expires_at: tokenExpiry
      })
      .eq('id', householdId);

    if (updateError) {
      console.error('Error regenerating ICS token:', updateError);
      return NextResponse.json({ error: 'Failed to regenerate token' }, { status: 500 });
    }

    // Generate new sync URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const newSyncUrl = `${baseUrl}/api/calendars/public/${householdId}/ics?token=${newToken}`;

    return NextResponse.json({
      success: true,
      message: 'ICS token regenerated successfully',
      new_sync_url: newSyncUrl
    });

  } catch (error) {
    console.error('Error regenerating ICS token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
