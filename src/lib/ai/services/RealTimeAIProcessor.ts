// Real-time AI Processing Service
// This can be easily removed if the real-time processing doesn't work

import { WebSocketManager } from '@/lib/websocket/WebSocketServer';
import { ShoppingSuggestionsAIService, type ShoppingSuggestionsContext } from './ShoppingSuggestionsAIService';
import { MealPlanningAIService, type MealPlanningContext } from './MealPlanningAIService';
import type { ChoreAssignmentContext, EmailProcessingContext } from '@/components/ai/types/dashboard';
import { isAIEnabled } from '@/lib/ai/config/aiConfig';
import { logger } from '@/lib/logging/logger';
import type { RealTimeAIRequest } from '@/types/websocket';

export interface RealTimeAIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  processingTime: number;
  provider: string;
  fallbackUsed: boolean;
  requestId: string;
}

export class RealTimeAIProcessor {
  private webSocketManager: WebSocketManager;
  private shoppingAI: ShoppingSuggestionsAIService;
  private mealPlanningAI: MealPlanningAIService;
  private processingQueue: Map<string, RealTimeAIRequest> = new Map();

  constructor(webSocketManager: WebSocketManager) {
    this.webSocketManager = webSocketManager;
    this.shoppingAI = new ShoppingSuggestionsAIService();
    this.mealPlanningAI = new MealPlanningAIService();
  }

  public async processRequest(request: RealTimeAIRequest): Promise<RealTimeAIResponse> {
    const { type, context, requestId, userId, householdId, priority } = request;

    try {
      this.processingQueue.set(requestId, request);

      this.emitToUser(userId, {
        type: 'ai_processing_start',
        data: { requestId, type, context, priority },
        timestamp: new Date().toISOString(),
        requestId,
        userId,
        householdId,
      });

      let result: unknown;
      let processingTime = 0;
      let provider = 'mock';
      let fallbackUsed = false;

      const startTime = Date.now();

      switch (type) {
        case 'shopping_suggestions': {
          const ctx = context as Record<string, unknown>;
          const shoppingContext: ShoppingSuggestionsContext = {
            householdId,
          };

          if (Array.isArray(ctx.recentPurchases)) {
            shoppingContext.recentPurchases = ctx.recentPurchases as NonNullable<
              ShoppingSuggestionsContext['recentPurchases']
            >;
          }
          if (Array.isArray(ctx.dietaryRestrictions)) {
            shoppingContext.dietaryRestrictions = ctx.dietaryRestrictions as string[];
          }
          if (typeof ctx.budget === 'number') {
            shoppingContext.budget = ctx.budget as number;
          }
          if (typeof ctx.season === 'string') {
            shoppingContext.season = ctx.season as string;
          }
          if (Array.isArray(ctx.specialOccasions)) {
            shoppingContext.specialOccasions = ctx.specialOccasions as string[];
          }

          if (isAIEnabled('shoppingSuggestions')) {
            const { data: suggestions, provider: suggestionsProvider, fallbackUsed: suggestionsFallback } =
              await this.shoppingAI.generateSuggestions(shoppingContext);
            result = suggestions;
            provider = suggestionsProvider;
            fallbackUsed = suggestionsFallback ?? false;
          } else {
            result = this.generateMockShoppingSuggestions();
            provider = 'mock';
            fallbackUsed = true;
          }
          break;
        }

        case 'meal_planning': {
          const ctx = context as Record<string, unknown>;
          const mealContext: MealPlanningContext = {
            householdId,
            mealType: (typeof ctx.mealType === 'string' ? ctx.mealType : 'dinner') as MealPlanningContext['mealType'],
            dietaryRestrictions: Array.isArray(ctx.dietaryRestrictions)
              ? (ctx.dietaryRestrictions as string[])
              : [],
            maxPrepTime: typeof ctx.maxPrepTime === 'number' ? (ctx.maxPrepTime as number) : 30,
            servings: typeof ctx.servings === 'number' ? (ctx.servings as number) : 4,
            cuisine: typeof ctx.cuisine === 'string' ? (ctx.cuisine as string) : 'any',
            budget: typeof ctx.budget === 'number' ? (ctx.budget as number) : 0,
            skillLevel: 'intermediate',
          };

          const skillLevel = ctx.skillLevel;
          if (skillLevel === 'beginner' || skillLevel === 'intermediate' || skillLevel === 'advanced') {
            mealContext.skillLevel = skillLevel;
          }

          if (Array.isArray(ctx.availableIngredients)) {
            mealContext.availableIngredients = ctx.availableIngredients as string[];
          }
          if (Array.isArray(ctx.avoidIngredients)) {
            mealContext.avoidIngredients = ctx.avoidIngredients as string[];
          }
          if (Array.isArray(ctx.specialOccasions)) {
            mealContext.specialOccasions = ctx.specialOccasions as string[];
          }

          if (isAIEnabled('mealPlanning')) {
            const { data: mealPlan, provider: mealProvider, fallbackUsed: mealFallback } =
              await this.mealPlanningAI.generateMealSuggestions(mealContext);
            result = mealPlan;
            provider = mealProvider;
            fallbackUsed = mealFallback ?? false;
          } else {
            result = this.generateMockMealSuggestions(mealContext);
            provider = 'mock';
            fallbackUsed = true;
          }
          break;
        }

        case 'chore_assignment': {
          const ctx = context as Record<string, unknown>;
          const normalizedChores: string[] = Array.isArray(ctx.chores)
            ? (ctx.chores as unknown[]).map((value) => String(value))
            : [];
          const choreContext: ChoreAssignmentContext = {
            householdId,
            availableUsers: Array.isArray(ctx.availableUsers)
              ? (ctx.availableUsers as unknown[]).map((value) => String(value))
              : [],
            choreTypes: Array.isArray(ctx.choreTypes)
              ? (ctx.choreTypes as unknown[]).map((value) => String(value))
              : [],
            chores: normalizedChores,
          } as ChoreAssignmentContext;
          result = await this.processChoreAssignment(choreContext);
          provider = 'mock';
          fallbackUsed = true;
          break;
        }

        case 'email_processing': {
          const ctx = context as Record<string, unknown>;
          const emailContext: EmailProcessingContext = {
            householdId,
            emailCount: typeof ctx.emailCount === 'number' ? (ctx.emailCount as number) : 0,
            processingType: typeof ctx.processingType === 'string' ? (ctx.processingType as string) : 'standard',
          };
          result = await this.processEmailProcessing(emailContext);
          provider = 'mock';
          fallbackUsed = true;
          break;
        }

        default:
          throw new Error(`Unknown AI processing type: ${type}`);
      }

      processingTime = Date.now() - startTime;

      this.emitToUser(userId, {
        type: 'ai_processing_complete',
        data: {
          requestId,
          results: result,
          processingTime,
          provider,
          fallbackUsed,
        },
        timestamp: new Date().toISOString(),
        requestId,
        userId,
        householdId,
      });

      this.processingQueue.delete(requestId);

      return {
        success: true,
        data: result,
        processingTime,
        provider,
        fallbackUsed,
        requestId,
      };
    } catch (error) {
      logger.error('Real-time AI processing error', error as Error, {
        requestId,
        userId,
        householdId,
        type,
      });

      this.emitToUser(userId, {
        type: 'ai_processing_error',
        data: { requestId, error: (error as Error).message },
        timestamp: new Date().toISOString(),
        requestId,
        userId,
        householdId,
      });

      this.processingQueue.delete(requestId);

      return {
        success: false,
        error: (error as Error).message,
        processingTime: 0,
        provider: 'error',
        fallbackUsed: false,
        requestId,
      };
    }
  }

