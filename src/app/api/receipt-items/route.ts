import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { z } from 'zod';

const addToShoppingListSchema = z.object({
  item_ids: z.array(z.string().uuid()).min(1),
  shopping_list_id: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const attachment_id = searchParams.get('attachment_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getDatabaseClient();
    
    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
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
      .eq('household_id', userData.household_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by attachment if specified
    if (attachment_id) {
      query = query.eq('attachment_id', attachment_id);
    }

    const { data: receiptItems, error: fetchError } = await query;

    if (fetchError) {
      console.error('❌ Error fetching receipt items:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch receipt items' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      receipt_items: receiptItems || [],
      count: receiptItems?.length || 0
    });

  } catch (error) {
    console.error('❌ Error in receipt-items GET API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = addToShoppingListSchema.parse(body);
    const { item_ids, shopping_list_id } = validatedData;

    const supabase = getDatabaseClient();
    
    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get receipt items
    const { data: receiptItems, error: itemsError } = await supabase
      .from('receipt_items')
      .select('*')
      .in('id', item_ids)
      .eq('household_id', userData.household_id);

    if (itemsError || !receiptItems || receiptItems.length === 0) {
      return NextResponse.json({ error: 'Receipt items not found' }, { status: 404 });
    }

    // Get or create shopping list
    let listId = shopping_list_id;
    if (!listId) {
      // Create default "Groceries" list
      const { data: existingList, error: listError } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('household_id', userData.household_id)
        .eq('title', 'Groceries')
        .maybeSingle();

      if (listError) {
        return NextResponse.json({ error: 'Failed to check shopping lists' }, { status: 500 });
      }

      if (existingList) {
        listId = existingList.id;
      } else {
        const { data: newList, error: createError } = await supabase
          .from('shopping_lists')
          .insert([{
            household_id: userData.household_id,
            title: 'Groceries',
            created_by: userId
          }])
          .select('id')
          .single();

        if (createError) {
          return NextResponse.json({ error: 'Failed to create shopping list' }, { status: 500 });
        }

        listId = newList.id;
      }
    }

    // Add items to shopping list
    const shoppingItems = receiptItems.map(item => ({
      list_id: listId,
      name: item.item_name,
      quantity: item.item_quantity || 1,
      category: item.item_category,
      notes: `From receipt: ${item.attachment?.file_name || 'Unknown'}`,
      created_by: userId
    }));

    const { data: createdItems, error: createError } = await supabase
      .from('shopping_items')
      .insert(shoppingItems)
      .select('id');

    if (createError) {
      console.error('❌ Error creating shopping items:', createError);
      return NextResponse.json({ error: 'Failed to add items to shopping list' }, { status: 500 });
    }

    // Update receipt items to mark as added to shopping list
    const { error: updateError } = await supabase
      .from('receipt_items')
      .update({
        added_to_shopping_list: true,
        shopping_list_id: listId,
        shopping_item_id: createdItems?.[0]?.id // Store first item ID for reference
      })
      .in('id', item_ids);

    if (updateError) {
      console.error('❌ Error updating receipt items:', updateError);
      // Don't fail the request as items were already added to shopping list
    }

    return NextResponse.json({
      success: true,
      message: `Added ${receiptItems.length} items to shopping list`,
      added_items: createdItems?.length || 0,
      shopping_list_id: listId
    });

  } catch (error) {
    console.error('❌ Error in receipt-items POST API:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { item_id, updates } = body;

    if (!item_id || !updates) {
      return NextResponse.json({ error: 'item_id and updates required' }, { status: 400 });
    }

    const supabase = getDatabaseClient();
    
    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update receipt item
    const { data: updatedItem, error: updateError } = await supabase
      .from('receipt_items')
      .update({
        ...updates,
        user_modified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', item_id)
      .eq('household_id', userData.household_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating receipt item:', updateError);
      return NextResponse.json({ error: 'Failed to update receipt item' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      receipt_item: updatedItem
    });

  } catch (error) {
    console.error('❌ Error in receipt-items PUT API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
