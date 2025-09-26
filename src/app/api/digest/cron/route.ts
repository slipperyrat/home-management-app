import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DigestDataService } from '@/lib/digestDataService';
import { EmailService } from '@/lib/emailService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Cron job for sending daily and weekly digests
 * This should be called by a cron service every hour
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting digest cron job...');

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const today = now.toISOString().split('T')[0];

    // Get all households with active digest preferences
    const { data: households, error: householdsError } = await supabase
      .from('households')
      .select(`
        id,
        name,
        entitlements!households_id_fkey(
          tier,
          digest_max_per_day,
          daily_digests_enabled
        )
      `)
      .eq('entitlements.tier', 'pro')
      .eq('entitlements.daily_digests_enabled', true);

    if (householdsError) {
      console.error('Error fetching households:', householdsError);
      return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 });
    }

    if (!households || households.length === 0) {
      console.log('ℹ️ No households with digest enabled found');
      return NextResponse.json({ 
        success: true, 
        message: 'No households to process',
        processed: 0 
      });
    }

    let totalProcessed = 0;
    let dailyDigestsSent = 0;
    let weeklyDigestsSent = 0;
    const errors: string[] = [];

    // Process each household
    for (const household of households) {
      try {
        console.log(`📧 Processing digests for household ${household.id}`);

        // Get digest preferences for this household
        const { data: preferences, error: prefsError } = await supabase
          .from('digest_preferences')
          .select('*')
          .eq('household_id', household.id)
          .eq('daily_digest_enabled', true)
          .single();

        if (prefsError || !preferences) {
          console.log(`⚠️ No digest preferences found for household ${household.id}, skipping`);
          continue;
        }

        // Check if it's time for daily digest
        const dailyDigestHour = parseInt(preferences.daily_digest_time.split(':')[0]);
        if (currentHour === dailyDigestHour) {
          // Check if daily digest was already sent today
          const { data: todayDigests } = await supabase
            .from('daily_digests')
            .select('id')
            .eq('household_id', household.id)
            .eq('digest_date', today)
            .eq('digest_type', 'daily');

          if (!todayDigests || todayDigests.length === 0) {
            // Check quota
            const entitlements = household.entitlements;
            if (!entitlements || todayDigests.length >= entitlements.digest_max_per_day) {
              console.log(`⚠️ Daily digest quota exceeded for household ${household.id}, skipping`);
              continue;
            }

            // Send daily digest
            await sendDigestToHousehold(household.id, household.name, 'daily', preferences);
            dailyDigestsSent++;
          }
        }

        // Check if it's time for weekly digest
        if (preferences.weekly_digest_enabled) {
          const weeklyDigestDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(preferences.weekly_digest_day);
          const weeklyDigestHour = parseInt(preferences.weekly_digest_time.split(':')[0]);
          
          if (currentDay === weeklyDigestDay && currentHour === weeklyDigestHour) {
            // Check if weekly digest was already sent this week
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            const weekStart = startOfWeek.toISOString().split('T')[0];

            const { data: weekDigests } = await supabase
              .from('daily_digests')
              .select('id')
              .eq('household_id', household.id)
              .eq('digest_date', weekStart)
              .eq('digest_type', 'weekly');

            if (!weekDigests || weekDigests.length === 0) {
              // Send weekly digest
              await sendDigestToHousehold(household.id, household.name, 'weekly', preferences);
              weeklyDigestsSent++;
            }
          }
        }

        totalProcessed++;

      } catch (error) {
        console.error(`Error processing household ${household.id}:`, error);
        errors.push(`Household ${household.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`🎉 Digest cron completed: ${totalProcessed} households processed, ${dailyDigestsSent} daily digests sent, ${weeklyDigestsSent} weekly digests sent`);

    return NextResponse.json({
      success: true,
      message: 'Digest cron completed',
      stats: {
        households_processed: totalProcessed,
        daily_digests_sent: dailyDigestsSent,
        weekly_digests_sent: weeklyDigestsSent,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in digest cron job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Send digest to all members of a household
 */
async function sendDigestToHousehold(
  householdId: string, 
  householdName: string, 
  type: 'daily' | 'weekly',
  preferences: any
) {
  try {
    // Get all household members
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select(`
        user_id,
        users!household_members_user_id_fkey(id, email, name)
      `)
      .eq('household_id', householdId);

    if (membersError || !members) {
      throw new Error('Failed to fetch household members');
    }

    const users = members
      .map(member => member.users)
      .filter(user => user && user.email);

    if (users.length === 0) {
      throw new Error('No users found in household');
    }

    // Send digest to each user
    for (const user of users) {
      try {
        // Collect digest data
        const digestData = type === 'daily' 
          ? await DigestDataService.collectDailyDigestData(
              householdId,
              user.id,
              user.email,
              user.name || 'User',
              householdName
            )
          : await DigestDataService.collectWeeklyDigestData(
              householdId,
              user.id,
              user.email,
              user.name || 'User',
              householdName
            );

        // Send email
        const emailResult = type === 'daily'
          ? await EmailService.sendDailyDigest(digestData)
          : await EmailService.sendWeeklyDigest(digestData);

        if (emailResult.success) {
          // Log successful digest
          await supabase
            .from('daily_digests')
            .insert({
              household_id: householdId,
              user_id: user.id,
              digest_type: type,
              digest_date: new Date().toISOString().split('T')[0],
              email_sent: true,
              message_id: emailResult.messageId,
              created_at: new Date().toISOString()
            });

          console.log(`✅ ${type} digest sent to ${user.email}`);
        } else {
          console.error(`❌ Failed to send ${type} digest to ${user.email}:`, emailResult.error);
        }
      } catch (error) {
        console.error(`Error sending ${type} digest to user ${user.id}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error sending ${type} digest to household ${householdId}:`, error);
    throw error;
  }
}
