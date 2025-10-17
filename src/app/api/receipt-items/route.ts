import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { z } from 'zod';
import type { Database } from '@/types/supabase.generated';

const addToShoppingListSchema = z.object({
  item_ids: z.array(z.string().uuid()).min(1),
  shopping_list_id: z.string().uuid().optional(),
});

type ReceiptItemRow = Database['public']['Tables']['receipt_items']['Row'];
type ShoppingItemInsert = Database['public']['Tables']['shopping_items']['Insert'];

type ReceiptItemWithAttachment = ReceiptItemRow & {
  attachments?: { file_name: string | null } | null;
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const attachment_id = searchParams.get('attachment_id');
    const limit = Number.parseInt(searchParams.get('limit') ?? '100', 10);
    const offset = Number.parseInt(searchParams.get('offset') ?? '0', 10);

    const supabase = getDatabaseClient();

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userData?.household_id) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    let query = supabase
      .from('receipt_items')
      .select(
        `
          *,
          attachments ( file_name )
        `,
      )
      .eq('household_id', userData.household_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (attachment_id) {
      query = query.eq('attachment_id', attachment_id);
    }

    const { data: receiptItems, error: fetchError } = await query;

    if (fetchError) {
      return Response.json({ error: 'Failed to fetch receipt items' }, { status: 500 });
    }

    return Response.json({
      success: true,
      receipt_items: (receiptItems as ReceiptItemWithAttachment[] | null) ?? [],
      count: receiptItems?.length ?? 0,
    });
  } catch (error) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = addToShoppingListSchema.parse(body);
    const { item_ids, shopping_list_id } = validatedData;

    const supabase = getDatabaseClient();

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userData?.household_id) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: receiptItems, error: itemsError } = await supabase
      .from('receipt_items')
      .select('id, item_name, item_quantity, item_category')
      .in('id', item_ids)
      .eq('household_id', userData.household_id);

    if (itemsError || !receiptItems || receiptItems.length === 0) {
      return Response.json({ error: 'Receipt items not found' }, { status: 404 });
    }

    let listId = shopping_list_id ?? null;
    if (!listId) {
      const { data: existingList, error: listError } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('household_id', userData.household_id)
        .eq('title', 'Groceries')
        .maybeSingle();

      if (listError) {
        return Response.json({ error: 'Failed to check shopping lists' }, { status: 500 });
      }

      if (existingList) {
        listId = existingList.id;
      } else {
        const { data: newList, error: createError } = await supabase
          .from('shopping_lists')
          .insert({
            household_id: userData.household_id,
            title: 'Groceries',
            created_by: userId,
          } satisfies Database['public']['Tables']['shopping_lists']['Insert'])
          .select('id')
          .maybeSingle();

        if (createError || !newList) {
          return Response.json({ error: 'Failed to create shopping list' }, { status: 500 });
        }

        listId = newList.id;
      }
    }

    const shoppingItems: ShoppingItemInsert[] = receiptItems.map((item) => ({
      list_id: listId!,
      name: item.item_name,
      quantity: item.item_quantity != null ? String(item.item_quantity) : null,
      category: item.item_category ?? null,
      notes: null,
      created_by: userId,
    }));

    const { data: createdItems, error: createError } = await supabase
      .from('shopping_items')
      .insert(shoppingItems)
      .select('id');

    if (createError) {
      return Response.json({ error: 'Failed to add items to shopping list' }, { status: 500 });
    }

    const firstItemId = createdItems?.[0]?.id ?? null;

    const { error: updateError } = await supabase
      .from('receipt_items')
      .update({
        added_to_shopping_list: true,
        shopping_list_id: listId,
        shopping_item_id: firstItemId,
      })
      .in('id', item_ids)
      .eq('household_id', userData.household_id);

    if (updateError) {
      // Items were added; log but do not fail response
      console.error('Error updating receipt items:', updateError);
    }

    return Response.json({
      success: true,
      message: `Added ${receiptItems.length} items to shopping list`,
      added_items: createdItems?.length ?? 0,
      shopping_list_id: listId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { item_id, updates } = body as { item_id?: string; updates?: Partial<ReceiptItemRow> };

    if (!item_id || !updates) {
      return Response.json({ error: 'item_id and updates required' }, { status: 400 });
    }

    const supabase = getDatabaseClient();

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userData?.household_id) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const updatePayload: Partial<ReceiptItemRow> = {
      ...updates,
      user_modified: true,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedItem, error: updateError } = await supabase
      .from('receipt_items')
      .update(updatePayload)
      .eq('id', item_id)
      .eq('household_id', userData.household_id)
      .select('*')
      .maybeSingle();

    if (updateError || !updatedItem) {
      return Response.json({ error: 'Failed to update receipt item' }, { status: 500 });
    }

    return Response.json({
      success: true,
      receipt_item: updatedItem,
    });
  } catch (error) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
