import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

const CreateRuleSchema = z.object({
  household_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  trigger_types: z.array(z.string()),
  actions: z.array(z.object({
    name: z.string(),
    params: z.record(z.any())
  })),
  conditions: z.record(z.any()).optional()
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = CreateRuleSchema.parse(body);
    const { household_id, name, description, trigger_types, actions, conditions } = validatedData;

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await sb()
      .from('household_members')
      .select('role')
      .eq('household_id', household_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      throw new ServerError('Access denied to household', 403);
    }

    // Check if user has permission to create rules (owner or admin)
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      throw new ServerError('Insufficient permissions to create automation rules', 403);
    }

    // Create the automation rule
    const { data: rule, error: ruleError } = await sb()
      .from('automation_rules')
      .insert({
        household_id,
        name,
        description: description || '',
        trigger_types,
        actions,
        conditions: conditions || {},
        enabled: true,
        created_by: userId
      })
      .select()
      .single();

    if (ruleError) {
      console.error('Error creating automation rule:', ruleError);
      throw new ServerError('Failed to create automation rule', 500);
    }

    console.log(`✅ Created automation rule "${name}" for household: ${household_id}`);

    return NextResponse.json({
      success: true,
      message: 'Automation rule created successfully',
      rule: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        trigger_types: rule.trigger_types,
        actions: rule.actions,
        enabled: rule.enabled
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
