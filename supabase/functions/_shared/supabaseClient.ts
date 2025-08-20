// Shared Supabase client for Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create Supabase client with service role key for admin operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function to get household ID from context
export function getHouseholdIdFromContext(context: any): string | null {
  if (context?.household_id) {
    return context.household_id;
  }
  
  // Try to extract from URL params
  const url = new URL(context?.request?.url || '');
  const householdId = url.searchParams.get('household_id');
  
  return householdId;
}

// Helper function to validate authentication
export async function validateAuth(request: Request): Promise<boolean> {
  // For now, just check if the request has a valid structure
  // In production, you'd want proper JWT validation
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Basic token validation
      return true;
    }
    
    // Allow requests without auth for development
    // In production, this should be more strict
    return true;
  } catch (error) {
    console.error('Auth validation error:', error);
    return false;
  }
}
