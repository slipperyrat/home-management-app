import { getDatabaseClient } from '@/lib/api/database';
import { canAccessFeature } from '@/lib/server/canAccessFeature';

export interface ReceiptItem {
  id: string;
  attachment_id: string;
  household_id: string;
  item_name: string;
  item_price: number;
  item_quantity: number;
  item_category?: string;
  item_brand?: string;
  item_unit?: string;
  confidence_score: number;
  attachment?: {
    id: string;
    file_name: string;
    receipt_store?: string;
    receipt_date?: string;
  };
}

/**
 * Create spend entries from receipt items
 */
export async function createSpendEntriesFromReceipt(
  receiptItems: ReceiptItem[],
  householdPlan: string,
  created_by: string,
  options: {
    envelope_id?: string;
    payment_method?: 'cash' | 'card' | 'bank_transfer' | 'other';
    create_single_entry?: boolean; // Create one entry for all items or individual entries
  } = {}
): Promise<any[]> {
  
  // Check if user has access to spending tracking
  if (!canAccessFeature(householdPlan as any, 'spending_tracking')) {
    throw new Error('Spending tracking requires Premium plan or higher');
  }

  const db = getDatabaseClient();
  const spendEntries = [];

  if (options.create_single_entry && receiptItems.length > 0) {
    // Create a single spend entry for all items
    const totalAmount = receiptItems.reduce((sum, item) => sum + item.item_price, 0);
    const storeName = receiptItems[0].attachment?.receipt_store || 'Unknown Store';
    const receiptDate = receiptItems[0].attachment?.receipt_date || new Date().toISOString().split('T')[0];
    
    // Combine all item names
    const description = `Receipt from ${storeName}: ${receiptItems.map(item => item.item_name).join(', ')}`;

    const spendEntry = {
      household_id: receiptItems[0].household_id,
      amount: totalAmount,
      description,
      category: 'groceries', // Default category for receipt purchases
      envelope_id: options.envelope_id,
      receipt_attachment_id: receiptItems[0].attachment_id,
      transaction_date: receiptDate,
      merchant: storeName,
      payment_method: options.payment_method || 'card',
      source: 'receipt_ocr',
      created_by
    };

    const { data: createdEntry, error } = await db
      .from('spend_entries')
      .insert(spendEntry)
      .select()
      .single();

    if (error) {
      console.error('Error creating spend entry from receipt:', error);
      throw new Error(`Failed to create spend entry: ${error.message}`);
    }

    // Update receipt items to link with spend entry
    await db
      .from('receipt_items')
      .update({
        spend_entry_id: createdEntry.id,
        added_to_spending: true
      })
      .in('id', receiptItems.map(item => item.id));

    spendEntries.push(createdEntry);
  } else {
    // Create individual spend entries for each item
    for (const item of receiptItems) {
      const storeName = item.attachment?.receipt_store || 'Unknown Store';
      const receiptDate = item.attachment?.receipt_date || new Date().toISOString().split('T')[0];

      const spendEntry = {
        household_id: item.household_id,
        amount: item.item_price,
        description: `${item.item_name} from ${storeName}`,
        category: item.item_category || 'groceries',
        envelope_id: options.envelope_id,
        receipt_attachment_id: item.attachment_id,
        transaction_date: receiptDate,
        merchant: storeName,
        payment_method: options.payment_method || 'card',
        source: 'receipt_ocr',
        created_by
      };

      const { data: createdEntry, error } = await db
        .from('spend_entries')
        .insert(spendEntry)
        .select()
        .single();

      if (error) {
        console.error(`Error creating spend entry for item ${item.id}:`, error);
        continue; // Continue with other items
      }

      // Update receipt item to link with spend entry
      await db
        .from('receipt_items')
        .update({
          spend_entry_id: createdEntry.id,
          added_to_spending: true
        })
        .eq('id', item.id);

      spendEntries.push(createdEntry);
    }
  }

  return spendEntries;
}

/**
 * Get spend entries created from receipt items
 */
