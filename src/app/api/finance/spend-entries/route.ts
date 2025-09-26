import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { canAccessFeature } from '@/lib/server/canAccessFeature';
import { z } from 'zod';

// Validation schemas
const createSpendEntrySchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  category: z.string().optional(),
  envelope_id: z.string().uuid('Invalid envelope ID').optional(),
  bill_id: z.string().uuid('Invalid bill ID').optional(),
  receipt_attachment_id: z.string().uuid('Invalid attachment ID').optional(),
  transaction_date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format').optional(),
  merchant: z.string().max(255, 'Merchant name too long').optional(),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'other']).default('other'),
  source: z.enum(['manual', 'receipt_ocr', 'bill_payment', 'import']).default('manual'),
  external_id: z.string().optional(),
});

const updateSpendEntrySchema = createSpendEntrySchema.partial().extend({
  id: z.string().uuid('Invalid spend entry ID'),
});

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { userData, household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      // Check feature access
      if (!canAccessFeature(household.plan || 'free', 'spending_tracking')) {
        return createErrorResponse('Spending tracking requires Pro plan or higher', 403, {
          requiredPlan: 'pro',
          currentPlan: household.plan || 'free'
        });
      }

      const db = getDatabaseClient();
      
      // Get query parameters
      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const envelope_id = url.searchParams.get('envelope_id');
      const bill_id = url.searchParams.get('bill_id');
      const start_date = url.searchParams.get('start_date');
      const end_date = url.searchParams.get('end_date');
      const payment_method = url.searchParams.get('payment_method');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Build query
      let query = db
        .from('spend_entries')
        .select(`
          *,
          budget_envelopes(name, color),
          bills(title, amount)
        `)
        .eq('household_id', household.id)
        .order('transaction_date', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
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
        console.error('Error fetching spend entries:', error);
        return createErrorResponse('Failed to fetch spend entries', 500);
      }

      // Log audit event
      await createAuditLog({
        actor_id: user.id,
        household_id: household.id,
        action: 'spend_entries.list',
        target_table: 'spend_entries',
        meta: { 
          count: spendEntries?.length || 0, 
          filters: { category, envelope_id, bill_id, start_date, end_date, payment_method }
        }
      });

      return createSuccessResponse({ spend_entries: spendEntries || [] });

    } catch (error) {
      return handleApiError(error, 'Failed to fetch spend entries');
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { userData, household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      // Check feature access
      if (!canAccessFeature(household.plan || 'free', 'spending_tracking')) {
        return createErrorResponse('Spending tracking requires Pro plan or higher', 403, {
          requiredPlan: 'pro',
          currentPlan: household.plan || 'free'
        });
      }

      const body = await request.json();
      const validatedData = createSpendEntrySchema.parse(body);

      const db = getDatabaseClient();

      // If envelope_id is provided, verify it exists and belongs to the household
      if (validatedData.envelope_id) {
        const { data: envelope, error: envelopeError } = await db
          .from('budget_envelopes')
          .select('id, allocated_amount, spent_amount')
          .eq('id', validatedData.envelope_id)
          .eq('household_id', household.id)
          .single();

        if (envelopeError || !envelope) {
          return createErrorResponse('Invalid envelope or envelope not found', 400);
        }

        // Check if adding this amount would exceed the envelope limit
        const newSpentAmount = envelope.spent_amount + validatedData.amount;
        if (newSpentAmount > envelope.allocated_amount) {
          return createErrorResponse('This transaction would exceed the envelope budget', 400, {
            current_spent: envelope.spent_amount,
            allocated_amount: envelope.allocated_amount,
            transaction_amount: validatedData.amount,
            would_exceed_by: newSpentAmount - envelope.allocated_amount
          });
        }
      }

      // If bill_id is provided, verify it exists and belongs to the household
      if (validatedData.bill_id) {
        const { data: bill, error: billError } = await db
          .from('bills')
          .select('id, title, amount, status')
          .eq('id', validatedData.bill_id)
          .eq('household_id', household.id)
          .single();

        if (billError || !bill) {
          return createErrorResponse('Invalid bill or bill not found', 400);
        }
      }

      // Create spend entry
      const { data: spendEntry, error } = await db
        .from('spend_entries')
        .insert({
          household_id: household.id,
          amount: validatedData.amount,
          description: validatedData.description,
          category: validatedData.category,
          envelope_id: validatedData.envelope_id,
          bill_id: validatedData.bill_id,
          receipt_attachment_id: validatedData.receipt_attachment_id,
          transaction_date: validatedData.transaction_date || new Date().toISOString().split('T')[0],
          merchant: validatedData.merchant,
          payment_method: validatedData.payment_method,
          source: validatedData.source,
          external_id: validatedData.external_id,
          created_by: user.id,
        })
        .select(`
          *,
          budget_envelopes(name, color),
          bills(title, amount)
        `)
        .single();

      if (error) {
        console.error('Error creating spend entry:', error);
        return createErrorResponse('Failed to create spend entry', 500);
      }

      // Log audit event
      await createAuditLog({
        actor_id: user.id,
        household_id: household.id,
        action: 'spend_entries.create',
        target_table: 'spend_entries',
        target_id: spendEntry.id,
        meta: { 
          amount: spendEntry.amount,
          description: spendEntry.description,
          category: spendEntry.category,
          envelope_id: spendEntry.envelope_id,
          bill_id: spendEntry.bill_id
        }
      });

      return createSuccessResponse({ spend_entry: spendEntry }, 201);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, 'Failed to create spend entry');
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
