import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { canAccessFeature, type UserPlan } from '@/lib/server/canAccessFeature';
import type { Database } from '@/types/supabase.generated';
import { z } from 'zod';
import { logger } from '@/lib/logging/logger';

// Validation schemas
const createEnvelopeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z.string().optional(),
  allocated_amount: z.number().positive('Allocated amount must be positive'),
  period_start: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format'),
  period_end: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format'),
  category: z.string().default('general'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').default('#3B82F6'),
}).refine((data) => new Date(data.period_end) > new Date(data.period_start), {
  message: 'Period end must be after period start',
  path: ['period_end'],
});

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      const userPlan: UserPlan = (household.plan as UserPlan | null) ?? 'free';

      // Check feature access
      if (!canAccessFeature(userPlan, 'budget_envelopes')) {
        return createErrorResponse('Budget envelopes require Pro plan', 403, {
          requiredPlan: 'pro',
          currentPlan: userPlan,
        });
      }

      const db = getDatabaseClient();
      
      // Get query parameters
      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const period_start = url.searchParams.get('period_start');
      const period_end = url.searchParams.get('period_end');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Build query
      let query = db
        .from('budget_envelopes')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (category) {
        query = query.eq('category', category);
      }
      if (period_start) {
        query = query.gte('period_start', period_start);
      }
      if (period_end) {
        query = query.lte('period_end', period_end);
      }

      const { data: envelopes, error } = await query;

      if (error) {
        logger.error('Error fetching budget envelopes', error, { householdId: household.id });
        return createErrorResponse('Failed to fetch budget envelopes', 500);
      }

      // Calculate remaining amounts
      const envelopesWithRemaining = (envelopes ?? []).map((envelope) => {
        const spentAmount = envelope.spent_amount ?? 0;
        const remainingAmount = envelope.allocated_amount - spentAmount;
        const spentPercentage = envelope.allocated_amount > 0
          ? (spentAmount / envelope.allocated_amount) * 100
          : 0;
        return {
          ...envelope,
          remaining_amount: remainingAmount,
          spent_percentage: spentPercentage,
        };
      });

      // Log audit event
      await createAuditLog({
        action: 'budget_envelopes.list',
        targetTable: 'budget_envelopes',
        targetId: household.id,
        userId: user.id,
        metadata: { count: envelopesWithRemaining.length, filters: { category, period_start, period_end } }
      });

      return createSuccessResponse({ envelopes: envelopesWithRemaining });

    } catch (error) {
      return handleApiError(error, { route: '/api/finance/budget-envelopes', method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      const userPlan: UserPlan = (household.plan as UserPlan | null) ?? 'free';

      // Check feature access
      if (!canAccessFeature(userPlan, 'budget_envelopes')) {
        return createErrorResponse('Budget envelopes require Pro plan', 403, {
          requiredPlan: 'pro',
          currentPlan: userPlan,
        });
      }

      const body = await request.json();
      const validatedData = createEnvelopeSchema.parse(body);

      const db = getDatabaseClient();

      // Create budget envelope
      const { data: envelope, error } = await db
        .from('budget_envelopes')
        .insert({
          household_id: household.id,
          name: validatedData.name,
          description: validatedData.description ?? null,
          allocated_amount: validatedData.allocated_amount,
          period_start: validatedData.period_start,
          period_end: validatedData.period_end,
          category: validatedData.category ?? null,
          color: validatedData.color,
          created_by: user.id,
        } satisfies Database['public']['Tables']['budget_envelopes']['Insert'])
        .select('*')
        .maybeSingle<Database['public']['Tables']['budget_envelopes']['Row']>();

      if (error || !envelope) {
        const logError = error instanceof Error ? error : new Error('Postgrest error');
        logger.error('Error creating budget envelope', logError, { householdId: household.id, userId: user.id });
        return createErrorResponse('Failed to create budget envelope', 500);
      }

      // Add calculated fields
      const envelopeWithCalculations = {
        ...envelope,
        remaining_amount: envelope.allocated_amount - (envelope.spent_amount ?? 0),
        spent_percentage: envelope.allocated_amount > 0
          ? ((envelope.spent_amount ?? 0) / envelope.allocated_amount) * 100
          : 0,
      };

      // Log audit event
      await createAuditLog({
        action: 'budget_envelopes.create',
        targetTable: 'budget_envelopes',
        targetId: envelope.id,
        userId: user.id,
        metadata: { 
          name: envelope.name, 
          allocated_amount: envelope.allocated_amount,
          period_start: envelope.period_start,
          period_end: envelope.period_end
        }
      });

      return createSuccessResponse({ envelope: envelopeWithCalculations }, 'Budget envelope created', 201);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, { route: '/api/finance/budget-envelopes', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
