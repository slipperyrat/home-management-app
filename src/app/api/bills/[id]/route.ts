import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createBillSchema } from '@/lib/validation/schemas';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { id: billId } = await params;

      if (!billId) {
        return createErrorResponse('Bill ID is required', 400);
      }

      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      const { data: bill, error: fetchError } = await supabase
        .from('bills')
        .select('*')
        .eq('id', billId)
        .eq('household_id', household.id)
        .single();

      if (fetchError || !bill) {
        return createErrorResponse('Bill not found or access denied', 404);
      }

      return createSuccessResponse({ bill }, 'Bill fetched successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/bills/[id]', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { id: billId } = await params;

      if (!billId) {
        return createErrorResponse('Bill ID is required', 400);
      }

      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      let validatedData;
      try {
        const body = await req.json();
        const tempSchema = createBillSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
      } catch (validationError: any) {
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      const supabase = getDatabaseClient();

      // First, verify the bill exists and belongs to the user's household
      const { data: existingBill, error: fetchError } = await supabase
        .from('bills')
        .select('id, household_id, title')
        .eq('id', billId)
        .eq('household_id', household.id)
        .single();

      if (fetchError || !existingBill) {
        return createErrorResponse('Bill not found or access denied', 404);
      }

      // Update the bill
      const { data: bill, error: updateError } = await supabase
        .from('bills')
        .update({
          title: validatedData.title,
          description: validatedData.description,
          amount: validatedData.amount,
          due_date: validatedData.due_date,
          category: validatedData.category || 'General',
          priority: validatedData.priority || 'medium',
          updated_at: new Date().toISOString()
        })
        .eq('id', billId)
        .eq('household_id', household.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Database update error:', updateError);
        return createErrorResponse('Failed to update bill in database', 500, updateError.message);
      }

      await createAuditLog({
        action: 'bill.updated',
        targetTable: 'bills',
        targetId: billId,
        userId: user.id,
        metadata: { 
          bill_title: validatedData.title,
          amount: validatedData.amount,
          household_id: household.id
        }
      });

      return createSuccessResponse({ bill }, 'Bill updated successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/bills/[id]', method: 'PUT', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { id: billId } = await params;

      if (!billId) {
        return createErrorResponse('Bill ID is required', 400);
      }

      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      // First, verify the bill exists and belongs to the user's household
      const { data: existingBill, error: fetchError } = await supabase
        .from('bills')
        .select('id, household_id, title')
        .eq('id', billId)
        .eq('household_id', household.id)
        .single();

      if (fetchError || !existingBill) {
        return createErrorResponse('Bill not found or access denied', 404);
      }

      // Delete the bill
      const { error: deleteError } = await supabase
        .from('bills')
        .delete()
        .eq('id', billId)
        .eq('household_id', household.id);

      if (deleteError) {
        console.error('Database delete error:', deleteError);
        return createErrorResponse('Failed to delete bill from database', 500, deleteError.message);
      }

      await createAuditLog({
        action: 'bill.deleted',
        targetTable: 'bills',
        targetId: billId,
        userId: user.id,
        metadata: { 
          bill_title: existingBill.title,
          household_id: household.id
        }
      });

      return createSuccessResponse({}, 'Bill deleted successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/bills/[id]', method: 'DELETE', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
