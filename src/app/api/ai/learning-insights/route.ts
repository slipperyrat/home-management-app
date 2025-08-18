import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { AILearningService } from '@/lib/ai/services/aiLearningService';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get household ID from query params
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('household_id');

    if (!householdId) {
      return NextResponse.json({ 
        error: 'household_id is required' 
      }, { status: 400 });
    }

    // Get learning insights for the household
    const learningService = new AILearningService();
    const insights = await learningService.getHouseholdLearningInsights(householdId);

    return NextResponse.json({ 
      success: true, 
      insights 
    });

  } catch (error) {
    console.error('Error fetching learning insights:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
