import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';
import { onboardingHouseholdSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    // Parse and validate request body using Zod schema
    let validatedData;
    try {
      const body = await request.json();
      validatedData = onboardingHouseholdSchema.parse(body);
    } catch (validationError: any) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: validationError.errors 
      }, { status: 400 });
    }

    const { name, game_mode } = validatedData;

    // Create household
    const { data: household, error: householdError } = await sb()
      .from('households')
      .insert({
        name: name,
        game_mode: game_mode,
        created_by: userId,
      })
      .select()
      .single();

    if (householdError) {
      console.error('Error creating household:', householdError);
      throw new ServerError('Failed to create household', 500);
    }

    // Add user to household as admin
    const { error: memberError } = await sb()
      .from('household_members')
      .insert({
        household_id: household.id,
        user_id: userId,
        role: 'admin',
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error('Error adding user to household:', memberError);
      throw new ServerError('Failed to add user to household', 500);
    }

    // Update user's onboarding status and household_id
    const { error: userError } = await sb()
      .from('users')
      .update({
        household_id: household.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (userError) {
      console.error('Error updating user:', userError);
      throw new ServerError('Failed to update user', 500);
    }

    console.log(`✅ Created household "${name}" for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Household created successfully',
      household: {
        id: household.id,
        name: household.name,
        gameMode: household.game_mode,
      }
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
