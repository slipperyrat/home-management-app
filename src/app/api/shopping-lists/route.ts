import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { requireFeatureAccess } from '@/lib/server/canAccessFeature';
import { z } from 'zod';

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
      .select('household_id, plan')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const householdId = userData.household_id;
    const userPlan = userData.plan || 'free';

    // Check feature access for advanced features
    try {
      requireFeatureAccess(userPlan, 'meal_planner');
    } catch (error) {
      // If user doesn't have access, return basic lists without AI features
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

      const basicShoppingLists = shoppingLists?.map(list => {
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
          completed_items: completedItems
        };
      }) || [];

      return NextResponse.json({
        success: true,
        shoppingLists: basicShoppingLists,
        plan: userPlan
      });
    }

    // Fetch shopping lists with items (full features for premium users)
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
      shoppingLists: shoppingListsWithCounts,
      plan: userPlan
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

    // Validate input using Zod (without household_id since it comes from user context)
    let validatedData;
    try {
      const body = await request.json();
      // Create a temporary schema for validation that doesn't require household_id
      const tempSchema = z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      });
      validatedData = tempSchema.parse(body);
    } catch (validationError: any) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: validationError.errors 
      }, { status: 400 });
    }

    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id, plan')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const householdId = userData.household_id;
    const userPlan = userData.plan || 'free';

    // Check feature access for premium features
    try {
      requireFeatureAccess(userPlan, 'meal_planner');
    } catch (error) {
      return NextResponse.json({ 
        error: 'Feature not available on your plan',
        requiredPlan: 'premium'
      }, { status: 403 });
    }

    // Create new shopping list
    const { data: newList, error: createError } = await supabase
      .from('shopping_lists')
      .insert({
        title: validatedData.name,
        description: validatedData.description,
        household_id: householdId,
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

    // Add audit log entry
    try {
      await supabase.rpc('add_audit_log', {
        p_action: 'shopping_list.created',
        p_target_table: 'shopping_lists',
        p_target_id: newList.id,
        p_meta: { 
          list_name: validatedData.name,
          household_id: householdId,
          user_plan: userPlan
        }
      });
    } catch (auditError) {
      console.warn('Failed to add audit log:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      shoppingList: newList,
      plan: userPlan
    });

  } catch (error) {
    console.error('Error creating shopping list:', error);
    return NextResponse.json(
      { error: 'Failed to create shopping list' },
      { status: 500 }
    );
  }
}
