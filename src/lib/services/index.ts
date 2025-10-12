// Import only implemented services
import { MealService } from './meal/MealService';
import { logger } from '@/lib/logging/logger';

// Service container for organizing business logic
export class ServiceContainer {
  private static instance: ServiceContainer;
  
  // Core services - only include implemented ones
  public readonly mealService = new MealService();
  
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
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    switch (level) {
      case 'info':
        logger.info(message, data);
        break;
      case 'warn':
        logger.warn(message, undefined, data);
        break;
      case 'error': {
        const error = data?.error instanceof Error ? data.error : undefined;
        logger.error(message, error, data);
        break;
      }
      default:
        logger.info(message, data);
    }
  }
  
  protected async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.log('error', `Failed in ${context}`, { error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }
}

// Export all services
export { MealService };
