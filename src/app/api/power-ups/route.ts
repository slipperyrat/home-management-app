import { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { createClient } from '@supabase/supabase-js';
import { 
  createSuccessResponse, 
  createUnauthorizedResponse, 
  createInternalErrorResponse,
  setCacheHeaders,
  handleAsyncOperation
} from "@/lib/api-helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  const { userId } = await getAuth(request);

  if (!userId) {
    return createUnauthorizedResponse();
  }

  const result = await handleAsyncOperation(async () => {
    const { data, error } = await supabase
      .from('power_ups')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString());

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data || [];
  }, 'Failed to fetch power-ups');

  if (!result.success) {
    return createInternalErrorResponse(result.error);
  }

  const response = createSuccessResponse(result.data);
  
  // Cache power-ups for 2 minutes since they don't change frequently
  return setCacheHeaders(response, 120);
}
