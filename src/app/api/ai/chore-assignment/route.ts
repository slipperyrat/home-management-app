import { NextRequest, NextResponse } from 'next/server';
import { assignChore, getAssignmentRecommendations } from '@/lib/ai/choreAssignment';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chore, strategy, householdId } = body;

    if (!chore || !householdId) {
      return NextResponse.json({ 
        error: 'Missing required fields: chore and householdId' 
      }, { status: 400 });
    }

    // Execute the AI assignment
    const assignment = await assignChore(chore, strategy || 'ai_hybrid', householdId);

    return NextResponse.json({ 
      success: true, 
      assignment,
      message: `Chore assigned to user using ${assignment.strategy} strategy`
    });

  } catch (error) {
    console.error('Error in AI chore assignment:', error);
    return NextResponse.json({ 
      error: 'Failed to assign chore',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const choreId = searchParams.get('choreId');
    const householdId = searchParams.get('householdId');

    if (!choreId || !householdId) {
      return NextResponse.json({ 
        error: 'Missing required parameters: choreId and householdId' 
      }, { status: 400 });
    }

    // Get the chore details first
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: chore, error: choreError } = await supabase
      .from('chores')
      .select('*')
      .eq('id', choreId)
      .single();

    if (choreError || !chore) {
      return NextResponse.json({ 
        error: 'Chore not found' 
      }, { status: 404 });
    }

    // Get assignment recommendations for all strategies
    const recommendations = await getAssignmentRecommendations(chore, householdId);

    return NextResponse.json({ 
      success: true, 
      chore,
      recommendations,
      message: `Generated ${recommendations.length} assignment recommendations`
    });

  } catch (error) {
    console.error('Error getting assignment recommendations:', error);
    return NextResponse.json({ 
      error: 'Failed to get recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
