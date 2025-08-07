import { createClient } from '@supabase/supabase-js';

// Check for required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Reminder {
  id: string;
  title: string;
  related_type: 'chore' | 'calendar_event';
  related_id: string;
  remind_at: string;
  is_sent: boolean;
  created_by: string;
  household_id: string;
  created_at: string;
}

export async function run() {
  try {
    console.log('🔔 Starting reminder sending process...');
    
    // Get current time in ISO format for timezone-aware comparison
    const now = new Date().toISOString();
    console.log(`⏰ Current time: ${now}`);
    
    // Query reminders that are due and not yet sent
    const { data: reminders, error: fetchError } = await supabase
      .from('reminders')
      .select('*')
      .lte('remind_at', now)
      .eq('is_sent', false)
      .order('remind_at', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching reminders:', fetchError);
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      console.log('📭 No reminders to send at this time');
      return { sent: 0, errors: 0 };
    }

    console.log(`📋 Found ${reminders.length} reminder(s) to send`);

    let sentCount = 0;
    let errorCount = 0;

    // Process each reminder
    for (const reminder of reminders) {
      try {
        console.log(`📤 Send reminder: "${reminder.title}" for household ${reminder.household_id}`);
        
        // Update the reminder to mark it as sent
        const { error: updateError } = await supabase
          .from('reminders')
          .update({ is_sent: true })
          .eq('id', reminder.id);

        if (updateError) {
          console.error(`❌ Error updating reminder ${reminder.id}:`, updateError);
          errorCount++;
          continue;
        }

        console.log(`✅ Successfully sent reminder: "${reminder.title}"`);
        sentCount++;

        // TODO: Here you could add actual notification sending logic
        // For example: send email, push notification, SMS, etc.
        // await sendNotification(reminder);

      } catch (error) {
        console.error(`❌ Error processing reminder ${reminder.id}:`, error);
        errorCount++;
      }
    }

    console.log(`🎉 Reminder sending complete!`);
    console.log(`✅ Successfully sent: ${sentCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    return { sent: sentCount, errors: errorCount };

  } catch (error) {
    console.error('💥 Fatal error in reminder sending process:', error);
    throw error;
  }
}

// Allow running directly if this file is executed
if (require.main === module) {
  run()
    .then((result) => {
      console.log('🏁 Script completed with result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
} 