import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { markBillPaidSchema } from '@/lib/validation/schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const resolvedParams = await params;
      const billId = resolvedParams.id;
      
      console.log('🚀 POST: Marking bill as paid for user:', user.id, 'bill:', billId);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Parse and validate request body using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        // Add the bill ID to the validation data
        const validationData = { id: billId, ...body };
        validatedData = markBillPaidSchema.parse(validationData);
      } catch (validationError: any) {
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      // First, verify the bill exists and belongs to the user's household
      const supabase = getDatabaseClient();
      const { data: existingBill, error: fetchError } = await supabase
        .from('bills')
        .select('*')
        .eq('id', billId)
        .eq('household_id', household.id)
        .single();

      if (fetchError || !existingBill) {
        return createErrorResponse('Bill not found', 404);
      }

      // Update the bill to mark it as paid with validated data
      const updateData: any = {
        status: 'paid',
        paid_date: validatedData.paid_date || new Date().toISOString().split('T')[0],
      };

      if (validatedData.paid_amount) {
        updateData.paid_amount = validatedData.paid_amount;
      }

      if (validatedData.payment_method) {
        updateData.payment_method = validatedData.payment_method;
      }

      if (validatedData.notes) {
        updateData.notes = validatedData.notes;
      }

      const { data: updatedBill, error: updateError } = await supabase
        .from('bills')
        .update(updateData)
        .eq('id', billId)
        .eq('household_id', household.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating bill:', updateError);
        return createErrorResponse('Failed to mark bill as paid', 500, updateError.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'bill.marked_paid',
        targetTable: 'bills',
        targetId: billId,
        userId: user.id,
        metadata: { 
          bill_title: existingBill.title,
          paid_amount: validatedData.paid_amount,
          payment_method: validatedData.payment_method,
          household_id: household.id
        }
      });

      return createSuccessResponse({ 
        bill: updatedBill
      }, 'Bill marked as paid successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/bills/[id]/mark-paid', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
