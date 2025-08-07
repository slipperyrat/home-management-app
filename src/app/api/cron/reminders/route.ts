import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST() {
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
      return NextResponse.json({ 
        success: true, 
        message: 'No reminders to send',
        sent: 0, 
        errors: 0 
      });
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

    return NextResponse.json({ 
      success: true, 
      sent: sentCount, 
      errors: errorCount 
    });

  } catch (error) {
    console.error('💥 Fatal error in reminder sending process:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 