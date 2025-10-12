// Real-time AI Processing Service
// This can be easily removed if the real-time processing doesn't work

import { WebSocketManager, WebSocketMessage } from '@/lib/websocket/WebSocketServer';
import { ShoppingSuggestionsAIService, type ShoppingSuggestionsContext } from './ShoppingSuggestionsAIService';
import { MealPlanningAIService, type MealPlanningContext } from './MealPlanningAIService';
import { isAIEnabled } from '@/lib/ai/config/aiConfig';
import { logger } from '@/lib/logging/logger';

type ChoreAssignmentContext = { householdId: string; chores: string[] };
type EmailProcessingContext = { householdId: string; inbox: string };

export type RealTimeContextMap =
  | { type: 'shopping_suggestions'; context: ShoppingSuggestionsContext }
  | { type: 'meal_planning'; context: MealPlanningContext }
  | { type: 'chore_assignment'; context: ChoreAssignmentContext }
  | { type: 'email_processing'; context: EmailProcessingContext };

export interface RealTimeAIRequest extends RealTimeContextMap {
  requestId: string;
  userId: string;
  householdId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

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
  private isProcessing = false;

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
        case 'shopping_suggestions':
          if (isAIEnabled('shoppingSuggestions')) {
            const { data: suggestions, provider: suggestionsProvider, fallbackUsed: suggestionsFallback } =
              await this.shoppingAI.generateSuggestions(context as ShoppingSuggestionsContext);
            result = suggestions;
            provider = suggestionsProvider;
            fallbackUsed = suggestionsFallback ?? false;
          } else {
            result = this.generateMockShoppingSuggestions();
            provider = 'mock';
            fallbackUsed = true;
          }
          break;

        case 'meal_planning':
          if (isAIEnabled('mealPlanning')) {
            const { data: mealPlan, provider: mealProvider, fallbackUsed: mealFallback } =
              await this.mealPlanningAI.generateMealSuggestions(context as MealPlanningContext);
            result = mealPlan;
            provider = mealProvider;
            fallbackUsed = mealFallback ?? false;
          } else {
            result = this.generateMockMealSuggestions(context as MealPlanningContext);
            provider = 'mock';
            fallbackUsed = true;
          }
          break;

        case 'chore_assignment':
          result = await this.processChoreAssignment(context as ChoreAssignmentContext);
          provider = 'mock';
          fallbackUsed = true;
          break;

        case 'email_processing':
          result = await this.processEmailProcessing(context as EmailProcessingContext);
          provider = 'mock';
          fallbackUsed = true;
          break;

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

  private async processChoreAssignment({ householdId, chores }: ChoreAssignmentContext) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      assignments: chores.map((choreId) => ({
        choreId,
        assignedTo: householdId,
        dueDate: new Date().toISOString(),
        priority: 'medium' as const,
        estimatedTime: 30,
        reasoning: 'Based on workload and preferences',
      })),
      totalChores: chores.length,
      estimatedTotalTime: chores.length * 30,
    };
  }

  private async processEmailProcessing({ householdId, inbox }: EmailProcessingContext) {
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

  private emitToUser(userId: string, message: WebSocketMessage) {
    try {
      this.webSocketManager.emitToUser(userId, message);
    } catch (error) {
      logger.warn('Failed to emit real-time AI message', error as Error, {
        userId,
        messageType: message.type,
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
