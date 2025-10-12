import { getDatabaseClient } from '@/lib/api/database';
import { canAccessFeature } from '@/lib/server/canAccessFeature';
import { logger } from '@/lib/logging/logger';
import type { Database, ReceiptItem } from '@/types/database';

interface SpendEntryInput {
  household_id: string;
  amount: number;
  description: string;
  category: string;
  envelope_id?: string;
  receipt_attachment_id: string;
  transaction_date: string;
  merchant: string;
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'other';
  source: 'receipt_ocr';
  created_by: string;
}

export async function createSpendEntriesFromReceipt(
  receiptItems: ReceiptItem[],
  householdPlan: string,
  createdBy: string,
  options: {
    envelope_id?: string;
    payment_method?: 'cash' | 'card' | 'bank_transfer' | 'other';
    create_single_entry?: boolean;
  } = {},
): Promise<Database['public']['Tables']['spend_entries']['Row'][]> {
  if (!canAccessFeature(householdPlan, 'spending_tracking')) {
    throw new Error('Spending tracking requires Premium plan or higher');
  }

  const db = getDatabaseClient();
  const spendEntries: Database['public']['Tables']['spend_entries']['Row'][] = [];
  const paymentMethod = options.payment_method ?? 'card';

  if (options.create_single_entry && receiptItems.length > 0) {
    const totalAmount = receiptItems.reduce((sum, item) => sum + item.item_price, 0);
    const storeName = receiptItems[0].attachment?.receipt_store ?? 'Unknown Store';
    const receiptDate = receiptItems[0].attachment?.receipt_date ?? new Date().toISOString().split('T')[0];
    const description = `Receipt from ${storeName}: ${receiptItems.map((item) => item.item_name).join(', ')}`;

    const spendEntryInput: SpendEntryInput = {
      household_id: receiptItems[0].household_id,
      amount: totalAmount,
      description,
      category: 'groceries',
      envelope_id: options.envelope_id,
      receipt_attachment_id: receiptItems[0].attachment_id,
      transaction_date: receiptDate,
      merchant: storeName,
      payment_method: paymentMethod,
      source: 'receipt_ocr',
      created_by: createdBy,
    };

    const { data: createdEntry, error } = await db
      .from('spend_entries')
      .insert(spendEntryInput)
      .select()
      .single();

    if (error || !createdEntry) {
      logger.error('Error creating spend entry from receipt', error ?? new Error('No entry returned'), {
        householdId: receiptItems[0].household_id,
      });
      throw new Error(`Failed to create spend entry: ${error?.message ?? 'Unknown error'}`);
    }

    await db
      .from('receipt_items')
      .update({
        spend_entry_id: createdEntry.id,
        added_to_spending: true,
      })
      .in('id', receiptItems.map((item) => item.id));

    spendEntries.push(createdEntry);
    return spendEntries;
  }

  for (const item of receiptItems) {
    const storeName = item.attachment?.receipt_store ?? 'Unknown Store';
    const receiptDate = item.attachment?.receipt_date ?? new Date().toISOString().split('T')[0];

    const spendEntryInput: SpendEntryInput = {
      household_id: item.household_id,
      amount: item.item_price,
      description: `${item.item_name} from ${storeName}`,
      category: item.item_category ?? 'groceries',
      envelope_id: options.envelope_id,
      receipt_attachment_id: item.attachment_id,
      transaction_date: receiptDate,
      merchant: storeName,
      payment_method: paymentMethod,
      source: 'receipt_ocr',
      created_by: createdBy,
    };

    const { data: createdEntry, error } = await db
      .from('spend_entries')
      .insert(spendEntryInput)
      .select()
      .single();

    if (error || !createdEntry) {
      logger.warn('Error creating spend entry for item', { itemId: item.id, error });
      continue;
    }

    await db
      .from('receipt_items')
      .update({
        spend_entry_id: createdEntry.id,
        added_to_spending: true,
      })
      .eq('id', item.id);

    spendEntries.push(createdEntry);
  }

  return spendEntries;
}

