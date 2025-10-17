// Standardized Database Access Helper
// Provides consistent database access across all API routes

import { SupabaseClient, type PostgrestError } from '@supabase/supabase-js';
import { logger } from '@/lib/logging/logger';
import type { Database, Json } from '@/types/supabase.generated';
import type { User, Household, AuditLogInput } from '@/types/database';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';

type DBClient = SupabaseClient<Database>;
type QueryResult<T> = { data: T | null; error: PostgrestError | null };

/**
 * Get standardized Supabase client
 * @returns Supabase client instance
 */
export function getDatabaseClient(): DBClient {
  return getSupabaseAdminClient();
}

/**
 * Execute database query with error handling
 * @param queryFn - Function that returns a Supabase query
 * @param context - Context for error logging
 * @returns Promise with query result
 */
export async function executeQuery<T>(
  queryFn: (client: DBClient) => Promise<QueryResult<T>>,
  context: { operation: string; table?: string; userId?: string }
): Promise<QueryResult<T>> {
  try {
    const client = getDatabaseClient();
    const result = await queryFn(client);

    if (result.error) {
      logger.error(
        `Database error in ${context.operation}`,
        new Error(result.error.message),
        {
          operation: context.operation,
          ...(context.table ? { table: context.table } : {}),
          ...(context.userId ? { userId: context.userId } : {}),
          error: {
            message: result.error.message,
            code: result.error.code,
            details: result.error.details,
            hint: result.error.hint,
            name: result.error.name,
          },
        },
      );
    }

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown database error');
    logger.error(
      `Database connection error in ${context.operation}`,
      err,
      {
        operation: context.operation,
        ...(context.table ? { table: context.table } : {}),
        ...(context.userId ? { userId: context.userId } : {}),
      },
    );

    return {
      data: null,
      error: {
        message: 'Database connection failed',
        code: 'CONNECTION_ERROR',
        details: '',
        hint: '',
        name: 'CONNECTION_ERROR',
      },
    };
  }
}

/**
 * Get user's household ID
 * @param userId - User ID
 * @returns Promise with household ID or null
 */
export async function getUserHouseholdId(userId: string): Promise<string | null> {
  const { data, error } = await executeQuery<{ household_id: string | null }>(
    async (client) => {
      const { data, error } = await client
        .from('users')
        .select('household_id')
        .eq('id', userId)
        .maybeSingle();

      return { data: data ?? null, error };
    },
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
  const { data, error } = await executeQuery<{ role: string | null }>(
    async (client) => {
      const { data, error } = await client
        .from('household_members')
        .select('role')
        .eq('user_id', userId)
        .eq('household_id', householdId)
        .maybeSingle();

      return { data: data ?? null, error };
    },
    { operation: 'verifyHouseholdAccess', table: 'household_members', userId }
  );

  if (error || !data) {
    return { hasAccess: false };
  }

  return { hasAccess: true, ...(data.role ? { role: data.role } : {}) };
}

/**
 * Get user and household data
 * @param userId - User ID
 * @returns Promise with user and household data
 */
export async function getUserAndHouseholdData(userId: string): Promise<{
  user: User | null;
  household: Household | null;
  error?: string;
}> {
  const { data: userData, error: userError } = await executeQuery<User & { households: Household | null }>(
    async (client) => {
      const { data, error } = await client
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
        .maybeSingle();

      return { data: (data as (User & { households: Household | null }) | null) ?? null, error };
    },
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
    household: userData.households ?? null
  };
}

/**
 * Create audit log entry
 * @param params - Audit log parameters
 * @returns Promise with audit log result
 */
export async function createAuditLog(params: AuditLogInput): Promise<{ success: boolean; error?: string }> {
  const { error } = await executeQuery<null>(
    async (client) => {
      const { error } = await client.rpc('add_audit_log', {
        p_action: params.action,
        p_target_table: params.targetTable,
        p_target_id: params.targetId,
        p_user_id: params.userId,
        p_meta: (params.metadata ?? {}) as Json,
      });

      return { data: null, error };
    },
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
  const { data, error } = await executeQuery<{ id: string }>(
    async (client) => {
      const { data, error } = await client
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      return { data: data ?? null, error };
    },
    { operation: 'userExists', table: 'users', userId }
  );

  return !error && Boolean(data?.id);
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
  const { data, error } = await executeQuery<{ households: { plan: string | null } | null }>(
    async (client) => {
      const { data, error } = await client
        .from('users')
        .select(`
          households!inner(
            plan
          )
        `)
        .eq('id', userId)
        .single();

      return { data: (data as { households: { plan: string | null } | null } | null) ?? null, error };
    },
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

export async function getUserOnboardingStatus(userId: string): Promise<boolean> {
  const { data, error } = await executeQuery<{ onboarding_completed: boolean | null }>(
    async (client) => {
      const { data, error } = await client
        .from('users')
        .select('onboarding_completed')
        .eq('id', userId)
        .single();

      return { data: data ?? null, error };
    },
    { operation: 'getUserOnboardingStatus', table: 'users', userId }
  );

  if (error || !data) {
    return false;
  }

  return Boolean(data.onboarding_completed);
}