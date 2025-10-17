import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { canAccessFeature, type UserPlan } from '@/lib/server/canAccessFeature';
import { createBillCalendarEvent } from '@/lib/finance/calendarIntegration';
import type { Database } from '@/types/supabase.generated';
import { z } from 'zod';
import { logger } from '@/lib/logging/logger';

// Validation schemas
const createBillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('AUD'),
  due_date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format'),
  issued_date: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  source: z.enum(['manual', 'email', 'automation', 'import']).default('manual'),
  source_data: z.record(z.any()).optional(),
  assigned_to: z.string().optional(),
  external_id: z.string().optional(),
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
      if (!canAccessFeature(userPlan, 'bill_management')) {
        return createErrorResponse('Bill management requires Pro plan or higher', 403, {
          requiredPlan: 'pro',
          currentPlan: userPlan,
        });
      }

      const db = getDatabaseClient();
      
      // Get query parameters
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const category = url.searchParams.get('category');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Build query
      let query = db
        .from('bills')
        .select('*')
        .eq('household_id', household.id)
        .order('due_date', { ascending: true })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }
      if (category) {
        query = query.eq('category', category);
      }

      const { data: bills, error } = await query;

      if (error) {
        logger.error('Error fetching bills', error, { householdId: household.id });
        return createErrorResponse('Failed to fetch bills', 500);
      }

      // Log audit event
      await createAuditLog({
        action: 'bills.list',
        targetTable: 'bills',
        targetId: household.id,
        userId: user.id,
        metadata: { count: bills?.length || 0, filters: { status, category } },
      });

      return createSuccessResponse({ bills: bills || [] });
    } catch (error) {
      return handleApiError(error, { route: '/api/finance/bills', method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
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

      if (!canAccessFeature(userPlan, 'bill_management')) {
        return createErrorResponse('Bill management requires Pro plan or higher', 403, {
          requiredPlan: 'pro',
          currentPlan: userPlan,
        });
      }

      const body = await request.json();
      const validatedData = createBillSchema.parse(body);

      const db = getDatabaseClient();

      const { issued_date, ...rest } = validatedData;
      const insertPayload: Database['public']['Tables']['bills']['Insert'] = {
        household_id: household.id,
        name: rest.name,
        title: rest.title,
        description: rest.description ?? null,
        amount: rest.amount,
        currency: rest.currency,
        due_date: rest.due_date,
        status: 'pending',
        category: rest.category ?? null,
        source: rest.source,
        source_data: rest.source_data ?? null,
        assigned_to: rest.assigned_to ?? null,
        created_by: user.id,
        issued_date: issued_date ?? new Date().toISOString().slice(0, 10),
        priority: rest.priority,
        external_id: rest.external_id ?? null,
      };

      const { data: bill, error } = await db
        .from('bills')
        .insert(insertPayload)
        .select('*')
        .maybeSingle<Database['public']['Tables']['bills']['Row']>();

      if (error || !bill) {
        const logError = error instanceof Error ? error : new Error('Postgrest error');
        logger.error('Error creating bill', logError, { householdId: household.id, userId: user.id });
        return createErrorResponse('Failed to create bill', 500);
      }

      try {
        await createBillCalendarEvent(
          {
            id: bill.id,
            title: bill.title,
            description: bill.description,
            amount: bill.amount,
            currency: bill.currency,
            due_date: bill.due_date,
            priority: (bill.priority ?? 'medium') as 'low' | 'medium' | 'high' | 'urgent',
            category: bill.category ?? null,
          },
          household.id,
          user.id,
        );
        logger.info('Created calendar event for bill', { billId: bill.id, title: bill.title });
      } catch (calendarError) {
        const logError = calendarError instanceof Error ? calendarError : new Error(String(calendarError));
        logger.error('Failed to create calendar event for bill', logError, {
          billId: bill.id,
          householdId: household.id,
        });
      }

      await createAuditLog({
        action: 'bills.create',
        targetTable: 'bills',
        targetId: bill.id,
        userId: user.id,
        metadata: { title: bill.title, amount: bill.amount, due_date: bill.due_date },
      });

      return createSuccessResponse({ bill }, 'Bill created', 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, { route: '/api/finance/bills', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}
