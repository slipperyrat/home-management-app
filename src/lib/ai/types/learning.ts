// AI Learning System TypeScript Interfaces
// Defines the data structures for the AI learning and pattern recognition system

export interface AICorrectionPattern {
  id: string;
  household_id: string;
  correction_id: string;
  pattern_type: string;
  issue_category: string;
  correction_type: string;
  original_ai_output: Record<string, unknown> | null;
  corrected_output: Record<string, unknown> | null;
  correction_reason: string | null;
  confidence_impact: number | null;
  pattern_strength: number | null;
  is_learned: boolean | null;
  created_at: string | null;
  learned_at?: string | null;
  updated_at: string | null;
}

export interface AIHouseholdProfile {
  id: string;
  household_id: string;
  total_corrections: number | null;
  successful_learnings: number | null;
  accuracy_improvement: number | null;
  preferred_email_formats: Record<string, unknown> | null;
  common_bill_providers: Record<string, unknown> | null;
  typical_shopping_patterns: Record<string, unknown> | null;
  event_preferences: Record<string, unknown> | null;
  current_ai_model_version: string | null;
  last_learning_update: string | null;
  learning_status: string | null;
  created_at: string | null;
  updated_at: string | null;
  confidence_threshold?: number | null;
}

export interface AILearningRuleConditions {
  pattern_type?: AICorrectionPattern['pattern_type'];
  issue_category?: AICorrectionPattern['issue_category'];
  correction_type?: AICorrectionPattern['correction_type'];
}

export interface AILearningRuleActions {
  action: 'update_email_format_preferences' | 'update_bill_provider_patterns' | 'adjust_confidence_threshold';
  parameters?: Record<string, unknown>;
}

export interface AILearningRule {
  id: string;
  household_id: string | null;
  rule_name: string;
  rule_description?: string | null;
  rule_type: string;
  trigger_conditions: AILearningRuleConditions;
  learning_actions: AILearningRuleActions;
  priority: number | null;
  is_active: boolean | null;
  success_rate: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AISuggestionImprovement {
  id: string;
  household_id: string;
  suggestion_type: string;
  original_accuracy: number;
  improved_accuracy: number;
  improvement_factor: number;
  pattern_id?: string;
  rule_id?: string;
  learning_date: string;
  improvement_notes?: string;
}

export interface LearningAnalysisResult {
  pattern_type: AICorrectionPattern['pattern_type'];
  issue_category: AICorrectionPattern['issue_category'];
  confidence_impact: number;
  suggested_improvements: string[];
  learning_priority: 'high' | 'medium' | 'low';
}

export interface HouseholdLearningInsights {
  household_id: string;
  total_corrections: number;
  patterns_identified: number;
  accuracy_trend: number;
  top_learning_areas: string[];
  suggested_improvements: string[];
  confidence_threshold: number;
  learning_goals: string[];
  last_updated: string;
}

export interface PatternLearningRequest {
  correction_id: string;
  household_id: string;
  original_suggestion: Record<string, unknown>;
  user_correction: Record<string, unknown>;
  correction_type: 'correct' | 'ignore' | 'mark_done';
  user_notes: string;
}

export interface CorrectionData {
  suggestionId: string;
  correctionType: 'correct' | 'ignore' | 'mark_done';
  userNotes?: string;
}

export interface LearningRuleTrigger {
  rule: AILearningRule;
  conditions_met: boolean;
  confidence_score: number;
  suggested_actions: string[];
}
