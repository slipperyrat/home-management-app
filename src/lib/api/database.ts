// Standardized Database Access Helper
// Provides consistent database access across all API routes

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logging/logger';

let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Get standardized Supabase client
 * @returns Supabase client instance
 */
export function getDatabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseClient;
}

/**
 * Execute database query with error handling
 * @param queryFn - Function that returns a Supabase query
 * @param context - Context for error logging
 * @returns Promise with query result
 */
export async function executeQuery<T>(
  queryFn: (client: ReturnType<typeof createClient>) => Promise<{ data: T | null; error: any }>,
  context: { operation: string; table?: string; userId?: string }
): Promise<{ data: T | null; error: any }> {
  try {
    const client = getDatabaseClient();
    const result = await queryFn(client);

    if (result.error) {
      logger.error(`Database error in ${context.operation}`, new Error(result.error.message), {
        operation: context.operation,
        table: context.table,
        userId: context.userId,
        error: result.error
      });
    }

    return result;
  } catch (error) {
    logger.error(`Database connection error in ${context.operation}`, error as Error, {
      operation: context.operation,
      table: context.table,
      userId: context.userId
    });

    return {
      data: null,
      error: {
        message: 'Database connection failed',
        code: 'CONNECTION_ERROR'
      }
    };
  }
}

/**
 * Get user's household ID
 * @param userId - User ID
 * @returns Promise with household ID or null
 */
export async function getUserHouseholdId(userId: string): Promise<string | null> {
  const { data, error } = await executeQuery(
    (client) => client
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single(),
    { operation: 'getUserHouseholdId', table: 'users', userId }
  );

  if (error || !data) {
    return null;
  }

  return data.household_id;
}

/**
 * Verify user has access to household
 * @param userId - User ID
 * @param householdId - Household ID
 * @returns Promise with access status
 */
export async function verifyHouseholdAccess(
  userId: string,
  householdId: string
): Promise<{ hasAccess: boolean; role?: string }> {
  const { data, error } = await executeQuery(
    (client) => client
      .from('household_members')
      .select('role')
      .eq('user_id', userId)
      .eq('household_id', householdId)
      .single(),
    { operation: 'verifyHouseholdAccess', table: 'household_members', userId }
  );

  if (error || !data) {
    return { hasAccess: false };
  }

  return { hasAccess: true, role: data.role };
}

/**
 * Get user and household data
 * @param userId - User ID
 * @returns Promise with user and household data
 */
export async function getUserAndHouseholdData(userId: string): Promise<{
  user: any;
  household: any;
  error?: string;
}> {
  const { data: userData, error: userError } = await executeQuery(
    (client) => client
      .from('users')
      .select(`
        *,
        households!inner(
          id,
          name,
          plan,
          game_mode
        )
      `)
      .eq('id', userId)
      .single(),
    { operation: 'getUserAndHouseholdData', table: 'users', userId }
  );

  if (userError || !userData) {
    return {
      user: null,
      household: null,
      error: 'User not found or no household'
    };
  }

  return {
    user: userData,
    household: userData.households
  };
}

/**
 * Create audit log entry
 * @param params - Audit log parameters
 * @returns Promise with audit log result
 */
export async function createAuditLog(params: {
  action: string;
  targetTable: string;
  targetId: string;
  userId: string;
  metadata?: any;
}): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await executeQuery(
    (client) => client.rpc('add_audit_log', {
      p_action: params.action,
      p_target_table: params.targetTable,
      p_target_id: params.targetId,
      p_user_id: params.userId,
      p_meta: params.metadata || {}
    }),
    { operation: 'createAuditLog', table: 'audit_logs', userId: params.userId }
  );

  if (error) {
    logger.warn('Failed to create audit log', { error, params });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Check if user exists in database
 * @param userId - User ID
 * @returns Promise with existence status
 */
export async function userExists(userId: string): Promise<boolean> {
  const { data, error } = await executeQuery(
    (client) => client
      .from('users')
      .select('id')
      .eq('id', userId)
      .single(),
    { operation: 'userExists', table: 'users', userId }
  );

  return !error && !!data;
}

/**
 * Get user's plan and features
 * @param userId - User ID
 * @returns Promise with plan and features
 */
export async function getUserPlan(userId: string): Promise<{
  plan: string;
  features: string[];
  error?: string;
}> {
  const { data, error } = await executeQuery(
    (client) => client
      .from('users')
      .select(`
        households!inner(
          plan
        )
      `)
      .eq('id', userId)
      .single(),
    { operation: 'getUserPlan', table: 'users', userId }
  );

  if (error || !data) {
    return {
      plan: 'free',
      features: [],
      error: 'Failed to fetch user plan'
    };
  }

  const plan = data.households?.plan || 'free';
  
  // Map plan to features (this should match your feature access logic)
  const features = plan === 'pro' || plan === 'pro_plus'
    ? ['meal_planner', 'ai_insights', 'automation_rules', 'advanced_analytics', 'finance_enabled']
    : ['basic_features'];

  return { plan, features };
}
