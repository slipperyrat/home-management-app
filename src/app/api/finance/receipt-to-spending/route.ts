import { NextRequest } from 'next/server';
import { z } from 'zod';

import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, handleApiError, createSuccessResponse } from '@/lib/api/errors';
import {
  createSpendEntriesFromReceipt,
  suggestBudgetEnvelopeForReceipt,
  deleteSpendEntriesFromReceipt,
} from '@/lib/finance/receiptIntegration';
import type { ReceiptItem as ReceiptItemRow } from '@/types/database';
import type { UserPlan } from '@/lib/server/canAccessFeature';
import { logger } from '@/lib/logging/logger';

// Validation schemas
const createSpendingFromReceiptSchema = z.object({
  receipt_item_ids: z.array(z.string().uuid()).min(1, 'At least one receipt item is required'),
  envelope_id: z.string().uuid().optional(),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'other']).default('card'),
  create_single_entry: z.boolean().default(false),
});

const deleteSpendingFromReceiptSchema = z.object({
  receipt_item_ids: z.array(z.string().uuid()).min(1, 'At least one receipt item is required'),
});

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (_req, user) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      const body = await request.json();
      const validatedData = createSpendingFromReceiptSchema.parse(body);

      const db = getDatabaseClient();

      const itemsResult = await db
        .from('receipt_items')
        .select(
          `
            *,
            attachment:attachments (
              id,
              file_name,
              receipt_store,
              receipt_date
            )
          `,
        )
        .in('id', validatedData.receipt_item_ids)
        .eq('household_id', household.id);

      if (itemsResult.error || !itemsResult.data || itemsResult.data.length === 0) {
        return createErrorResponse('Receipt items not found', 404);
      }

      const receiptItems = (itemsResult.data ?? []) as ReceiptItemRow[];

      // Suggest budget envelope if not provided
      const suggestedEnvelope = await suggestBudgetEnvelopeForReceipt(receiptItems, household.id);
      const envelopeId = validatedData.envelope_id ?? suggestedEnvelope ?? undefined;

      const spendEntryOptions: Parameters<typeof createSpendEntriesFromReceipt>[3] = {
        payment_method: validatedData.payment_method,
        create_single_entry: validatedData.create_single_entry,
      };

      if (envelopeId) {
        spendEntryOptions.envelope_id = envelopeId;
      }

      // Create spend entries from receipt items
      const spendEntries = await createSpendEntriesFromReceipt(
        receiptItems,
        (household.plan as UserPlan | null) ?? 'free',
        user.id,
        spendEntryOptions,
      );

      if (spendEntries.length > 0) {
        await createAuditLog({
          action: 'spending.create_from_receipt',
          targetTable: 'spend_entries',
          targetId: spendEntries[0]?.id ?? household.id,
          userId: user.id,
          metadata: {
            receipt_item_count: receiptItems.length,
            spend_entry_count: spendEntries.length,
            create_single_entry: validatedData.create_single_entry,
          },
        });
      }

      return createSuccessResponse({
        spend_entries: spendEntries,
        suggested_envelope: envelopeId ?? null,
        message: `Created ${spendEntries.length} spend entries from ${receiptItems.length} receipt items`,
      }, 'Spend entries created from receipt', 201);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, { route: '/api/finance/receipt-to-spending', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function DELETE(request: NextRequest) {
  return withAPISecurity(request, async (_req, user) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      const body = await request.json();
      const validatedData = deleteSpendingFromReceiptSchema.parse(body);

      const db = getDatabaseClient();

      // Verify receipt items belong to household
      const { data: receiptItems, error: itemsError } = await db
        .from('receipt_items')
        .select('id')
        .in('id', validatedData.receipt_item_ids)
        .eq('household_id', household.id);

      if (itemsError || !receiptItems || receiptItems.length === 0) {
        return createErrorResponse('Receipt items not found', 404);
      }

      await deleteSpendEntriesFromReceipt(validatedData.receipt_item_ids, household.id);

      await createAuditLog({
        action: 'spending.delete_from_receipt',
        targetTable: 'spend_entries',
        targetId: household.id,
        userId: user.id,
        metadata: {
          receipt_item_count: validatedData.receipt_item_ids.length,
        },
      });

      return createSuccessResponse({
        message: 'Spend entries deleted successfully',
        deleted_items: validatedData.receipt_item_ids.length,
      }, 'Spend entries deleted');
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, { route: '/api/finance/receipt-to-spending', method: 'DELETE', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (_req: NextRequest, user) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      const url = new URL(request.url);
      const receipt_item_ids = url.searchParams.get('receipt_item_ids');
      const attachment_id = url.searchParams.get('attachment_id');

      const db = getDatabaseClient();

      let query = db
        .from('spend_entries')
        .select(
          `
            *,
            budget_envelopes(name, color),
            receipt_items(id, item_name, item_price)
          `,
        )
        .eq('household_id', household.id)
        .eq('source', 'receipt_ocr');

      if (receipt_item_ids) {
        const itemIds = receipt_item_ids.split(',');
        query = query.in('receipt_attachment_id', itemIds);
      }

      if (attachment_id) {
        query = query.eq('receipt_attachment_id', attachment_id);
      }

      const { data: spendEntries, error } = await query.order('transaction_date', { ascending: false });

      if (error) {
        logger.error('Error fetching spend entries from receipts', error, { householdId: household.id });
        return createErrorResponse('Failed to fetch spend entries', 500);
      }

      return createSuccessResponse({
        spend_entries: spendEntries ?? [],
        count: spendEntries?.length ?? 0,
      }, 'Spend entries fetched');
    } catch (error) {
      return handleApiError(error, { route: '/api/finance/receipt-to-spending', method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
  });
}
