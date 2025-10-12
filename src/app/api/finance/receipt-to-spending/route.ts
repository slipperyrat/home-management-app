import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createSpendEntriesFromReceipt, suggestBudgetEnvelopeForReceipt } from '@/lib/finance/receiptIntegration';
import { z } from 'zod';
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
  return withAPISecurity(request, async (req, user) => {
    try {
      const { household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      const body = await request.json();
      const validatedData = createSpendingFromReceiptSchema.parse(body);

      const db = getDatabaseClient();

      // Get receipt items
      const { data: receiptItems, error: itemsError } = await db
        .from('receipt_items')
        .select(`
          *,
          attachment:attachments (
            id,
            file_name,
            receipt_store,
            receipt_date
          )
        `)
        .in('id', validatedData.receipt_item_ids)
        .eq('household_id', household.id);

      if (itemsError || !receiptItems || receiptItems.length === 0) {
        return createErrorResponse('Receipt items not found', 404);
      }

      // Check if items are already added to spending
      const alreadyAdded = receiptItems.filter(item => item.added_to_spending);
      if (alreadyAdded.length > 0) {
        return createErrorResponse('Some receipt items are already added to spending', 400, {
          already_added: alreadyAdded.map(item => item.id)
        });
      }

      // Suggest budget envelope if not provided
      let envelopeId = validatedData.envelope_id;
      if (!envelopeId) {
        envelopeId = await suggestBudgetEnvelopeForReceipt(receiptItems, household.id) || undefined;
      }

      // Create spend entries from receipt items
      const spendEntries = await createSpendEntriesFromReceipt(
        receiptItems,
        household.plan || 'free',
        user.id,
        {
          envelope_id: envelopeId,
          payment_method: validatedData.payment_method,
          create_single_entry: validatedData.create_single_entry
        }
      );

      // Log audit event
      await createAuditLog({
        actor_id: user.id,
        household_id: household.id,
        action: 'spending.create_from_receipt',
        target_table: 'spend_entries',
        meta: { 
          receipt_item_count: receiptItems.length,
          spend_entry_count: spendEntries.length,
          envelope_id: envelopeId,
          create_single_entry: validatedData.create_single_entry
        }
      });

      return createSuccessResponse({ 
        spend_entries: spendEntries,
        suggested_envelope: envelopeId,
        message: `Created ${spendEntries.length} spend entries from ${receiptItems.length} receipt items`
      }, 201);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, 'Failed to create spend entries from receipt');
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function DELETE(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
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
        .select('id, added_to_spending')
        .in('id', validatedData.receipt_item_ids)
        .eq('household_id', household.id);

      if (itemsError || !receiptItems || receiptItems.length === 0) {
        return createErrorResponse('Receipt items not found', 404);
      }

      // Check if items have spend entries
      const itemsWithSpending = receiptItems.filter(item => item.added_to_spending);
      if (itemsWithSpending.length === 0) {
        return createErrorResponse('No spend entries found for these receipt items', 400);
      }

      // Import the delete function
      const { deleteSpendEntriesFromReceipt } = await import('@/lib/finance/receiptIntegration');
      
      // Delete spend entries
      await deleteSpendEntriesFromReceipt(validatedData.receipt_item_ids, household.id);

      // Log audit event
      await createAuditLog({
        actor_id: user.id,
        household_id: household.id,
        action: 'spending.delete_from_receipt',
        target_table: 'spend_entries',
        meta: { 
          receipt_item_count: validatedData.receipt_item_ids.length
        }
      });

      return createSuccessResponse({ 
        message: 'Spend entries deleted successfully',
        deleted_items: validatedData.receipt_item_ids.length
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, 'Failed to delete spend entries from receipt');
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
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
        .select(`
          *,
          budget_envelopes(name, color),
          receipt_items(id, item_name, item_price)
        `)
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
        spend_entries: spendEntries || [],
        count: spendEntries?.length || 0
      });

    } catch (error) {
      return handleApiError(error, 'Failed to fetch spend entries from receipts');
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}
