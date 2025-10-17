import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { canAccessFeature } from '@/lib/server/canAccessFeature';
import type { Database } from '@/types/supabase.generated';
import { z } from 'zod';
import { logger } from '@/lib/logging/logger';

const createSpendEntrySchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  category: z.string().max(100).nullable().optional(),
  envelope_id: z.string().uuid('Invalid envelope ID').nullable().optional(),
  bill_id: z.string().uuid('Invalid bill ID').nullable().optional(),
  receipt_attachment_id: z.string().uuid('Invalid attachment ID').nullable().optional(),
  transaction_date: z.string().refine((date) => !Number.isNaN(Date.parse(date)), 'Invalid date format').optional(),
  merchant: z.string().max(255, 'Merchant name too long').nullable().optional(),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'other']).default('other'),
  source: z.enum(['manual', 'receipt_ocr', 'bill_payment', 'import']).default('manual'),
  external_id: z.string().max(100).nullable().optional(),
});

type SpendEntryInsert = Database['public']['Tables']['spend_entries']['Insert'];

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

      if (!canAccessFeature((household.plan as Parameters<typeof canAccessFeature>[0]) ?? 'free', 'spending_tracking')) {
        return createErrorResponse('Spending tracking requires Pro plan or higher', 403, {
          requiredPlan: 'pro',
          currentPlan: household.plan ?? 'free',
        });
      }

      const db = getDatabaseClient();

      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const envelope_id = url.searchParams.get('envelope_id');
      const bill_id = url.searchParams.get('bill_id');
      const start_date = url.searchParams.get('start_date');
      const end_date = url.searchParams.get('end_date');
      const payment_method = url.searchParams.get('payment_method');
      const limit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
      const offset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);

      let query = db
        .from('spend_entries')
        .select(
          `
            *,
            budget_envelopes(name, color),
            bills(title, amount)
          `,
        )
        .eq('household_id', household.id)
        .order('transaction_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (category) {
        query = query.eq('category', category);
      }
      if (envelope_id) {
        query = query.eq('envelope_id', envelope_id);
      }
      if (bill_id) {
        query = query.eq('bill_id', bill_id);
      }
      if (start_date) {
        query = query.gte('transaction_date', start_date);
      }
      if (end_date) {
        query = query.lte('transaction_date', end_date);
      }
      if (payment_method) {
        query = query.eq('payment_method', payment_method);
      }

      const { data: spendEntries, error } = await query;

      if (error) {
        logger.error('Error fetching spend entries', error, { householdId: household.id });
        return createErrorResponse('Failed to fetch spend entries', 500);
      }

      await createAuditLog({
        action: 'spend_entries.list',
        targetTable: 'spend_entries',
        targetId: household.id,
        userId: user.id,
        metadata: {
          count: spendEntries?.length ?? 0,
          filters: { category, envelope_id, bill_id, start_date, end_date, payment_method },
        },
      });

      return createSuccessResponse({ spend_entries: spendEntries ?? [] }, 'Spend entries fetched');
    } catch (error) {
      return handleApiError(error, { route: '/api/finance/spend-entries', method: 'GET', userId: user?.id ?? '' });
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

      if (!canAccessFeature((household.plan as Parameters<typeof canAccessFeature>[0]) ?? 'free', 'spending_tracking')) {
        return createErrorResponse('Spending tracking requires Pro plan or higher', 403, {
          requiredPlan: 'pro',
          currentPlan: household.plan ?? 'free',
        });
      }

      const body = await request.json();
      const parsedData = createSpendEntrySchema.parse(body);

      const transactionDate = parsedData.transaction_date ?? new Date().toISOString().split('T')[0];

      const validatedData = {
        ...parsedData,
        transaction_date: transactionDate,
      };

      if (!validatedData.transaction_date) {
        throw new Error('Invalid transaction date');
      }

      const db = getDatabaseClient();

      if (validatedData.envelope_id) {
        const { data: envelope, error: envelopeError } = await db
          .from('budget_envelopes')
          .select('id, allocated_amount, spent_amount')
          .eq('id', validatedData.envelope_id)
          .eq('household_id', household.id)
          .maybeSingle();

        if (envelopeError || !envelope) {
          return createErrorResponse('Invalid envelope or envelope not found', 400);
        }

        const newSpentAmount = (envelope.spent_amount ?? 0) + validatedData.amount;
        if (newSpentAmount > (envelope.allocated_amount ?? 0)) {
          return createErrorResponse('This transaction would exceed the envelope budget', 400, {
            current_spent: envelope.spent_amount ?? 0,
            allocated_amount: envelope.allocated_amount ?? 0,
            transaction_amount: validatedData.amount,
            would_exceed_by: newSpentAmount - (envelope.allocated_amount ?? 0),
          });
        }
      }

      if (validatedData.bill_id) {
        const { data: bill, error: billError } = await db
          .from('bills')
          .select('id')
          .eq('id', validatedData.bill_id)
          .eq('household_id', household.id)
          .maybeSingle();

        if (billError || !bill) {
          return createErrorResponse('Invalid bill or bill not found', 400);
        }
      }

      const insertPayload: SpendEntryInsert = {
        household_id: household.id,
        amount: validatedData.amount,
        description: validatedData.description,
        category: validatedData.category ?? null,
        envelope_id: validatedData.envelope_id ?? null,
        bill_id: validatedData.bill_id ?? null,
        receipt_attachment_id: validatedData.receipt_attachment_id ?? null,
        transaction_date: validatedData.transaction_date,
        merchant: validatedData.merchant ?? null,
        payment_method: validatedData.payment_method,
        source: validatedData.source,
        external_id: validatedData.external_id ?? null,
        created_by: user.id,
      };

      const { data: spendEntry, error } = await db
        .from('spend_entries')
        .insert(insertPayload)
        .select(
          `
            *,
            budget_envelopes(name, color),
            bills(title, amount)
          `,
        )
        .maybeSingle();

      if (error || !spendEntry) {
        const logError = error instanceof Error ? error : new Error('Postgrest error');
        logger.error('Error creating spend entry', logError, {
          householdId: household.id,
          userId: user.id,
          ...(error ? { error: error.message } : {}),
        });
        return createErrorResponse('Failed to create spend entry', 500);
      }

      await createAuditLog({
        action: 'spend_entries.create',
        targetTable: 'spend_entries',
        targetId: spendEntry.id,
        userId: user.id,
        metadata: {
          amount: spendEntry.amount,
          description: spendEntry.description,
          category: spendEntry.category,
          envelope_id: spendEntry.envelope_id,
          bill_id: spendEntry.bill_id,
        },
      });

      return createSuccessResponse({ spend_entry: spendEntry }, 'Spend entry created', 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, { route: '/api/finance/spend-entries', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}
