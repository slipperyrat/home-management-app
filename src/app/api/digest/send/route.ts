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

const SendDigestSchema = z.object({
  household_id: z.string().uuid(),
  type: z.enum(['daily', 'weekly']),
  user_id: z.string().optional(), // Optional - if not provided, send to all users in household
});

/**
 * Send digest email to household members
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Digest send API called');
    const { userId } = await getAuth(request);
    console.log('🔍 Auth result:', { userId });
    
    if (!userId) {
      console.log('❌ No userId found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { household_id, type, user_id } = SendDigestSchema.parse(body);

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

    // Check entitlements for digest feature
    const { data: entitlements, error: entitlementsError } = await supabase
      .from('entitlements')
      .select('*')
      .eq('household_id', household_id)
      .single();

    if (entitlementsError || !entitlements) {
      return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
    }

    if (!canAccessFeatureFromEntitlements(entitlements, 'digest_max_per_day')) {
      return NextResponse.json({ 
        error: 'Daily digest requires Pro plan',
        code: 'UPGRADE_REQUIRED'
      }, { status: 403 });
    }

    // Get household info
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('name')
      .eq('id', household_id)
      .single();

    if (householdError || !household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    // Get users to send digest to
    let targetUsers;
    if (user_id) {
      // Send to specific user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', user_id)
        .single();

      if (userError || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Verify user is in the household
      const { data: membership, error: membershipError } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('user_id', user_id)
        .eq('household_id', household_id)
        .single();

      if (membershipError || !membership) {
        return NextResponse.json({ error: 'User not in household' }, { status: 404 });
      }

      targetUsers = [user];
    } else {
      // Send to all household members
      const { data: members, error: membersError } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', household_id);

      if (membersError || !members) {
        return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
      }

      // Get user details for each member
      const userIds = members.map(member => member.user_id);
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email')
        .in('id', userIds);

      if (usersError || !users) {
        return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
      }

      targetUsers = users.filter(user => user && user.email);
    }

    if (targetUsers.length === 0) {
      return NextResponse.json({ error: 'No users found to send digest to' }, { status: 400 });
    }

    // Check daily digest quota
    if (type === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      const { data: todayDigests } = await supabase
        .from('daily_digests')
        .select('id')
        .eq('household_id', household_id)
        .eq('digest_date', today);

      if (todayDigests && todayDigests.length >= entitlements.digest_max_per_day) {
        return NextResponse.json({ 
          error: 'Daily digest quota exceeded',
          code: 'QUOTA_EXCEEDED'
        }, { status: 429 });
      }
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Send digest to each user
    for (const user of targetUsers) {
      try {
        // Collect digest data
        const digestData = type === 'daily' 
          ? await DigestDataService.collectDailyDigestData(
              household_id,
              user.id,
              user.email,
              'User', // Fallback since name column doesn't exist
              household.name
            )
          : await DigestDataService.collectWeeklyDigestData(
              household_id,
              user.id,
              user.email,
              'User', // Fallback since name column doesn't exist
              household.name
            );

        // Send email
        const emailResult = type === 'daily'
          ? await EmailService.sendDailyDigest(digestData)
          : await EmailService.sendWeeklyDigest(digestData);

        if (emailResult.success) {
          successCount++;
          
          // Log successful digest (only for daily digests, and only once per household per day)
          if (type === 'daily') {
            const today = new Date().toISOString().split('T')[0];
            await supabase
              .from('daily_digests')
              .upsert({
                household_id,
                digest_date: today,
                sent_at: new Date().toISOString(),
                content: {
                  type: 'daily',
                  user_count: targetUsers.length,
                  message_id: emailResult.messageId
                },
                status: 'sent'
              }, {
                onConflict: 'household_id,digest_date'
              });
          }

          results.push({
            user_id: user.id,
            email: user.email,
            success: true,
            message_id: emailResult.messageId
          });
        } else {
          errorCount++;
          
          // Log failed digest
          if (type === 'daily') {
            const today = new Date().toISOString().split('T')[0];
            await supabase
              .from('daily_digests')
              .upsert({
                household_id,
                digest_date: today,
                sent_at: new Date().toISOString(),
                content: {
                  type: 'daily',
                  user_count: targetUsers.length,
                  error: emailResult.error
                },
                status: 'failed',
                error_message: emailResult.error
              }, {
                onConflict: 'household_id,digest_date'
              });
          }
          
          results.push({
            user_id: user.id,
            email: user.email,
            success: false,
            error: emailResult.error
          });
        }
      } catch (error) {
        errorCount++;
        console.error(`Error sending digest to user ${user.id}:`, error);
        results.push({
          user_id: user.id,
          email: user.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log the digest sending for audit
    await supabase
      .from('audit_log')
      .insert({
        actor_id: userId,
        household_id,
        action: 'digest.send',
        target_table: 'daily_digests',
        meta: {
          digest_type: type,
          total_users: targetUsers.length,
          success_count: successCount,
          error_count: errorCount,
          results
        }
      });

    return NextResponse.json({
      success: true,
      message: `Digest sent to ${successCount} users`,
      stats: {
        total_users: targetUsers.length,
        success_count: successCount,
        error_count: errorCount
      },
      results
    });

  } catch (error) {
    console.error('Error sending digest:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
