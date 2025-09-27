import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { sb } from '@/lib/server/supabaseAdmin';
import { mergeDuplicateItems } from '@/lib/server/mergeDuplicateItems';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

const mergeRequestSchema = z.object({
  listId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const body = await req.json();
      const { listId } = mergeRequestSchema.parse(body);

      // Verify the list belongs to the user's household
      const supabase = sb();
      const { data: list, error: listError } = await supabase
        .from('shopping_lists')
        .select(`
          id,
          household_id,
          households!inner(
            id,
            household_members!inner(user_id)
          )
        `)
        .eq('id', listId)
        .eq('households.household_members.user_id', user.id)
        .single();

      if (listError || !list) {
        logger.warn('Merge duplicates blocked: list not found or access denied', {
          userId: user.id,
          listId,
          error: listError?.message,
        });
        return NextResponse.json({
          success: false,
          error: 'List not found or access denied'
        }, { status: 404 });
      }

      logger.info('Merging duplicate shopping items', {
        userId: user.id,
        householdId: list.household_id,
        listId,
      });

      // Merge duplicate items
      const result = await mergeDuplicateItems(listId);
      
      if (result.ok) {
        logger.info('Duplicate merge completed', {
          userId: user.id,
          listId,
          mergedItems: result.mergedItems,
          totalItems: result.totalItems,
        });
        return NextResponse.json({
          success: true,
          mergedItems: result.mergedItems,
          totalItems: result.totalItems,
          message: `Successfully merged ${result.mergedItems} duplicate items`
        });
      } else {
        logger.error('Duplicate merge failed', new Error(result.error || 'merge failed'), {
          userId: user.id,
          listId,
        });
        return NextResponse.json({ 
          success: false, 
          error: result.error || 'Failed to merge duplicates' 
        }, { status: 500 });
      }

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logger.warn('Merge duplicates validation failed', {
          userId: user.id,
          errors: error.flatten().fieldErrors,
        });
        return NextResponse.json({
          success: false,
          error: 'Invalid input',
          details: error.flatten().fieldErrors,
        }, { status: 400 });
      }

      logger.error('Unexpected error in merge-duplicates API', error as Error, {
        userId: user.id,
        route: '/api/shopping-lists/merge-duplicates',
      });
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'shopping'
  });
}
