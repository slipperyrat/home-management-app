import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing AI Learning Service import...');
    
    // Test 1: Try to import the service
    let AILearningService;
    try {
      AILearningService = require('@/lib/ai/services/aiLearningService').AILearningService;
      console.log('✅ AILearningService import successful');
    } catch (importError) {
      console.error('❌ AILearningService import failed:', importError);
      return NextResponse.json({ 
        error: 'Import failed', 
        details: importError.message 
      }, { status: 500 });
    }
    
    // Test 2: Try to instantiate the service
    let learningService;
    try {
      learningService = new AILearningService();
      console.log('✅ AILearningService instantiation successful');
    } catch (instantiationError) {
      console.error('❌ AILearningService instantiation failed:', instantiationError);
      return NextResponse.json({ 
        error: 'Instantiation failed', 
        details: instantiationError.message 
      }, { status: 500 });
    }
    
    // Test 3: Try to call a simple method
    try {
      const result = await learningService.getHouseholdLearningInsights('test-household-id');
      console.log('✅ AILearningService method call successful');
    } catch (methodError) {
      console.error('❌ AILearningService method call failed:', methodError);
      return NextResponse.json({ 
        error: 'Method call failed', 
        details: methodError.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'All AI Learning Service tests passed',
      tests: ['import', 'instantiation', 'method_call']
    });
    
  } catch (error) {
    console.error('❌ Test failed with unexpected error:', error);
    return NextResponse.json({ 
      error: 'Unexpected error', 
      details: error.message 
    }, { status: 500 });
  }
}
