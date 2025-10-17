import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { canAccessFeature, type UserPlan } from '@/lib/server/canAccessFeature';
import { updateBillCalendarEvent, deleteBillCalendarEvent } from '@/lib/finance/calendarIntegration';
import type { Database } from '@/types/supabase.generated';
import { z } from 'zod';
import { logger } from '@/lib/logging/logger';

// Validation schemas
const updateBillSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  currency: z.string().optional(),
  due_date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format').optional(),
  issued_date: z.string().optional(),
  paid_date: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  source: z.enum(['manual', 'email', 'automation', 'import']).optional(),
  external_id: z.string().optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

async function resolveParams(context: RouteContext): Promise<{ id: string }> {
  const params = context.params ? await context.params : { id: '' };
  if (!params.id) {
    throw new Error('Missing bill id');
  }
  return { id: params.id };
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: billId } = await resolveParams(context);
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

      const db = getDatabaseClient();

      const { data: bill, error } = await db
        .from('bills')
        .select('*')
        .eq('id', billId)
        .eq('household_id', household.id)
        .maybeSingle<Database['public']['Tables']['bills']['Row']>();

      if (error || !bill) {
        if (error?.code === 'PGRST116') {
          return createErrorResponse('Bill not found', 404);
        }
        const logError = error instanceof Error ? error : new Error('Postgrest error');
        logger.error('Error fetching bill', logError, { billId, householdId: household.id });
        return createErrorResponse('Failed to fetch bill', 500);
      }

      return createSuccessResponse({ bill });
    } catch (error) {
      return handleApiError(error, { route: `/api/finance/bills/${billId}`, method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
  });
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: billId } = await resolveParams(context);
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
      const validatedData = updateBillSchema.parse(body);

      const db = getDatabaseClient();

      const { data: existingBill, error: fetchError } = await db
        .from('bills')
        .select('*')
        .eq('id', billId)
        .eq('household_id', household.id)
        .maybeSingle<Database['public']['Tables']['bills']['Row']>();

      if (fetchError || !existingBill) {
        return createErrorResponse('Bill not found', 404);
      }

      type UpdateBillInput = z.infer<typeof updateBillSchema>;
      const updateData = Object.fromEntries(
        Object.entries(validatedData).filter(([, value]) => value !== undefined),
      ) as Partial<UpdateBillInput>;

      const updatePayload: Database['public']['Tables']['bills']['Update'] = {
        title: updateData.title ?? existingBill.title,
        description: updateData.description ?? existingBill.description ?? null,
        amount: updateData.amount ?? existingBill.amount,
        currency: updateData.currency ?? existingBill.currency,
        due_date: updateData.due_date ?? existingBill.due_date,
        issued_date: updateData.issued_date ?? existingBill.issued_date,
        paid_at: updateData.paid_date ?? existingBill.paid_at,
        category: updateData.category ?? existingBill.category ?? null,
        priority: updateData.priority ?? existingBill.priority,
        status: updateData.status ?? existingBill.status,
        source: updateData.source ?? existingBill.source,
        external_id: updateData.external_id ?? existingBill.external_id,
      };

      const { data: bill, error } = await db
        .from('bills')
        .update(updatePayload)
        .eq('id', billId)
        .eq('household_id', household.id)
        .select('*')
        .maybeSingle<Database['public']['Tables']['bills']['Row']>();

      if (error || !bill) {
        const logError = error instanceof Error ? error : new Error('Postgrest error');
        logger.error('Error updating bill', logError, { billId, householdId: household.id });
        return createErrorResponse('Failed to update bill', 500);
      }

      try {
        const calendarUpdates: Record<string, unknown> = {};

        if (updateData.status === 'paid') {
          calendarUpdates.paid = true;
        }
        if (updateData.due_date) {
          calendarUpdates.new_due_date = updateData.due_date;
        }
        if (updateData.amount !== undefined) {
          calendarUpdates.new_amount = updateData.amount;
        }
        if (updateData.title) {
          calendarUpdates.new_title = updateData.title;
        }
        if (Object.keys(calendarUpdates).length > 0) {
          await updateBillCalendarEvent(billId, calendarUpdates, household.id);
          logger.info('Updated calendar event for bill', { billId, householdId: household.id });
        }
      } catch (calendarError) {
        const logError = calendarError instanceof Error ? calendarError : new Error(String(calendarError));
        logger.error('Failed to update calendar event for bill', logError, {
          billId,
          householdId: household.id,
        });
      }

      await createAuditLog({
        action: 'bills.update',
        targetTable: 'bills',
        targetId: billId,
        userId: user.id,
        metadata: {
          changes: Object.keys(updateData),
          previous_status: existingBill.status,
          new_status: bill.status,
        },
      });

      return createSuccessResponse({ bill });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, { route: `/api/finance/bills/${billId}`, method: 'PUT', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: billId } = await resolveParams(context);
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

      const db = getDatabaseClient();

      const { data: existingBill, error: fetchError } = await db
        .from('bills')
        .select('*')
        .eq('id', billId)
        .eq('household_id', household.id)
        .maybeSingle<Database['public']['Tables']['bills']['Row']>();

      if (fetchError || !existingBill) {
        return createErrorResponse('Bill not found', 404);
      }

      const { error } = await db
        .from('bills')
        .delete()
        .eq('id', billId)
        .eq('household_id', household.id);

      if (error) {
        const logError = error instanceof Error ? error : new Error('Postgrest error');
        logger.error('Error deleting bill', logError, { billId, householdId: household.id });
        return createErrorResponse('Failed to delete bill', 500);
      }

      try {
        await deleteBillCalendarEvent(billId, household.id);
        logger.info('Deleted calendar event for bill', { billId, householdId: household.id });
      } catch (calendarError) {
        const logError = calendarError instanceof Error ? calendarError : new Error(String(calendarError));
        logger.error('Failed to delete calendar event for bill', logError, {
          billId,
          householdId: household.id,
        });
      }

      await createAuditLog({
        action: 'bills.delete',
        targetTable: 'bills',
        targetId: billId,
        userId: user.id,
        metadata: {
          title: existingBill.title,
          amount: existingBill.amount,
          status: existingBill.status,
        },
      });

      return createSuccessResponse({ message: 'Bill deleted successfully' });
    } catch (error) {
      return handleApiError(error, { route: `/api/finance/bills/${billId}`, method: 'DELETE', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}
