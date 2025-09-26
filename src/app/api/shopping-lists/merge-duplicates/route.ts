import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { sb } from '@/lib/server/supabaseAdmin';
import { mergeDuplicateItems } from '@/lib/server/mergeDuplicateItems';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🔍 Merge duplicates API called with userId:', user?.id);

      const { listId } = await req.json();
      
      if (!listId) {
        return NextResponse.json({ 
          success: false, 
          error: 'listId is required' 
        }, { status: 400 });
      }

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
        console.error('❌ List not found or access denied:', listError);
        return NextResponse.json({ 
          success: false, 
          error: 'List not found or access denied' 
        }, { status: 404 });
      }

      console.log(`🔍 Merging duplicates for list: ${listId}`);

      // Merge duplicate items
      const result = await mergeDuplicateItems(listId);
      
      if (result.ok) {
        console.log(`✅ Merge successful: ${result.mergedItems} items merged, ${result.totalItems} total items`);
        return NextResponse.json({
          success: true,
          mergedItems: result.mergedItems,
          totalItems: result.totalItems,
          message: `Successfully merged ${result.mergedItems} duplicate items`
        });
      } else {
        console.error('❌ Merge failed:', result.error);
        return NextResponse.json({ 
          success: false, 
          error: result.error || 'Failed to merge duplicates' 
        }, { status: 500 });
      }

    } catch (error: any) {
      console.error('❌ Error in merge-duplicates API:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}
