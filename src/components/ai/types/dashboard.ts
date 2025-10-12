export type AIRequestType =
  | 'shopping_suggestions'
  | 'meal_planning'
  | 'chore_assignment'
  | 'email_processing';

export type AIRequestPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface RealTimeRequestPayload<TContext = Record<string, unknown>> {
  type: AIRequestType;
  context: TContext;
  requestId?: string;
  priority: AIRequestPriority;
}

export interface ProgressUpdate {
  step: string;
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export interface CompletedResult {
  success: boolean;
  data?: unknown;
  error?: string;
  processingTime: number;
  provider: string;
  fallbackUsed?: boolean;
}

export interface RealtimeStatus {
  connectedUsers: number;
  householdRooms: number;
  processingQueue: number;
}

export interface ShoppingSuggestionsContext {
  dietaryRestrictions: string[];
  budget: number;
  specialOccasions: string[];
}

export interface MealPlanningContext {
  mealType: string;
  dietaryRestrictions: string[];
  maxPrepTime: number;
  servings: number;
  cuisine: string;
}

export interface ChoreAssignmentContext {
  householdId: string;
  availableUsers: string[];
  choreTypes: string[];
}

export interface EmailProcessingContext {
  emailCount: number;
  processingType: string;
}

export interface RealTimeAIMetrics {
  requestsInQueue: number;
  completedRequests: number;
}

export interface RealTimeAIDashboardProps {
  className?: string;
}