export async function getSpendEntriesFromReceipt(
  receiptItemIds: string[],
  householdId: string,
): Promise<Database['public']['Tables']['spend_entries']['Row'][]> {
  const db = getDatabaseClient();

  const { data: spendEntries, error } = await db
    .from('spend_entries')
    .select('*, budget_envelopes(name, color)')
    .eq('household_id', householdId)
    .eq('source', 'receipt_ocr')
    .in('receipt_attachment_id', receiptItemIds);

  if (error) {
    logger.error('Error fetching spend entries from receipt', error, { householdId });
    return [];
  }

  return spendEntries ?? [];
}

export async function deleteSpendEntriesFromReceipt(
  receiptItemIds: string[],
  householdId: string,
): Promise<void> {
  const db = getDatabaseClient();

  const { data: spendEntries, error: fetchError } = await db
    .from('spend_entries')
    .select('id')
    .eq('household_id', householdId)
    .eq('source', 'receipt_ocr')
    .in('receipt_attachment_id', receiptItemIds);

  if (fetchError) {
    logger.error('Error fetching spend entries for deletion', fetchError, { householdId });
    return;
  }

  if (!spendEntries || spendEntries.length === 0) {
    return;
  }

  const spendEntryIds = spendEntries.map((entry) => entry.id);

  const { error: deleteError } = await db
    .from('spend_entries')
    .delete()
    .in('id', spendEntryIds);

  if (deleteError) {
    logger.error('Error deleting spend entries', deleteError, { householdId });
    return;
  }

  await db
    .from('receipt_items')
    .update({
      spend_entry_id: null,
      added_to_spending: false,
    })
    .in('id', receiptItemIds);

  logger.info('Deleted spend entries from receipt items', {
    householdId,
    count: spendEntryIds.length,
  });
}

export async function updateSpendEntriesFromReceipt(
  receiptItemId: string,
  updates: {
    item_price?: number;
    item_name?: string;
    item_category?: string;
  },
  householdId: string,
): Promise<void> {
  const db = getDatabaseClient();

  const { data: receiptItem, error: itemError } = await db
    .from('receipt_items')
    .select('*')
    .eq('id', receiptItemId)
    .eq('household_id', householdId)
    .single();

  if (itemError || !receiptItem) {
    logger.error('Error fetching receipt item for update', itemError ?? new Error('Item not found'), {
      receiptItemId,
      householdId,
    });
    return;
  }

  const { data: spendEntry, error: spendError } = await db
    .from('spend_entries')
    .select('*')
    .eq('receipt_attachment_id', receiptItem.attachment_id)
    .eq('household_id', householdId)
    .eq('source', 'receipt_ocr')
    .single();

  if (spendError || !spendEntry) {
    logger.warn('No spend entry found for receipt item update', {
      receiptItemId,
      householdId,
      error: spendError,
    });
    return;
  }

  const spendUpdates: Partial<Database['public']['Tables']['spend_entries']['Row']> = {};

  if (updates.item_price !== undefined) {
    spendUpdates.amount = updates.item_price;
  }

  if (updates.item_name !== undefined) {
    spendUpdates.description = `${updates.item_name} from ${spendEntry.merchant ?? 'Unknown Store'}`;
  }

  if (updates.item_category !== undefined) {
    spendUpdates.category = updates.item_category;
  }

  if (Object.keys(spendUpdates).length > 0) {
    const { error: updateError } = await db
      .from('spend_entries')
      .update(spendUpdates)
      .eq('id', spendEntry.id);

    if (updateError) {
      logger.error('Error updating spend entry', updateError, {
        spendEntryId: spendEntry.id,
        receiptItemId,
      });
    }
  }
}

export async function suggestBudgetEnvelopeForReceipt(
  receiptItems: ReceiptItem[],
  householdId: string,
): Promise<string | null> {
  const db = getDatabaseClient();

  const { data: envelopes, error } = await db
    .from('budget_envelopes')
    .select('*')
    .eq('household_id', householdId)
    .gte('period_end', new Date().toISOString().split('T')[0]);

  if (error || !envelopes || envelopes.length === 0) {
    return null;
  }

  const categoryCounts: Record<string, number> = {};
  receiptItems.forEach((item) => {
    const category = item.item_category ?? 'other';
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  });

  const mostCommonCategory = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  if (!mostCommonCategory) {
    return null;
  }

  const matchingEnvelope = envelopes.find(
    (env) =>
      env.category === mostCommonCategory ||
      env.category === 'general' ||
      env.name.toLowerCase().includes(mostCommonCategory),
  );

  return matchingEnvelope?.id ?? null;
}
