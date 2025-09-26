import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { canAccessFeatureFromEntitlements } from '@/lib/server/canAccessFeature';
import { DigestDataService } from '@/lib/digestDataService';
import { EmailService } from '@/lib/emailService';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TestDigestSchema = z.object({
  type: z.enum(['daily', 'weekly']),
});

/**
 * Send test digest email to current user
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type } = TestDigestSchema.parse(body);

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        household_id
      `)
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('User not found:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get household data separately
    let householdName = 'Household';
    if (userData.household_id) {
      const { data: householdData } = await supabase
        .from('households')
        .select('name')
        .eq('id', userData.household_id)
        .single();
      
      if (householdData) {
        householdName = householdData.name;
      }
    }

    if (!userData.household_id) {
      return NextResponse.json({ error: 'User not in a household' }, { status: 400 });
    }

    // Check entitlements for digest feature
    const { data: entitlements, error: entitlementsError } = await supabase
      .from('entitlements')
      .select('*')
      .eq('household_id', userData.household_id)
      .single();

    if (entitlementsError || !entitlements) {
      console.error('Entitlements not found:', entitlementsError);
      return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
    }

    if (!canAccessFeatureFromEntitlements(entitlements, 'digest_max_per_day')) {
      return NextResponse.json({ 
        error: 'Daily digest requires Pro plan',
        code: 'UPGRADE_REQUIRED'
      }, { status: 403 });
    }

    // Collect digest data
    const digestData = type === 'daily' 
      ? await DigestDataService.collectDailyDigestData(
          userData.household_id,
          userData.id,
          userData.email,
          'User', // Fallback since name column doesn't exist
          householdName
        )
      : await DigestDataService.collectWeeklyDigestData(
          userData.household_id,
          userData.id,
          userData.email,
          'User', // Fallback since name column doesn't exist
          householdName
        );

    // Send test email
    const emailResult = type === 'daily'
      ? await EmailService.sendDailyDigest(digestData)
      : await EmailService.sendWeeklyDigest(digestData);

    if (!emailResult.success) {
      console.error('Email sending failed:', emailResult.error);
      return NextResponse.json({ 
        error: 'Failed to send test digest',
        details: emailResult.error
      }, { status: 500 });
    }

    // Log the test digest for audit
    try {
      await supabase
        .from('audit_log')
        .insert({
          actor_id: userId,
          household_id: userData.household_id,
          action: 'digest.test',
          target_table: 'daily_digests',
          meta: {
            digest_type: type,
            test_email: true,
            message_id: emailResult.messageId
          }
        });
    } catch (auditError) {
      console.error('Failed to log audit:', auditError);
      // Don't fail the request for audit errors
    }

    return NextResponse.json({
      success: true,
      message: `Test ${type} digest sent successfully to ${userData.email}`,
      message_id: emailResult.messageId
    });

  } catch (error) {
    console.error('Error sending test digest:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}