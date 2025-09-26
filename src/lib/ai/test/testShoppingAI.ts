// Test script for Shopping AI Service
// This can be easily removed if the AI implementation doesn't work

import { ShoppingSuggestionsAIService } from '../services/ShoppingSuggestionsAIService';
import { AIConfigManager } from '../config/aiConfig';

export async function testShoppingAI() {
  console.log('🧪 Testing Shopping AI Service...');
  
  try {
    // Test with mock data
    const aiService = new ShoppingSuggestionsAIService();
    
    const context = {
      householdId: 'test-household-id',
      dietaryRestrictions: ['vegetarian'],
      budget: 100,
      specialOccasions: ['birthday']
    };

    console.log('📝 Test context:', context);
    
    const result = await aiService.generateSuggestions(context);
    
    console.log('✅ AI Service Result:');
    console.log('- Success:', result.success);
    console.log('- Provider:', result.provider);
    console.log('- Processing Time:', result.processingTime + 'ms');
    console.log('- Fallback Used:', result.fallbackUsed);
    console.log('- Suggestions Count:', result.data?.length || 0);
    
    if (result.data && result.data.length > 0) {
      console.log('📋 Sample Suggestion:');
      console.log(JSON.stringify(result.data[0], null, 2));
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Test configuration management
export function testAIConfig() {
  console.log('🧪 Testing AI Configuration...');
  
  const configManager = AIConfigManager.getInstance();
  
  console.log('📊 Current Configuration:');
  console.log('- Shopping AI Enabled:', configManager.isEnabled('shoppingSuggestions'));
  console.log('- Shopping AI Provider:', configManager.getConfig('shoppingSuggestions').provider);
  console.log('- Meal Planning Enabled:', configManager.isEnabled('mealPlanning'));
  
  // Test disabling feature
  console.log('🔄 Testing feature disable...');
  configManager.disableFeature('shoppingSuggestions');
  console.log('- Shopping AI Enabled (after disable):', configManager.isEnabled('shoppingSuggestions'));
  
  // Re-enable
  configManager.enableFeature('shoppingSuggestions');
  console.log('- Shopping AI Enabled (after re-enable):', configManager.isEnabled('shoppingSuggestions'));
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAIConfig();
  testShoppingAI().then(() => {
    console.log('🎉 All tests completed!');
  });
}