export async function getSpendEntriesFromReceipt(
  receiptItemIds: string[],
  household_id: string
): Promise<any[]> {
  const db = getDatabaseClient();

  const { data: spendEntries, error } = await db
    .from('spend_entries')
    .select(`
      *,
      budget_envelopes(name, color)
    `)
    .eq('household_id', household_id)
    .eq('source', 'receipt_ocr')
    .in('receipt_attachment_id', receiptItemIds);

  if (error) {
    console.error('Error fetching spend entries from receipt:', error);
    return [];
  }

  return spendEntries || [];
}

/**
 * Delete spend entries created from receipt items
 */
export async function deleteSpendEntriesFromReceipt(
  receiptItemIds: string[],
  household_id: string
): Promise<void> {
  const db = getDatabaseClient();

  // Get spend entries linked to these receipt items
  const { data: spendEntries, error: fetchError } = await db
    .from('spend_entries')
    .select('id')
    .eq('household_id', household_id)
    .eq('source', 'receipt_ocr')
    .in('receipt_attachment_id', receiptItemIds);

  if (fetchError) {
    console.error('Error fetching spend entries for deletion:', fetchError);
    return;
  }

  if (!spendEntries || spendEntries.length === 0) {
    return;
  }

  const spendEntryIds = spendEntries.map(entry => entry.id);

  // Delete spend entries
  const { error: deleteError } = await db
    .from('spend_entries')
    .delete()
    .in('id', spendEntryIds);

  if (deleteError) {
    console.error('Error deleting spend entries:', deleteError);
    return;
  }

  // Update receipt items to remove spend entry links
  await db
    .from('receipt_items')
    .update({
      spend_entry_id: null,
      added_to_spending: false
    })
    .in('id', receiptItemIds);

  console.log(`Deleted ${spendEntryIds.length} spend entries from receipt items`);
}

/**
 * Update spend entries when receipt items are modified
 */
export async function updateSpendEntriesFromReceipt(
  receiptItemId: string,
  updates: {
    item_price?: number;
    item_name?: string;
    item_category?: string;
  },
  household_id: string
): Promise<void> {
  const db = getDatabaseClient();

  // Get the receipt item
  const { data: receiptItem, error: itemError } = await db
    .from('receipt_items')
    .select('*')
    .eq('id', receiptItemId)
    .eq('household_id', household_id)
    .single();

  if (itemError || !receiptItem) {
    console.error('Error fetching receipt item for update:', itemError);
    return;
  }

  // Get the associated spend entry
  const { data: spendEntry, error: spendError } = await db
    .from('spend_entries')
    .select('*')
    .eq('receipt_attachment_id', receiptItem.attachment_id)
    .eq('household_id', household_id)
    .eq('source', 'receipt_ocr')
    .single();

  if (spendError || !spendEntry) {
    console.error('Error fetching spend entry for update:', spendError);
    return;
  }

  // Update spend entry
  const spendUpdates: any = {};
  
  if (updates.item_price !== undefined) {
    spendUpdates.amount = updates.item_price;
  }
  
  if (updates.item_name !== undefined) {
    spendUpdates.description = `${updates.item_name} from ${spendEntry.merchant || 'Unknown Store'}`;
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
      console.error('Error updating spend entry:', updateError);
    }
  }
}

/**
 * Suggest budget envelope for receipt items based on categories
 */
export async function suggestBudgetEnvelopeForReceipt(
  receiptItems: ReceiptItem[],
  household_id: string
): Promise<string | null> {
  
  const db = getDatabaseClient();

  // Get available budget envelopes
  const { data: envelopes, error } = await db
    .from('budget_envelopes')
    .select('*')
    .eq('household_id', household_id)
    .gte('period_end', new Date().toISOString().split('T')[0]); // Active envelopes

  if (error || !envelopes || envelopes.length === 0) {
    return null;
  }

  // Analyze receipt items to find the most common category
  const categoryCounts: Record<string, number> = {};
  receiptItems.forEach(item => {
    const category = item.item_category || 'other';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  const mostCommonCategory = Object.entries(categoryCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0];

  if (!mostCommonCategory) {
    return null;
  }

  // Find envelope with matching category or general category
  const matchingEnvelope = envelopes.find(env => 
    env.category === mostCommonCategory || 
    env.category === 'general' ||
    env.name.toLowerCase().includes(mostCommonCategory)
  );

  return matchingEnvelope?.id || null;
}
