import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutomationJob {
  id: string;
  household_id: string;
  action: string;
  params: Record<string, any>;
  attempts: number;
  max_attempts: number;
}

interface ActionHandler {
  (job: AutomationJob, supabase: any): Promise<{ success: boolean; error?: string }>;
}

// Action handlers registry
const actionHandlers: Record<string, ActionHandler> = {
  async create_bill(job: AutomationJob, supabase: any) {
    try {
      const { name, amount, due_date, category, description, source_data } = job.params;
      
      if (!name || !amount || !due_date) {
        throw new Error('Missing required bill fields: name, amount, due_date');
      }

      const { error } = await supabase
        .from('bills')
        .insert({
          household_id: job.household_id,
          name,
          amount: parseFloat(amount),
          due_date,
          category: category || 'other',
          description: description || '',
          source: 'automation',
          source_data: source_data || {},
          created_by: 'automation'
        });

      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  async update_shopping_list(job: AutomationJob, supabase: any) {
    try {
      const { list_id, items, action } = job.params;
      
      if (!list_id || !items || !Array.isArray(items)) {
        throw new Error('Missing required shopping list fields: list_id, items array');
      }

      // For now, just log the action - shopping list integration will come later
      console.log(`Shopping list update requested: ${action} for list ${list_id}`, items);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  async assign_chore(job: AutomationJob, supabase: any) {
    try {
      const { chore_id, user_id, due_date } = job.params;
      
      if (!chore_id || !user_id) {
        throw new Error('Missing required chore fields: chore_id, user_id');
      }

      // Check if chores table exists and assign chore
      // For now, just log the assignment
      console.log(`Chore assignment requested: chore ${chore_id} to user ${user_id}`, { due_date });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  async notify(job: AutomationJob, supabase: any) {
    try {
      const { user_id, title, message, type, category, action_url } = job.params;
      
      if (!user_id || !title || !message) {
        throw new Error('Missing required notification fields: user_id, title, message');
      }

      const { error } = await supabase
        .from('notifications')
        .insert({
          household_id: job.household_id,
          user_id,
          title,
          message,
          type: type || 'info',
          category: category || 'automation',
          action_url: action_url || null
        });

      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
};

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

    // Get query parameters
    const url = new URL(req.url);
    const householdId = url.searchParams.get('household_id');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Fetch pending jobs
    let query = supabase
      .from('automation_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString()) // Include jobs scheduled for now or past
      .order('created_at', { ascending: true })
      .limit(limit);

    if (householdId) {
      query = query.eq('household_id', householdId);
    }

    const { data: pendingJobs, error: jobsError } = await query;

    if (jobsError) {
      console.error('Error fetching pending jobs:', jobsError);
      throw new Error('Failed to fetch pending jobs');
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No pending jobs found',
          jobsProcessed: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    let jobsProcessed = 0;
    let jobsSucceeded = 0;
    let jobsFailed = 0;
    const errors: string[] = [];

    // Process each job
    for (const job of pendingJobs) {
      try {
        // Mark job as processing
        await supabase
          .from('automation_jobs')
          .update({ 
            status: 'processing',
            attempts: job.attempts + 1
          })
          .eq('id', job.id);

        const automationJob: AutomationJob = job;
        const actionHandler = actionHandlers[automationJob.action];

        if (!actionHandler) {
          throw new Error(`Unknown action: ${automationJob.action}`);
        }

        // Execute the action
        const result = await actionHandler(automationJob, supabase);

        if (result.success) {
          // Mark job as done
          await supabase
            .from('automation_jobs')
            .update({ 
              status: 'done',
              processed_at: new Date().toISOString()
            })
            .eq('id', job.id);
          
          jobsSucceeded++;
        } else {
          throw new Error(result.error || 'Action failed');
        }

      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Job ${job.id}: ${errorMessage}`);

        // Check if we should retry or mark as failed
        if (job.attempts >= job.max_attempts) {
          await supabase
            .from('automation_jobs')
            .update({ 
              status: 'failed',
              last_error: errorMessage,
              processed_at: new Date().toISOString()
            })
            .eq('id', job.id);
          
          jobsFailed++;
        } else {
          // Reset to pending for retry
          await supabase
            .from('automation_jobs')
            .update({ 
              status: 'pending',
              last_error: errorMessage
            })
            .eq('id', job.id);
        }
      }

      jobsProcessed++;
    }

    const response = {
      message: 'Automation worker completed',
      jobsProcessed,
      jobsSucceeded,
      jobsFailed,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Worker response:', response);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Automation worker error:', error);
    
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
