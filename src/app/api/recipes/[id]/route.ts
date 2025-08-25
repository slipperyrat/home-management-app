import { NextRequest, NextResponse } from 'next/server';
import { sb, getUserAndHousehold } from '@/lib/server/supabaseAdmin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { householdId } = await getUserAndHousehold();
    const { id: recipeId } = await params;

    if (!householdId) {
      return NextResponse.json({ error: 'Unauthorized or household not found' }, { status: 401 });
    }

    if (!recipeId) {
      return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 });
    }

    // First, verify the recipe belongs to the user's household
    const { data: existingRecipe, error: fetchError } = await sb()
      .from('recipes')
      .select('id, household_id')
      .eq('id', recipeId)
      .eq('household_id', householdId)
      .single();

    if (fetchError || !existingRecipe) {
      return NextResponse.json({ error: 'Recipe not found or access denied' }, { status: 404 });
    }

    // Delete the recipe
    const { error: deleteError } = await sb()
      .from('recipes')
      .delete()
      .eq('id', recipeId)
      .eq('household_id', householdId);

    if (deleteError) {
      console.error('Error deleting recipe:', deleteError);
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error in recipe deletion API:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
