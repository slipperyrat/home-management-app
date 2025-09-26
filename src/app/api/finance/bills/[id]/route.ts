import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { canAccessFeature } from '@/lib/server/canAccessFeature';
import { updateBillCalendarEvent, deleteBillCalendarEvent } from '@/lib/finance/calendarIntegration';
import { z } from 'zod';

// Validation schemas
const updateBillSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  currency: z.string().optional(),
  due_date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format').optional(),
  issued_date: z.string().optional(),
  paid_date: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  source: z.enum(['manual', 'email', 'automation', 'import']).optional(),
  external_id: z.string().optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { userData, household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      // Check feature access
      if (!canAccessFeature(household.plan || 'free', 'bill_management')) {
        return createErrorResponse('Bill management requires Pro plan or higher', 403, {
          requiredPlan: 'pro',
          currentPlan: household.plan || 'free'
        });
      }

      const db = getDatabaseClient();
      const billId = params.id;

      const { data: bill, error } = await db
        .from('bills')
        .select('*')
        .eq('id', billId)
        .eq('household_id', household.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return createErrorResponse('Bill not found', 404);
        }
        console.error('Error fetching bill:', error);
        return createErrorResponse('Failed to fetch bill', 500);
      }

      return createSuccessResponse({ bill });

    } catch (error) {
      return handleApiError(error, 'Failed to fetch bill');
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { userData, household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      // Check feature access
      if (!canAccessFeature(household.plan || 'free', 'bill_management')) {
        return createErrorResponse('Bill management requires Pro plan or higher', 403, {
          requiredPlan: 'pro',
          currentPlan: household.plan || 'free'
        });
      }

      const body = await request.json();
      const validatedData = updateBillSchema.parse(body);
      const billId = params.id;

      const db = getDatabaseClient();

      // First, verify the bill exists and belongs to the household
      const { data: existingBill, error: fetchError } = await db
        .from('bills')
        .select('*')
        .eq('id', billId)
        .eq('household_id', household.id)
        .single();

      if (fetchError || !existingBill) {
        return createErrorResponse('Bill not found', 404);
      }

      // Prepare update data
      const updateData: any = {};
      Object.keys(validatedData).forEach(key => {
        if (validatedData[key as keyof typeof validatedData] !== undefined) {
          updateData[key] = validatedData[key as keyof typeof validatedData];
        }
      });

      // Update bill
      const { data: bill, error } = await db
        .from('bills')
        .update(updateData)
        .eq('id', billId)
        .eq('household_id', household.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating bill:', error);
        return createErrorResponse('Failed to update bill', 500);
      }

      // Update calendar event if needed
      try {
        const calendarUpdates: any = {};
        
        if (updateData.status === 'paid') {
          calendarUpdates.paid = true;
        }
        if (updateData.due_date) {
          calendarUpdates.new_due_date = updateData.due_date;
        }
        if (updateData.amount) {
          calendarUpdates.new_amount = updateData.amount;
        }
        if (updateData.title) {
          calendarUpdates.new_title = updateData.title;
        }
        if (updateData.name) {
          calendarUpdates.new_name = updateData.name;
        }

        if (Object.keys(calendarUpdates).length > 0) {
          await updateBillCalendarEvent(billId, calendarUpdates, household.id);
          console.log(`Updated calendar event for bill: ${bill.title}`);
        }
      } catch (calendarError) {
        console.error('Failed to update calendar event for bill:', calendarError);
        // Don't fail the bill update if calendar event update fails
      }

      // Log audit event
      await createAuditLog({
        action: 'bills.update',
        targetTable: 'bills',
        targetId: billId,
        userId: user.id,
        metadata: { 
          changes: Object.keys(updateData),
          previous_status: existingBill.status,
          new_status: bill.status
        }
      });

      return createSuccessResponse({ bill });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, 'Failed to update bill');
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { userData, household } = await getUserAndHouseholdData(user.id);
      
      if (!household) {
        return createErrorResponse('Household not found', 404);
      }

      // Check feature access
      if (!canAccessFeature(household.plan || 'free', 'bill_management')) {
        return createErrorResponse('Bill management requires Pro plan or higher', 403, {
          requiredPlan: 'pro',
          currentPlan: household.plan || 'free'
        });
      }

      const db = getDatabaseClient();
      const billId = params.id;

      // First, get the bill details for audit logging
      const { data: existingBill, error: fetchError } = await db
        .from('bills')
        .select('*')
        .eq('id', billId)
        .eq('household_id', household.id)
        .single();

      if (fetchError || !existingBill) {
        return createErrorResponse('Bill not found', 404);
      }

      // Delete bill
      const { error } = await db
        .from('bills')
        .delete()
        .eq('id', billId)
        .eq('household_id', household.id);

      if (error) {
        console.error('Error deleting bill:', error);
        return createErrorResponse('Failed to delete bill', 500);
      }

      // Delete associated calendar event
      try {
        await deleteBillCalendarEvent(billId, household.id);
        console.log(`Deleted calendar event for bill: ${existingBill.title}`);
      } catch (calendarError) {
        console.error('Failed to delete calendar event for bill:', calendarError);
        // Don't fail the bill deletion if calendar event deletion fails
      }

      // Log audit event
      await createAuditLog({
        action: 'bills.delete',
        targetTable: 'bills',
        targetId: billId,
        userId: user.id,
        metadata: { 
          title: existingBill.title,
          amount: existingBill.amount,
          status: existingBill.status
        }
      });

      return createSuccessResponse({ message: 'Bill deleted successfully' });

    } catch (error) {
      return handleApiError(error, 'Failed to delete bill');
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
