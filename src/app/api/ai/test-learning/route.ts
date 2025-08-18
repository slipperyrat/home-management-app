import { NextRequest, NextResponse } from 'next/server';
import { AILearningService } from '@/lib/ai/services/aiLearningService';

export async function GET(_request: NextRequest) {
  try {
    // Test 1: Try to import the service
    try {
      // Test 2: Try to instantiate the service
      const learningService = new AILearningService();
      
      // Test 3: Try to call a simple method
      await learningService.getHouseholdLearningInsights('test-household-id');
      
      return NextResponse.json({ 
        success: true, 
        message: 'All AI Learning Service tests passed',
        tests: ['import', 'instantiation', 'method_call']
      });
      
    } catch (serviceError) {
      return NextResponse.json({ 
        error: 'Service test failed', 
        details: serviceError instanceof Error ? serviceError.message : String(serviceError)
      }, { status: 500 });
    }
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Unexpected error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
