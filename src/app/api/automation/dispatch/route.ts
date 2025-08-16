import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

const DispatchSchema = z.object({
  event: z.object({
    id: z.string(),
    household_id: z.string(),
    type: z.string(),
    source: z.string(),
    payload: z.record(z.any()),
    occurred_at: z.string()
  })
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = DispatchSchema.parse(body);
    const { event } = validatedData;

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await sb()
      .from('household_members')
      .select('role')
      .eq('household_id', event.household_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      throw new ServerError('Access denied to household', 403);
    }

    // Call the Supabase automation dispatcher function
    const { data, error } = await sb().functions.invoke('automation-dispatcher', {
      body: {
        event,
        rule: null // Not needed for this flow
      }
    });

    if (error) {
      console.error('Automation dispatcher error:', error);
      throw new ServerError('Failed to trigger automation', 500);
    }

    console.log('✅ Automation dispatcher triggered successfully:', data);

    return NextResponse.json({
      success: true,
      message: 'Automation triggered successfully',
      result: data
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
