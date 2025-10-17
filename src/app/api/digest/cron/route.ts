import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DigestDataService } from '@/lib/digestDataService';
import { EmailService } from '@/lib/emailService';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/supabase.generated';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey);

type EntitlementRow = Database['public']['Tables']['entitlements']['Row'];
type HouseholdRow = Pick<Database['public']['Tables']['households']['Row'], 'id' | 'name'>;
type HouseholdMemberWithUser = {
  user_id: string;
  users: Pick<Database['public']['Tables']['users']['Row'], 'id' | 'email' | 'first_name' | 'last_name'> | null;
};

type HouseholdMemberUser = NonNullable<HouseholdMemberWithUser['users']>;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting digest cron job');

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    const today = now.toISOString().slice(0, 10);

    const { data: entitlementRows, error: entitlementsError } = await supabase
      .from('entitlements')
      .select('*')
      .gt('digest_max_per_day', 0);

    if (entitlementsError) {
      logger.error('Error fetching entitlements for digest cron', entitlementsError);
      return NextResponse.json({ error: 'Failed to fetch entitlements' }, { status: 500 });
    }

    const householdIds = (entitlementRows ?? []).map((row) => row.household_id);

    const { data: householdRows, error: householdsError } = householdIds.length > 0
      ? await supabase
        .from('households')
        .select('id, name')
        .in('id', householdIds)
      : { data: [], error: null } as { data: HouseholdRow[]; error: null };

    if (householdsError) {
      logger.error('Error fetching households for digest cron', householdsError);
      return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 });
    }

    const householdMap = new Map<string, HouseholdRow>();
    for (const household of householdRows ?? []) {
      householdMap.set(household.id, household);
    }

    const eligibleEntries: Array<{ entitlement: EntitlementRow; household: HouseholdRow | null }> = (entitlementRows ?? [])
      .map((entitlement) => ({
        entitlement,
        household: householdMap.get(entitlement.household_id) ?? null,
      }))
      .filter((entry) => entry.entitlement.digest_max_per_day > 0);

    if (eligibleEntries.length === 0) {
      logger.info('No households with digest enabled found');
      return NextResponse.json({
        success: true,
        message: 'No households to process',
        processed: 0,
      });
    }

    let totalProcessed = 0;
    let dailyDigestsSent = 0;
    let weeklyDigestsSent = 0;
    const errors: string[] = [];

    for (const entry of eligibleEntries) {
      const { entitlement, household } = entry;
      const householdId = entitlement.household_id;
      const householdName = household?.name ?? 'Household';

      try {
        logger.info('Processing household digests', { householdId });

        const { data: preferences, error: prefsError } = await supabase
          .from('digest_preferences')
          .select('*')
          .eq('household_id', householdId)
          .eq('daily_digest_enabled', true)
          .maybeSingle<Database['public']['Tables']['digest_preferences']['Row']>();

        if (prefsError || !preferences) {
          logger.warn('No digest preferences found for household; skipping', { householdId });
          continue;
        }

        const dailyDigestHour = safeParseHour(preferences.daily_digest_time);
        if (dailyDigestHour !== null && currentHour === dailyDigestHour) {
          const { data: todayDigests } = await supabase
            .from('daily_digests')
            .select('id')
            .eq('household_id', householdId)
            .eq('digest_date', today)
            .eq('digest_type', 'daily');

          const dailyCount = todayDigests?.length ?? 0;
          if (dailyCount === 0 && dailyCount < entitlement.digest_max_per_day) {
            await sendDigestToHousehold(householdId, householdName, 'daily');
            dailyDigestsSent++;
          } else if (dailyCount >= entitlement.digest_max_per_day) {
            logger.warn('Daily digest quota exceeded; skipping household', { householdId });
          }
        }

        if (preferences.weekly_digest_enabled) {
          const weeklyDigestDay = safeParseWeekday(preferences.weekly_digest_day);
          const weeklyDigestHour = safeParseHour(preferences.weekly_digest_time);

          if (weeklyDigestDay !== null && weeklyDigestHour !== null && currentDay === weeklyDigestDay && currentHour === weeklyDigestHour) {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            const weekStart = startOfWeek.toISOString().slice(0, 10);

            const { data: weekDigests } = await supabase
              .from('daily_digests')
              .select('id')
              .eq('household_id', householdId)
              .eq('digest_date', weekStart)
              .eq('digest_type', 'weekly');

            if (!weekDigests || weekDigests.length === 0) {
              await sendDigestToHousehold(householdId, householdName, 'weekly');
              weeklyDigestsSent++;
            }
          }
        }

        totalProcessed++;
      } catch (error) {
        logger.error('Error processing household for digest cron', error instanceof Error ? error : new Error(String(error)), {
          householdId,
        });
        errors.push(`Household ${householdId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    logger.info('Digest cron completed', {
      householdsProcessed: totalProcessed,
      dailyDigestsSent,
      weeklyDigestsSent,
      errorCount: errors.length,
    });

    return NextResponse.json({
      success: true,
      message: 'Digest cron completed',
      stats: {
        households_processed: totalProcessed,
        daily_digests_sent: dailyDigestsSent,
        weekly_digests_sent: weeklyDigestsSent,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('Error in digest cron job', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendDigestToHousehold(
  householdId: string,
  householdName: string | null,
  type: 'daily' | 'weekly',
) {
  try {
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select(
        `
        user_id,
        users:users!household_members_user_id_fkey(id, email, first_name, last_name)
      `,
      )
      .eq('household_id', householdId);

    if (membersError || !members) {
      throw new Error('Failed to fetch household members');
    }

    const rawMembers = (members ?? []) as Array<{ user_id: string; users: unknown }>;

    const typedMembers: HouseholdMemberWithUser[] = rawMembers.map((member) => {
      const userRecord = member.users;
      if (userRecord && typeof userRecord === 'object' && 'id' in userRecord) {
        return {
          user_id: member.user_id,
          users: userRecord as HouseholdMemberUser,
        };
      }
      return {
        user_id: member.user_id,
        users: null,
      };
    });

    const users = typedMembers
      .map((member) => member.users)
      .filter((user): user is HouseholdMemberUser => Boolean(user?.email));

    if (users.length === 0) {
      throw new Error('No users found in household');
    }

    for (const user of users) {
      try {
        const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
        const digestData = type === 'daily'
          ? await DigestDataService.collectDailyDigestData(
              householdId,
              user.id,
              user.email ?? '',
              userName,
              householdName ?? 'Household',
            )
          : await DigestDataService.collectWeeklyDigestData(
              householdId,
              user.id,
              user.email ?? '',
              userName,
              householdName ?? 'Household',
            );

        const emailResult = type === 'daily'
          ? await EmailService.sendDailyDigest(digestData)
          : await EmailService.sendWeeklyDigest(digestData);

        const digestDate = new Date().toISOString().slice(0, 10);

        if (emailResult.success) {
          const insertPayload: Database['public']['Tables']['daily_digests']['Insert'] = {
            household_id: householdId,
            digest_date: digestDate,
            status: 'sent',
            sent_at: new Date().toISOString(),
          };

          await supabase.from('daily_digests').insert(insertPayload);

          logger.info('Digest email sent', { type, userId: user.id, email: user.email, householdId });
        } else {
          const emailErrorMessage = typeof emailResult.error === 'string'
            ? emailResult.error
            : 'Unknown error';
          const emailError = new Error(emailErrorMessage);
          logger.error('Failed to send digest email', emailError, {
            type,
            userId: user.id,
            email: user.email,
            householdId,
          });
        }
      } catch (error) {
        logger.error('Error sending digest email to user', error instanceof Error ? error : new Error(String(error)), {
          type,
          userId: user.id,
          householdId,
        });
      }
    }
  } catch (error) {
    logger.error('Error sending digest emails for household', error instanceof Error ? error : new Error(String(error)), {
      householdId,
      type,
    });
    throw error;
  }
}

function safeParseHour(time: string | null | undefined): number | null {
  if (!time) {
    return null;
  }
  const hourString = time.split(':')[0];
  const hour = hourString ? Number.parseInt(hourString, 10) : Number.NaN;
  return Number.isNaN(hour) ? null : hour;
}

function safeParseWeekday(day: string | null | undefined): number | null {
  if (!day) {
    return null;
  }
  const index = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(day.toLowerCase());
  return index >= 0 ? index : null;
}
