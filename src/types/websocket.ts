import type { Json } from '@/types/supabase.generated';

export interface WebSocketMessage<TData = unknown> {
  type: string;
  data: TData;
  timestamp: string;
  requestId: string;
  userId: string;
  householdId: string;
}

export type RealTimeAIType =
  | 'shopping_suggestions'
  | 'meal_planning'
  | 'automation_rules'
  | 'chore_assignment'
  | 'email_processing';

export type RealTimeAIPriority = 'low' | 'medium' | 'high' | 'urgent';

export type RealTimeAIContext = Record<string, Json | Json[] | string | number | boolean | null | undefined>;

export interface RealTimeAIRequest {
  type: RealTimeAIType;
  context: RealTimeAIContext;
  requestId: string;
  userId: string;
  householdId: string;
  priority?: RealTimeAIPriority;
}

export interface RealTimeRequestBody {
  type: RealTimeAIType;
  context: RealTimeAIContext;
  priority?: RealTimeAIPriority;
}
