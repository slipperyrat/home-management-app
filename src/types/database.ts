export interface Household {
  id: string;
  name: string | null;
  plan: string | null;
  game_mode: string | null;
}

export interface User {
  id: string;
  email?: string | null;
  household_id: string | null;
  households?: Household | null;
  onboarding_completed?: boolean | null;
}

export interface HouseholdMember {
  user_id: string;
  household_id: string;
  role: string | null;
}

export interface RecipeRow {
  id: string;
  household_id: string;
  title: string | null;
  description: string | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  tags: string[] | null;
  image_url: string | null;
  created_at?: string;
}

export interface MealPlanRow {
  id: string;
  household_id: string;
  week_start_date: string;
  meals: Record<string, Record<string, string | null>> | null;
  created_at?: string;
}

export interface ChoreRow {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: string;
  due_at: string | null;
  ai_difficulty_rating: number | null;
  ai_energy_level: 'low' | 'medium' | 'high' | null;
  category: string | null;
  updated_at: string;
}

export interface ChorePreferenceRow {
  id: string;
  user_id: string;
  chore_category: string;
  energy_preference: 'low' | 'medium' | 'high';
}

export interface ChoreInsightRow {
  id: string;
  insight_type: string;
  insight_data: Record<string, unknown>;
  ai_confidence: number | null;
  generated_at: string;
  created_at?: string;
}

export interface AuditLogInput {
  action: string;
  targetTable: string;
  targetId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface Reward {
  id: string;
  title: string;
  cost_xp: number;
  cost_coins: number;
  created_at: string;
  [key: string]: unknown;
}

export interface RewardClaim {
  reward_id: string;
  user_id: string;
}

export interface PowerUpRow {
  id: string;
  user_id: string;
  type: string;
  expires_at: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface ReceiptItem {
  id: string;
  attachment_id: string;
  household_id: string;
  item_name: string;
  item_price: number;
  item_quantity: number;
  item_category?: string;
  item_brand?: string;
  item_unit?: string;
  confidence_score: number;
  attachment?: {
    id: string;
    file_name: string;
    receipt_store?: string;
    receipt_date?: string;
  } | null;
}

export interface SpendEntryRow {
  id: string;
  household_id: string;
  amount: number;
  description: string | null;
  category: string | null;
  envelope_id: string | null;
  receipt_attachment_id: string | null;
  transaction_date: string;
  merchant: string | null;
  payment_method: string | null;
  source: string | null;
  created_by: string;
}

export interface BudgetEnvelopeRow {
  id: string;
  household_id: string;
  name: string;
  color: string | null;
  category: string | null;
  period_end: string;
}

export interface ShoppingItemRow {
  id: string;
  name: string;
  category: string | null;
  created_at: string;
  shopping_list_id: string | null;
}

export interface ShoppingListRow {
  id: string;
  title: string;
  created_by: string;
  household_id: string;
  created_at: string;
}

export interface AICorrectionPattern {
  id: string;
  household_id: string;
  correction_id: string;
  pattern_type: 'email_format' | 'data_extraction' | 'classification' | 'confidence_threshold' | 'user_preference';
  issue_category: 'missing_data' | 'incorrect_data' | 'wrong_classification' | 'low_confidence' | 'user_override';
  correction_type: 'correct' | 'ignore' | 'mark_done';
  original_ai_output: Record<string, unknown> | null;
  corrected_output: Record<string, unknown> | null;
  correction_reason: string;
  confidence_impact: number;
  pattern_strength: number;
  is_learned: boolean;
  created_at: string;
  learned_at?: string;
  updated_at: string;
}

export interface AIHouseholdProfile {
  id: string;
  household_id: string;
  total_corrections: number;
  successful_learnings: number;
  accuracy_improvement: number;
  preferred_email_formats?: Record<string, unknown> | null;
  common_bill_providers?: Record<string, unknown> | null;
  typical_shopping_patterns?: Record<string, unknown> | null;
  event_preferences?: Record<string, unknown> | null;
  current_ai_model_version: string;
  last_learning_update: string;
  learning_status: 'active' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface AILearningRule {
  id: string;
  household_id: string | null;
  rule_name: string;
  rule_description?: string;
  rule_type: 'email_parsing' | 'data_extraction' | 'classification' | 'confidence_adjustment';
  trigger_conditions: Record<string, unknown>;
  learning_actions: {
    action: 'update_email_format_preferences' | 'update_bill_provider_patterns' | 'adjust_confidence_threshold';
    parameters?: Record<string, unknown>;
  };
  priority: number;
  is_active: boolean;
  success_rate: number;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItem {
  id: string;
  attachment_id: string;
  household_id: string;
  item_name: string;
  item_price: number;
  item_quantity: number;
  item_category?: string;
  item_brand?: string;
  item_unit?: string;
  confidence_score: number;
  attachment?: {
    id: string;
    file_name: string;
    receipt_store?: string;
    receipt_date?: string;
  } | null;
}

export interface SpendEntryRow {
  id: string;
  household_id: string;
  amount: number;
  description: string | null;
  category: string | null;
  envelope_id: string | null;
  receipt_attachment_id: string | null;
  transaction_date: string;
  merchant: string | null;
  payment_method: string | null;
  source: string | null;
  created_by: string;
}

export interface BudgetEnvelopeRow {
  id: string;
  household_id: string;
  name: string;
  color: string | null;
  category: string | null;
  period_end: string;
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
      };
      household_members: {
        Row: HouseholdMember;
      };
      recipes: {
        Row: RecipeRow;
      };
      meal_plans: {
        Row: MealPlanRow;
      };
      chores: {
        Row: ChoreRow;
      };
      chore_preferences: {
        Row: ChorePreferenceRow;
      };
      bills: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          amount: number;
          currency: string;
          due_date: string;
          priority: 'low' | 'medium' | 'high' | 'urgent';
          category: string | null;
          household_id: string;
          created_by: string;
          status: string;
          recurring_rrule: string | null;
        };
      };
      household_events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          start_time: string;
          end_time: string;
          household_id: string;
          created_by: string;
          type: string;
          source: string | null;
          payload: Record<string, unknown> | null;
        };
      };
      rewards: {
        Row: Reward;
      };
      reward_claims: {
        Row: RewardClaim;
      };
      power_ups: {
        Row: PowerUpRow;
      };
      receipt_items: {
        Row: ReceiptItem;
      };
      spend_entries: {
        Row: {
          id: string;
          household_id: string;
          amount: number;
          description: string | null;
          category: string | null;
          envelope_id: string | null;
          receipt_attachment_id: string | null;
          transaction_date: string;
          merchant: string | null;
          payment_method: string | null;
          source: string | null;
          created_by: string;
        };
      };
      budget_envelopes: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          color: string | null;
          category: string | null;
          period_end: string;
        };
      };
      ai_correction_patterns: {
        Row: AICorrectionPattern;
      };
      ai_household_profiles: {
        Row: AIHouseholdProfile;
      };
      ai_learning_rules: {
        Row: AILearningRule;
      };
      ai_corrections: {
        Row: {
          id: string;
          household_id: string;
          created_at: string;
        };
      };
      shopping_lists: {
        Row: ShoppingListRow;
      };
      shopping_items: {
        Row: ShoppingItemRow;
      };
      chore_ai_insights: {
        Row: ChoreInsightRow;
      };
    };
  };
};