  private async processChoreAssignment(context: ChoreAssignmentContext) {
    const { householdId, chores = [], availableUsers = [], choreTypes = [] } = context as ChoreAssignmentContext & {
      chores?: string[];
    };
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const normalizedChores: string[] = Array.isArray(chores) ? chores : [];

    return {
      assignments: normalizedChores.map((choreId) => ({
        choreId,
        assignedTo: householdId,
        dueDate: new Date().toISOString(),
        priority: 'medium' as const,
        estimatedTime: 30,
        reasoning: 'Based on workload and preferences',
      })),
      totalChores: normalizedChores.length,
      estimatedTotalTime: normalizedChores.length * 30,
      availableUsers,
      choreTypes,
    };
  }

  private async processEmailProcessing(context: EmailProcessingContext) {
    const { householdId, inbox } = context;
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      processedEmails: 1,
      extractedData: {
        bills: 0,
        receipts: 1,
        events: 0,
        deliveries: 0,
      },
      confidence: 85,
      householdId,
      inbox,
    };
  }

  private generateMockShoppingSuggestions(): Record<string, unknown> {
    return {
      suggestions: [
        {
          type: 'frequently_bought',
          title: 'Your Essentials',
          description: 'Items you often buy',
          items: [
            { name: 'Milk', category: 'Dairy', confidence: 90 },
            { name: 'Bread', category: 'Bakery', confidence: 85 },
            { name: 'Eggs', category: 'Dairy', confidence: 80 },
          ],
          confidence: 88,
          priority: 'high',
        },
      ],
    };
  }

  private generateMockMealSuggestions(context: MealPlanningContext): Record<string, unknown> {
    return {
      suggestions: [
        {
          name: 'Quick Pasta Primavera',
          description: 'A fresh and colorful pasta dish with seasonal vegetables',
          prepTime: 10,
          cookTime: 15,
          totalTime: 25,
          servings: context.servings || 4,
          difficulty: 'easy',
          cuisine: 'Italian',
          confidence: 80,
        },
      ],
    };
  }

  private emitToUser(userId: string, message: any) {
    try {
      this.webSocketManager.emitToUser(userId, message);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      logger.warn('Failed to emit real-time AI message', {
        userId,
        messageType: message.type,
        error: err.message,
      });
    }
  }

  public getProcessingQueue(): RealTimeAIRequest[] {
    return Array.from(this.processingQueue.values());
  }

  public getQueueSize(): number {
    return this.processingQueue.size;
  }

  public clearQueue(): void {
    this.processingQueue.clear();
  }
}
