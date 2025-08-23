import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { canAccessFeature } from '@/lib/server/canAccessFeature';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_request: NextRequest) {
  // Force new deployment - debugging enabled
  console.log('🚀 GET: Function called - before try block');
  try {
    console.log('🔄 GET: Starting shopping lists fetch...');
    const { userId } = await auth();
    if (!userId) {
      console.log('❌ GET: No userId from auth');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ GET: Got userId:', userId);

    // Get user's household and plan
    console.log('🔍 GET: Querying user data from database...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        household_id,
        households!inner(
          plan
        )
      `)
      .eq('id', userId)
      .single();

    console.log('📊 GET: User data query result:', { userData, userError });

    if (userError) {
      console.error('❌ GET: Error fetching user data:', userError);
      
      // Check if it's a "not found" error vs other database errors
      if (userError.code === 'PGRST116') {
        return NextResponse.json({ 
          error: 'User not found. Please complete onboarding first.',
          needsOnboarding: true,
          redirectTo: '/onboarding'
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch user data', 
        details: userError.message 
      }, { status: 500 });
    }

    if (!userData) {
      return NextResponse.json({ 
        error: 'User not found in database. Please complete onboarding first.',
        needsOnboarding: true,
        redirectTo: '/onboarding'
      }, { status: 404 });
    }

    if (!userData.household_id) {
      return NextResponse.json({ 
        error: 'Household not set up. Please complete onboarding first.',
        needsOnboarding: true,
        redirectTo: '/onboarding'
      }, { status: 404 });
    }

    const householdId = userData.household_id;
    const userPlan = userData.households?.[0]?.plan || 'free';
    
    console.log('🏠 GET: Household ID:', householdId);
    console.log('💳 GET: User plan:', userPlan);
    console.log('🔐 GET: Checking feature access for meal_planner...');

    // Check feature access for advanced features
    if (!canAccessFeature(userPlan, 'meal_planner')) {
      console.log('⚠️ GET: User does not have access to meal_planner, returning basic lists');
      // If user doesn't have access, return basic lists without AI features
      console.log('📋 GET: Querying basic shopping lists for household:', householdId);
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

      console.log('📊 GET: Basic lists query result:', { shoppingLists, listsError });

      if (listsError) {
        console.error('❌ GET: Error fetching shopping lists:', listsError);
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
           completed_items: completedItems,
           ai_suggestions_count: 0, // Default value since column doesn't exist
           ai_confidence: 75 // Default value since column doesn't exist
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
        ai_suggestions_count: 0, // Default value since column doesn't exist
        ai_confidence: 75 // Default value since column doesn't exist
      };
    }) || [];

    return NextResponse.json({
      success: true,
      shoppingLists: shoppingListsWithCounts,
      plan: userPlan
    });

  } catch (error) {
    console.error('💥 GET: Unexpected error in shopping lists fetch:', error);
    console.error('💥 GET: Error details:', {
      name: (error as any)?.name,
      message: (error as any)?.message,
      stack: (error as any)?.stack,
      cause: (error as any)?.cause
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch shopping lists',
        details: (error as any)?.message || 'Unknown error'
      },
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

    console.log('POST: Fetching user data for userId:', userId);

    // Get user's household and plan
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        household_id,
        households!inner(
          plan
        )
      `)
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('POST: Error fetching user data:', userError);
      
      // Check if it's a "not found" error vs other database errors
      if (userError.code === 'PGRST116') {
        return NextResponse.json({ 
          error: 'User not found. Please complete onboarding first.',
          needsOnboarding: true,
          redirectTo: '/onboarding'
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch user data', 
        details: userError.message 
      }, { status: 500 });
    }

    if (!userData) {
      return NextResponse.json({ 
        error: 'User not found in database. Please complete onboarding first.',
        needsOnboarding: true,
        redirectTo: '/onboarding'
      }, { status: 404 });
    }

    if (!userData.household_id) {
      return NextResponse.json({ 
        error: 'Household not set up. Please complete onboarding first.',
        needsOnboarding: true,
        redirectTo: '/onboarding'
      }, { status: 404 });
    }

    const householdId = userData.household_id;
    const userPlan = userData.households?.[0]?.plan || 'free';

    // Check feature access for premium features
    if (!canAccessFeature(userPlan, 'meal_planner')) {
      return NextResponse.json({ 
        error: 'Feature not available on your plan',
        requiredPlan: 'premium'
      }, { status: 403 });
    }

    // Create new shopping list
    const insertData = {
      title: validatedData.name,
      description: validatedData.description,
      household_id: householdId,
      created_by: userId
    };
    
    console.log('Attempting to insert shopping list with data:', insertData);
    
    const { data: newList, error: createError } = await supabase
      .from('shopping_lists')
      .insert(insertData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating shopping list:', createError);
      console.error('Create error details:', {
        code: createError.code,
        message: createError.message,
        details: createError.details,
        hint: createError.hint
      });
      return NextResponse.json({ 
        error: 'Failed to create shopping list',
        details: createError.message 
      }, { status: 500 });
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

    // Transform the new list to match the GET response format
    const transformedList = {
      id: newList.id,
      name: newList.title || newList.name,
      description: newList.description,
      created_at: newList.created_at,
      updated_at: newList.updated_at || newList.created_at,
      is_completed: false,
      total_items: 0,
      completed_items: 0,
      ai_suggestions_count: 0,
      ai_confidence: 75
    };

    return NextResponse.json({
      success: true,
      shoppingList: transformedList,
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
