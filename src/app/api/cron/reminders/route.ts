import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logging/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

export async function POST() {
  try {
    logger.info('Starting reminder sending process');

    // Get current time in ISO format for timezone-aware comparison
    const now = new Date().toISOString();
    logger.info('Reminder reference time', { now });
    
    // Query reminders that are due and not yet sent
    const { data: reminders, error: fetchError } = await supabase
      .from('reminders')
      .select('*')
      .lte('remind_at', now)
      .eq('is_sent', false)
      .order('remind_at', { ascending: true });

    if (fetchError) {
      logger.error('Error fetching reminders', fetchError);
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      logger.info('No reminders to send at this time');
      return NextResponse.json({ 
        success: true, 
        message: 'No reminders to send',
        sent: 0, 
        errors: 0 
      });
    }

    logger.info('Reminders ready for sending', { count: reminders.length });

    let sentCount = 0;
    let errorCount = 0;

    // Process each reminder
    for (const reminder of reminders) {
      try {
        logger.info('Sending reminder', { reminderId: reminder.id, householdId: reminder.household_id });
        
        // Update the reminder to mark it as sent
        const { error: updateError } = await supabase
          .from('reminders')
          .update({ is_sent: true })
          .eq('id', reminder.id);

        if (updateError) {
          logger.error('Error updating reminder as sent', updateError, { reminderId: reminder.id });
          errorCount++;
          continue;
        }

        logger.info('Reminder marked as sent', { reminderId: reminder.id });
        sentCount++;

        // TODO: Here you could add actual notification sending logic
        // For example: send email, push notification, SMS, etc.
        // await sendNotification(reminder);

      } catch (error) {
        logger.error('Error processing reminder', error instanceof Error ? error : new Error(String(error)), {
          reminderId: reminder.id,
        });
        errorCount++;
      }
    }

    logger.info('Reminder sending complete', { sentCount, errorCount });

    return NextResponse.json({ 
      success: true, 
      sent: sentCount, 
      errors: errorCount 
    });

  } catch (error) {
    logger.error('Fatal error in reminder sending process', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 