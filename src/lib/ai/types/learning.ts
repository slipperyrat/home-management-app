// AI Learning System TypeScript Interfaces
// Defines the data structures for the AI learning and pattern recognition system

export interface AICorrectionPattern {
  id: string;
  household_id: string;
  correction_id: string;
  
  // Pattern analysis
  pattern_type: 'email_format' | 'data_extraction' | 'classification' | 'confidence_threshold' | 'user_preference';
  issue_category: 'missing_data' | 'incorrect_data' | 'wrong_classification' | 'low_confidence' | 'user_override';
  
  // Detailed analysis
  original_ai_output: any;
  corrected_output: any;
  correction_reason: string;
  
  // Learning metadata
  confidence_impact: number;
  pattern_strength: number;
  is_learned: boolean;
  
  // Timestamps
  created_at: string;
  learned_at?: string;
  updated_at: string;
}

export interface AIHouseholdProfile {
  id: string;
  household_id: string;
  
  // Learning progress
  total_corrections: number;
  successful_learnings: number;
  accuracy_improvement: number;
  
  // Pattern preferences
  preferred_email_formats?: any;
  common_bill_providers?: any;
  typical_shopping_patterns?: any;
  event_preferences?: any;
  
  // AI model and status
  current_ai_model_version: string;
  last_learning_update: string;
  learning_status: 'active' | 'paused' | 'completed';
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface AILearningRule {
  id: string;
  household_id: string;
  
  // Rule definition
  rule_name: string;
  rule_description?: string;
  rule_type: 'email_parsing' | 'data_extraction' | 'classification' | 'confidence_adjustment';
  
  // Rule conditions and actions
  trigger_conditions: any;
  learning_actions: any;
  priority: number;
  
  // Rule status
  is_active: boolean;
  success_rate: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface AISuggestionImprovement {
  id: string;
  household_id: string;
  
  // Improvement tracking
  suggestion_type: string;
  original_accuracy: number;
  improved_accuracy: number;
  improvement_factor: number;
  
  // Learning source
  pattern_id?: string;
  rule_id?: string;
  
  // Metadata
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
  total_patterns_learned: number;
  accuracy_trend: 'improving' | 'stable' | 'declining';
  top_learning_areas: string[];
  suggested_actions: string[];
  next_learning_goals: string[];
}

export interface PatternLearningRequest {
  correction_id: string;
  household_id: string;
  original_suggestion: any;
  user_correction: any;
  correction_type: string;
  user_notes: string;
}

export interface LearningRuleTrigger {
  rule: AILearningRule;
  conditions_met: boolean;
  confidence_score: number;
  suggested_actions: string[];
}
