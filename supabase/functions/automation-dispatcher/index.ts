import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutomationRule {
  id: string;
  household_id: string;
  trigger_types: string[];
  actions: Array<{
    name: string;
    params: Record<string, any>;
  }>;
}

interface HouseholdEvent {
  id: string;
  household_id: string;
  type: string;
  source: string;
  payload: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the event data from the request
    const { event, rule } = await req.json()
    
    if (!event) {
      throw new Error('No event data provided')
    }

    const householdEvent: HouseholdEvent = event
    console.log(`Processing event: ${householdEvent.type} for household: ${householdEvent.household_id}`)

    // Find enabled rules that match this event type
    const { data: matchingRules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('household_id', householdEvent.household_id)
      .eq('enabled', true)
      .contains('trigger_types', [householdEvent.type])

    if (rulesError) {
      console.error('Error fetching rules:', rulesError)
      throw new Error('Failed to fetch automation rules')
    }

    if (!matchingRules || matchingRules.length === 0) {
      console.log(`No matching rules found for event type: ${householdEvent.type}`)
      return new Response(
        JSON.stringify({ 
          message: 'No matching rules found',
          eventType: householdEvent.type,
          jobsCreated: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    let jobsCreated = 0
    const errors: string[] = []

    // Create jobs for each matching rule
    for (const rule of matchingRules) {
      try {
        const automationRule: AutomationRule = rule
        
        // For each action in the rule, create a job
        for (const action of automationRule.actions) {
          const dedupeKey = `${householdEvent.id}:${action.name}`
          
          const { error: jobError } = await supabase
            .from('automation_jobs')
            .insert({
              household_id: householdEvent.household_id,
              rule_id: automationRule.id,
              event_id: householdEvent.id,
              action: action.name,
              params: action.params,
              dedupe_key: dedupeKey,
              status: 'pending'
            })

          if (jobError) {
            // Check if it's a duplicate key error (which is expected)
            if (jobError.code === '23505') { // Unique violation
              console.log(`Job already exists for dedupe key: ${dedupeKey}`)
            } else {
              console.error(`Error creating job for action ${action.name}:`, jobError)
              errors.push(`Failed to create job for action ${action.name}: ${jobError.message}`)
            }
          } else {
            jobsCreated++
            console.log(`Created job for action: ${action.name}`)
          }
        }
      } catch (ruleError) {
        console.error(`Error processing rule ${rule.id}:`, ruleError)
        errors.push(`Failed to process rule ${rule.id}: ${ruleError.message}`)
      }
    }

    const response = {
      message: 'Automation dispatcher completed',
      eventType: householdEvent.type,
      householdId: householdEvent.household_id,
      rulesProcessed: matchingRules.length,
      jobsCreated,
      errors: errors.length > 0 ? errors : undefined
    }

    console.log('Dispatcher response:', response)

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Automation dispatcher error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
