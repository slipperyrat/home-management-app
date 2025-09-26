// AI Configuration System
// Centralized configuration for all AI features with easy enable/disable

export interface AIConfig {
  enabled: boolean;
  provider: 'openai' | 'mock' | 'disabled';
  model: string;
  apiKey?: string;
  fallbackToMock: boolean;
  timeout: number;
  retryAttempts: number;
}

export interface FeatureConfig {
  shoppingSuggestions: AIConfig;
  mealPlanning: AIConfig;
  emailProcessing: AIConfig;
  choreAssignment: AIConfig;
  learningSystem: AIConfig;
}

// Default configuration - easily modifiable
export const defaultAIConfig: FeatureConfig = {
  shoppingSuggestions: {
    enabled: true,
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: process.env.OPENAI_API_KEY,
    fallbackToMock: true,
    timeout: 10000,
    retryAttempts: 2
  },
  mealPlanning: {
    enabled: true,
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: process.env.OPENAI_API_KEY,
    fallbackToMock: true,
    timeout: 10000,
    retryAttempts: 2
  },
  emailProcessing: {
    enabled: true,
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: process.env.OPENAI_API_KEY,
    fallbackToMock: false,
    timeout: 15000,
    retryAttempts: 3
  },
  choreAssignment: {
    enabled: true,
    provider: 'mock', // Uses existing algorithm-based approach
    model: 'algorithm',
    fallbackToMock: false,
    timeout: 5000,
    retryAttempts: 1
  },
  learningSystem: {
    enabled: true,
    provider: 'mock', // Uses existing pattern-based approach
    model: 'pattern',
    fallbackToMock: false,
    timeout: 5000,
    retryAttempts: 1
  }
};

// Runtime configuration loader
export class AIConfigManager {
  private static instance: AIConfigManager;
  private config: FeatureConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    return AIConfigManager.instance;
  }

  private loadConfig(): FeatureConfig {
    // Load from environment variables or database
    const config = { ...defaultAIConfig };

    // Override with environment variables
    if (process.env.AI_SHOPPING_ENABLED === 'false') {
      config.shoppingSuggestions.enabled = false;
    }
    if (process.env.AI_MEAL_PLANNING_ENABLED === 'false') {
      config.mealPlanning.enabled = false;
    }
    if (process.env.AI_EMAIL_PROCESSING_ENABLED === 'false') {
      config.emailProcessing.enabled = false;
    }

    // Override provider if specified
    if (process.env.AI_PROVIDER === 'mock') {
      config.shoppingSuggestions.provider = 'mock';
      config.mealPlanning.provider = 'mock';
    }

    return config;
  }

  public getConfig(feature: keyof FeatureConfig): AIConfig {
    return this.config[feature];
  }

  public isEnabled(feature: keyof FeatureConfig): boolean {
    return this.config[feature].enabled;
  }

  public updateConfig(feature: keyof FeatureConfig, updates: Partial<AIConfig>): void {
    this.config[feature] = { ...this.config[feature], ...updates };
  }

  public disableFeature(feature: keyof FeatureConfig): void {
    this.config[feature].enabled = false;
  }

  public enableFeature(feature: keyof FeatureConfig): void {
    this.config[feature].enabled = true;
  }
}

// Convenience function
export const getAIConfig = (feature: keyof FeatureConfig): AIConfig => {
  return AIConfigManager.getInstance().getConfig(feature);
};

export const isAIEnabled = (feature: keyof FeatureConfig): boolean => {
  return AIConfigManager.getInstance().isEnabled(feature);
};
