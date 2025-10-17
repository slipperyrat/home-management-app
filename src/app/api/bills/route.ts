import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createBillSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/supabase.generated';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (_req, user: RequestUser | null) => {
    try {
      if (!user) {
        logger.warn('Bill list retrieval attempted without authenticated user', {
          url: request.url,
          route: '/api/bills',
          securityEvent: true,
          severity: 'medium',
        });
        return createErrorResponse('Unauthorized', 401);
      }

      logger.info('Fetching bills', { userId: user.id });

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
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
        logger.error('Error fetching bills', billsError, { householdId: household.id });
        return createErrorResponse('Failed to fetch bills', 500, billsError.message);
      }

      return createSuccessResponse({ bills: bills || [] }, 'Bills fetched successfully');

    } catch (error) {
      return handleApiError(error, {
        route: '/api/bills',
        method: 'GET',
        ...(user ? { userId: user.id } : {}),
      });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user) {
        logger.warn('Bill creation attempted without authenticated user', {
          url: request.url,
          route: '/api/bills',
          securityEvent: true,
          severity: 'medium',
        });
        return createErrorResponse('Unauthorized', 401);
      }

      logger.info('Creating bill', { userId: user.id });

      // Validate input using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        const tempSchema = createBillSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
      } catch (validationError: unknown) {
        if (validationError instanceof Error && 'errors' in validationError) {
          return createErrorResponse('Invalid input', 400, (validationError as { errors: unknown }).errors);
        }
        return createErrorResponse('Invalid input', 400);
      }

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Create the bill with validated data
      const supabase = getDatabaseClient();
      const insertPayload: Database['public']['Tables']['bills']['Insert'] = {
        household_id: household.id,
        title: validatedData.title,
        name: validatedData.title,
        description: validatedData.description ?? null,
        amount: validatedData.amount,
        due_date: validatedData.due_date,
        category: validatedData.category ?? 'General',
        priority: validatedData.priority ?? 'medium',
        source: 'manual',
        created_by: user.id,
      };

      const { data: bill, error: createError } = await supabase
        .from('bills')
        .insert(insertPayload)
        .select()
        .single();

      if (createError) {
        logger.error('Error creating bill', createError, { householdId: household.id });
        return createErrorResponse('Failed to create bill', 500, createError.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'bill.created',
        targetTable: 'bills',
        targetId: bill.id,
        userId: user.id,
        metadata: {
          bill_name: validatedData.title,
          amount: validatedData.amount,
          household_id: household.id,
        },
      });

      return createSuccessResponse({ bill }, 'Bill created successfully');

    } catch (error) {
      return handleApiError(error, {
        route: '/api/bills',
        method: 'POST',
        ...(user ? { userId: user.id } : {}),
      });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
