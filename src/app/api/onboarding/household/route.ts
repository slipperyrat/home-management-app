import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { withSanitizedBody } from '@/lib/api-helpers';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

const HouseholdSchema = z.object({
  householdName: z.string().min(1).max(100),
  memberCount: z.number().min(1).max(20),
  gameMode: z.enum(['casual', 'competitive']).default('casual'),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = HouseholdSchema.parse(body);
    const { householdName, memberCount, gameMode } = validatedData;

    // Create household
    const { data: household, error: householdError } = await sb()
      .from('households')
      .insert({
        name: householdName,
        game_mode: gameMode,
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

    // Update user's onboarding status
    const { error: userError } = await sb()
      .from('users')
      .update({
        onboarding_completed: true,
        household_id: household.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (userError) {
      console.error('Error updating user:', userError);
      throw new ServerError('Failed to update user', 500);
    }

    console.log(`✅ Created household "${householdName}" for user: ${userId}`);

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
