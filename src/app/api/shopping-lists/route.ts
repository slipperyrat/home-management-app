import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const householdId = userData.household_id;

    // Fetch shopping lists with items
    const { data: shoppingLists, error: listsError } = await supabase
      .from('shopping_lists')
      .select(`
        *,
        shopping_items (
          id,
          name,
          quantity,
          completed,
          category,
          created_at
        )
      `)
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (listsError) {
      console.error('Error fetching shopping lists:', listsError);
      return NextResponse.json({ error: 'Failed to fetch shopping lists' }, { status: 500 });
    }

    // Return the shopping lists with enhanced AI data
    const shoppingListsWithCounts = shoppingLists?.map(list => {
      const totalItems = list.shopping_items?.length || 0;
      const completedItems = list.shopping_items?.filter((item: any) => item.completed).length || 0;
      
      return {
        id: list.id,
        name: list.title || list.name,
        description: list.description,
        created_at: list.created_at,
        updated_at: list.updated_at || list.created_at,
        is_completed: completedItems === totalItems && totalItems > 0,
        total_items: totalItems,
        completed_items: completedItems,
        ai_suggestions_count: list.ai_suggestions_count || 0,
        ai_confidence: list.ai_confidence || 75
      };
    }) || [];

    return NextResponse.json({
      success: true,
      shoppingLists: shoppingListsWithCounts
    });

  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shopping lists' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    // Create new shopping list
    const { data: newList, error: createError } = await supabase
      .from('shopping_lists')
      .insert({
        title,
        description,
        household_id: userData.household_id,
        created_by: userId,
        ai_suggestions_count: 0,
        ai_confidence: 75
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating shopping list:', createError);
      return NextResponse.json({ error: 'Failed to create shopping list' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      shoppingList: newList
    });

  } catch (error) {
    console.error('Error creating shopping list:', error);
    return NextResponse.json(
      { error: 'Failed to create shopping list' },
      { status: 500 }
    );
  }
}
