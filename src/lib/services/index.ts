// Service container for organizing business logic
export class ServiceContainer {
  private static instance: ServiceContainer;
  
  // Core services
  public readonly mealService = new MealService();
  public readonly aiService = new AIService();
  public readonly notificationService = new NotificationService();
  public readonly userService = new UserService();
  public readonly householdService = new HouseholdService();
  
  // AI-specific services
  public readonly emailProcessingService = new EmailProcessingService();
  public readonly learningService = new LearningService();
  public readonly suggestionService = new SuggestionService();
  
  private constructor() {}
  
  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }
  
  // Cleanup method for testing
  static reset(): void {
    ServiceContainer.instance = new ServiceContainer();
  }
}

// Base service class with common functionality
export abstract class BaseService {
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logData = { timestamp, level, message, ...(data && { data }) };
    
    switch (level) {
      case 'info':
        console.log(`[${timestamp}] INFO: ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`[${timestamp}] WARN: ${message}`, data || '');
        break;
      case 'error':
        console.error(`[${timestamp}] ERROR: ${message}`, data || '');
        break;
    }
  }
  
  protected async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.log('error', `Failed in ${context}`, error);
      throw error;
    }
  }
}

// Import all services
export { MealService } from './meal/MealService';
export { AIService } from './ai/AIService';
export { NotificationService } from './notification/NotificationService';
export { UserService } from './user/UserService';
export { HouseholdService } from './household/HouseholdService';
export { EmailProcessingService } from './ai/EmailProcessingService';
export { LearningService } from './ai/LearningService';
export { SuggestionService } from './ai/SuggestionService';
