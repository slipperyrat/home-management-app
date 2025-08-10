import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔔 Starting reminder sending process...')
    
    // Get current time in ISO format for timezone-aware comparison
    const now = new Date().toISOString()
    console.log(`⏰ Current time: ${now}`)
    
    // Query reminders that are due and not yet sent
    const { data: reminders, error: fetchError } = await supabase
      .from('reminders')
      .select('*')
      .lte('remind_at', now)
      .eq('is_sent', false)
      .order('remind_at', { ascending: true })

    if (fetchError) {
      console.error('❌ Error fetching reminders:', fetchError)
      throw fetchError
    }

    if (!reminders || reminders.length === 0) {
      console.log('📭 No reminders to send at this time')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No reminders to send',
          sent: 0, 
          errors: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log(`📋 Found ${reminders.length} reminder(s) to send`)

    let sentCount = 0
    let errorCount = 0

    // Process each reminder
    for (const reminder of reminders) {
      try {
        console.log(`📤 Send reminder: "${reminder.title}" for household ${reminder.household_id}`)
        
        // Update the reminder to mark it as sent
        const { error: updateError } = await supabase
          .from('reminders')
          .update({ is_sent: true })
          .eq('id', reminder.id)

        if (updateError) {
          console.error(`❌ Error updating reminder ${reminder.id}:`, updateError)
          errorCount++
          continue
        }

        console.log(`✅ Successfully sent reminder: "${reminder.title}"`)
        sentCount++

        // TODO: Here you could add actual notification sending logic
        // For example: send email, push notification, SMS, etc.
        // await sendNotification(reminder)

      } catch (error) {
        console.error(`❌ Error processing reminder ${reminder.id}:`, error)
        errorCount++
      }
    }

    console.log(`🎉 Reminder sending complete!`)
    console.log(`✅ Successfully sent: ${sentCount}`)
    console.log(`❌ Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        errors: errorCount 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('💥 Fatal error in reminder sending process:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}) 