import { run } from './sendReminders';

async function testReminders() {
  try {
    console.log('🧪 Testing reminder sending script...');
    
    const result = await run();
    
    console.log('✅ Test completed successfully!');
    console.log('📊 Results:', result);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testReminders(); 