// Import only implemented services
import { MealService } from './meal/MealService';

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
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    
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

// Export all services
export { MealService };
