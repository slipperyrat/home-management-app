import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createBillSchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 GET: Fetching bills for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Fetch bills for the household
      const supabase = getDatabaseClient();
      const { data: bills, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .eq('household_id', household.id)
        .order('due_date', { ascending: true });

      if (billsError) {
        console.error('Error fetching bills:', billsError);
        return createErrorResponse('Failed to fetch bills', 500, billsError.message);
      }

      return createSuccessResponse({ bills: bills || [] }, 'Bills fetched successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/bills', method: 'GET', userId: user.id });
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
      console.log('🚀 POST: Creating bill for user:', user.id);

      // Validate input using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        const tempSchema = createBillSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
      } catch (validationError: any) {
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Create the bill with validated data
      const supabase = getDatabaseClient();
      const { data: bill, error: createError } = await supabase
        .from('bills')
        .insert({
          household_id: household.id,
          title: validatedData.title,
          description: validatedData.description,
          amount: validatedData.amount,
          due_date: validatedData.due_date,
          category: validatedData.category || 'General',
          priority: validatedData.priority || 'medium',
          source: 'manual',
          created_by: user.id
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating bill:', createError);
        return createErrorResponse('Failed to create bill', 500, createError.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'bill.created',
        targetTable: 'bills',
        targetId: bill.id,
        userId: user.id,
        metadata: { 
          bill_title: validatedData.title,
          amount: validatedData.amount,
          household_id: household.id
        }
      });

      return createSuccessResponse({ bill }, 'Bill created successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/bills', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
