// Test script for Shopping AI Service
// This can be easily removed if the AI implementation doesn't work

import { ShoppingSuggestionsAIService } from '../services/ShoppingSuggestionsAIService';
import { AIConfigManager } from '../config/aiConfig';
import { logger } from '@/lib/logging/logger';

export async function testShoppingAI() {
  logger.info('Testing Shopping AI Service');

  try {
    const aiService = new ShoppingSuggestionsAIService();

    const context = {
      householdId: 'test-household-id',
      dietaryRestrictions: ['vegetarian'],
      budget: 100,
      specialOccasions: ['birthday']
    };

    logger.debug?.('Shopping AI test context', context);

    const result = await aiService.generateSuggestions(context);

    logger.info('Shopping AI service result', {
      success: result.success,
      provider: result.provider,
      processingTimeMs: result.processingTime,
      fallbackUsed: result.fallbackUsed,
      suggestionCount: result.data?.length || 0,
    });

    if (result.data && result.data.length > 0) {
      logger.info('Sample shopping suggestion', { suggestion: result.data[0] });
    }

    return result;
  } catch (error) {
    logger.error('Shopping AI test failed', error as Error);
    return null;
  }
}

export function testAIConfig() {
  logger.info('Testing AI configuration manager');

  const configManager = AIConfigManager.getInstance();

  logger.info('Current AI configuration', {
    shoppingEnabled: configManager.isEnabled('shoppingSuggestions'),
    shoppingProvider: configManager.getConfig('shoppingSuggestions').provider,
    mealPlanningEnabled: configManager.isEnabled('mealPlanning'),
  });

  logger.info('Disabling shopping suggestions feature');
  configManager.disableFeature('shoppingSuggestions');
  logger.info('Shopping AI enabled after disable', { enabled: configManager.isEnabled('shoppingSuggestions') });

  configManager.enableFeature('shoppingSuggestions');
  logger.info('Shopping AI enabled after re-enable', { enabled: configManager.isEnabled('shoppingSuggestions') });
}

if (require.main === module) {
  logger.info('Starting Shopping AI tests');
  testAIConfig();
  testShoppingAI()
    .then(() => {
      logger.info('Shopping AI tests completed');
    })
    .catch((error) => {
      logger.error('Shopping AI tests encountered an error', error as Error);
    });
}
