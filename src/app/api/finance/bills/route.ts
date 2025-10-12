import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { canAccessFeature } from '@/lib/server/canAccessFeature';
import { createBillCalendarEvent } from '@/lib/finance/calendarIntegration';
import { z } from 'zod';
import { logger } from '@/lib/logging/logger';

// Validation schemas
const createBillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('AUD'),
  due_date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format'),
  issued_date: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  source: z.enum(['manual', 'email', 'automation', 'import']).default('manual'),
  source_data: z.record(z.any()).optional(),
  assigned_to: z.string().optional(),
  external_id: z.string().optional(),
});

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { household } = await getUserAndHouseholdData(user.id);
      
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
      
      // Get query parameters
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const category = url.searchParams.get('category');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Build query
      let query = db
        .from('bills')
        .select('*')
        .eq('household_id', household.id)
        .order('due_date', { ascending: true })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }
      if (category) {
        query = query.eq('category', category);
      }

      const { data: bills, error } = await query;

      if (error) {
        logger.error('Error fetching bills', error, { householdId: household.id });
        return createErrorResponse('Failed to fetch bills', 500);
      }

      // Log audit event
      await createAuditLog({
        action: 'bills.list',
        targetTable: 'bills',
        targetId: household.id,
        userId: user.id,
        metadata: { count: bills?.length || 0, filters: { status, category } }
      });

      return createSuccessResponse({ bills: bills || [] });

    } catch (error) {
      return handleApiError(error, 'Failed to fetch bills');
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
      const { household } = await getUserAndHouseholdData(user.id);
      
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
      const validatedData = createBillSchema.parse(body);

      const db = getDatabaseClient();

      // Create bill
      const { data: bill, error } = await db
        .from('bills')
        .insert({
          household_id: household.id,
          name: validatedData.name,
          title: validatedData.title,
          description: validatedData.description,
          amount: validatedData.amount,
          currency: validatedData.currency,
          due_date: validatedData.due_date,
          status: 'pending',
          category: validatedData.category,
          source: validatedData.source,
          source_data: validatedData.source_data,
          assigned_to: validatedData.assigned_to,
          created_by: user.id,
          issued_date: validatedData.issued_date || new Date().toISOString().split('T')[0],
          priority: validatedData.priority,
          external_id: validatedData.external_id,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating bill', error, { householdId: household.id, userId: user.id });
        return createErrorResponse('Failed to create bill', 500);
      }

      // Create calendar event for bill due date
      try {
        await createBillCalendarEvent(bill, household.id, user.id);
        logger.info('Created calendar event for bill', { billId: bill.id, title: bill.title });
      } catch (calendarError) {
        logger.error('Failed to create calendar event for bill', calendarError instanceof Error ? calendarError : new Error(String(calendarError)), {
          billId: bill.id,
          householdId: household.id,
        });
        // Don't fail the bill creation if calendar event creation fails
      }

      // Log audit event
      await createAuditLog({
        action: 'bills.create',
        targetTable: 'bills',
        targetId: bill.id,
        userId: user.id,
        metadata: { title: bill.title, amount: bill.amount, due_date: bill.due_date }
      });

      return createSuccessResponse({ bill }, 201);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid input data', 400, { errors: error.errors });
      }
      return handleApiError(error, 'Failed to create bill');
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
