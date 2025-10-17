import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import type {
  AICorrectionPattern,
  AIHouseholdProfile,
  AILearningRule,
  AILearningRuleActions,
  LearningAnalysisResult,
  HouseholdLearningInsights,
  PatternLearningRequest,
  LearningRuleTrigger,
} from '../types/learning';
import { logger } from '@/lib/logging/logger';
import type { Database, Json } from '@/types/supabase.generated';

export class AILearningService {
  private supabase = createSupabaseAdminClient();

  /**
   * Analyze a correction and extract learning patterns
   */
  async analyzeCorrection(request: PatternLearningRequest): Promise<LearningAnalysisResult> {
    try {
      logger.info('Analyzing correction for learning', { correctionId: request.correction_id });

      // Analyze the correction to determine pattern type and issue category
      const analysis = this.analyzeCorrectionPattern(request);
      
      // Create the correction pattern record
      const patternInsert: Database['public']['Tables']['ai_correction_patterns']['Insert'] = {
        household_id: request.household_id,
        correction_id: request.correction_id,
        pattern_type: analysis.pattern_type,
        issue_category: analysis.issue_category,
        correction_type: request.correction_type,
        original_ai_output: JSON.parse(JSON.stringify(request.original_suggestion)) as Json,
        corrected_output: JSON.parse(JSON.stringify(request.user_correction)) as Json,
        correction_reason: request.user_notes ?? null,
        confidence_impact: this.calculateConfidenceImpact(request),
        pattern_strength: 1,
        is_learned: false,
      };

      // Save the pattern to the database
      const { data: savedPattern, error } = await this.supabase
        .from('ai_correction_patterns')
        .insert(patternInsert)
        .select()
        .single();

      if (error) {
        logger.error('Failed to save correction pattern', error, {
          householdId: request.household_id,
          correctionId: request.correction_id,
        });
        throw new Error('Failed to save learning pattern');
      }

      logger.info('Saved correction pattern', { correctionPatternId: savedPattern.id });

      const normalizedPattern = this.normalizeCorrectionPattern(savedPattern);

      // Trigger learning rules
      await this.triggerLearningRules(request.household_id, normalizedPattern);

      // Update household profile
      await this.updateHouseholdProfile(request.household_id, normalizedPattern);

      return analysis;

    } catch (error) {
      logger.error('Error analyzing correction', error as Error, {
        householdId: request.household_id,
        correctionId: request.correction_id,
      });
      throw error;
    }
  }

  private normalizeCorrectionPattern(pattern: Database['public']['Tables']['ai_correction_patterns']['Row']): AICorrectionPattern {
    return {
      id: pattern.id,
      household_id: pattern.household_id,
      correction_id: pattern.correction_id,
      pattern_type: pattern.pattern_type,
      issue_category: pattern.issue_category,
      correction_type: pattern.correction_type,
      original_ai_output: (pattern.original_ai_output ?? null) as Record<string, unknown> | null,
      corrected_output: (pattern.corrected_output ?? null) as Record<string, unknown> | null,
      correction_reason: pattern.correction_reason,
      confidence_impact: pattern.confidence_impact,
      pattern_strength: pattern.pattern_strength,
      is_learned: pattern.is_learned,
      created_at: pattern.created_at,
      learned_at: pattern.learned_at,
      updated_at: pattern.updated_at,
    };
  }

  /**
   * Analyze the correction to determine pattern type and issue category
   */
  private analyzeCorrectionPattern(request: PatternLearningRequest): LearningAnalysisResult {
    const { original_suggestion, user_correction, correction_type } = request;

    // Determine pattern type based on what was corrected
    let pattern_type: AICorrectionPattern['pattern_type'] = 'user_preference';
    let issue_category: AICorrectionPattern['issue_category'] = 'user_override';

    if (correction_type === 'correct') {
      // Analyze what type of correction this is
      if (this.hasMissingData(original_suggestion, user_correction)) {
        pattern_type = 'data_extraction';
        issue_category = 'missing_data';
      } else if (this.hasIncorrectData(original_suggestion, user_correction)) {
        pattern_type = 'data_extraction';
        issue_category = 'incorrect_data';
      } else if (this.hasWrongClassification(original_suggestion, user_correction)) {
        pattern_type = 'classification';
        issue_category = 'wrong_classification';
      }
    } else if (correction_type === 'ignore') {
      pattern_type = 'confidence_threshold';
      issue_category = 'low_confidence';
    }

    // Determine learning priority
    const learning_priority = this.calculateLearningPriority(pattern_type, issue_category);

    // Generate suggested improvements
    const suggested_improvements = this.generateSuggestedImprovements([{ 
      pattern_type, 
      issue_category,
      id: '',
      household_id: request.household_id,
      correction_id: request.correction_id,
      correction_type: request.correction_type as 'correct' | 'ignore' | 'mark_done',
      original_ai_output: request.original_suggestion,
      corrected_output: request.user_correction,
      correction_reason: request.user_notes,
      confidence_impact: 0,
      pattern_strength: 1,
      is_learned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]);

    return {
      pattern_type,
      issue_category,
      confidence_impact: this.calculateConfidenceImpact(request),
      suggested_improvements,
      learning_priority
    };
  }

  /**
   * Check if the correction involves missing data
   */
  private hasMissingData(original: Record<string, unknown>, corrected: Record<string, unknown>): boolean {
    if (!original || !corrected) return false;
    
    // Check if corrected version has more fields or data
    const originalKeys = Object.keys(original);
    const correctedKeys = Object.keys(corrected);
    
    return correctedKeys.length > originalKeys.length || 
           correctedKeys.some(key => corrected[key] && !original[key]);
  }

  /**
   * Check if the correction involves incorrect data
   */
  private hasIncorrectData(original: Record<string, unknown>, corrected: Record<string, unknown>): boolean {
    if (!original || !corrected) return false;
    
    // Check if any values were changed
    return Object.keys(corrected).some(key => 
      original[key] && corrected[key] && original[key] !== corrected[key]
    );
  }

  /**
   * Check if the correction involves wrong classification
   */
  private hasWrongClassification(original: Record<string, unknown>, corrected: Record<string, unknown>): boolean {
    if (!original || !corrected) return false;
    
    const originalSuggestionType = original.suggestion_type as string | undefined;
    const correctedSuggestionType = corrected.suggestion_type as string | undefined;
    const originalItemType = original.item_type as string | undefined;
    const correctedItemType = corrected.item_type as string | undefined;

    return Boolean(
      (originalSuggestionType && correctedSuggestionType && originalSuggestionType !== correctedSuggestionType) ||
      (originalItemType && correctedItemType && originalItemType !== correctedItemType)
    );
  }

  /**
   * Calculate the impact on confidence scoring
   */
  private calculateConfidenceImpact(request: PatternLearningRequest): number {
    // Base impact on correction type
    let impact = 0.1; // Default small impact
    
    if (request.correction_type === 'correct') {
      impact = 0.3; // Medium impact for corrections
    } else if (request.correction_type === 'ignore') {
      impact = 0.2; // Small impact for ignored suggestions
    } else if (request.correction_type === 'mark_done') {
      impact = 0.1; // Minimal impact for completed items
    }

    // Adjust based on user notes length (more detailed feedback = higher impact)
    if (request.user_notes.length > 50) {
      impact *= 1.5;
    }

    return Math.min(impact, 1.0); // Cap at 1.0
  }

  /**
   * Calculate learning priority
   */
  private calculateLearningPriority(pattern_type: AICorrectionPattern['pattern_type'], _issue_category: AICorrectionPattern['issue_category']): 'high' | 'medium' | 'low' {
    // High priority for classification and data extraction issues
    if (pattern_type === 'classification' || pattern_type === 'data_extraction') {
      return 'high';
    }
    
    // Medium priority for confidence threshold issues
    if (pattern_type === 'confidence_threshold') {
      return 'medium';
    }
    
    // Low priority for user preferences
    return 'low';
  }

  /**
   * Generate suggested improvements based on the pattern
   */
  private generateSuggestedImprovements(patterns: AICorrectionPattern[]): string[] {
    const improvements: string[] = [];
    
    if (!patterns || patterns.length === 0) {
      improvements.push('Start providing feedback to help the AI learn your preferences');
      return improvements;
    }

    // Analyze patterns to generate relevant improvements
    const patternTypes = patterns.map(p => p.pattern_type);
    const issueCategories = patterns.map(p => p.issue_category);

    if (patternTypes.includes('data_extraction')) {
      if (issueCategories.includes('missing_data')) {
        improvements.push('Improve data extraction prompts for your email formats');
        improvements.push('Add validation for required fields');
      }
      if (issueCategories.includes('incorrect_data')) {
        improvements.push('Refine data parsing logic for your providers');
        improvements.push('Add data validation rules');
      }
    }
    
    if (patternTypes.includes('classification')) {
      improvements.push('Update classification rules for your email types');
      improvements.push('Improve confidence thresholds for your categories');
    }
    
    if (patternTypes.includes('confidence_threshold')) {
      improvements.push('Adjust confidence thresholds for your suggestion types');
      improvements.push('Add more context to low-confidence suggestions');
    }
    
    if (patternTypes.includes('user_preference')) {
      improvements.push('Learn your preferences for suggestion types');
      improvements.push('Personalize suggestions based on your household patterns');
    }

    // Add general improvements based on correction count
    if (patterns.length < 5) {
      improvements.push('Continue providing feedback to build better learning patterns');
    } else if (patterns.length < 10) {
      improvements.push('Great progress! Keep correcting to refine AI understanding');
    } else {
      improvements.push('Excellent learning progress! Consider reviewing advanced settings');
    }

    return improvements;
  }

  /**
   * Trigger learning rules based on the correction pattern
   */
  private async triggerLearningRules(household_id: string, pattern: AICorrectionPattern): Promise<void> {
    try {
      // Get applicable learning rules
      const { data: rules, error: rulesError } = await this.supabase
        .from('ai_learning_rules')
        .select('*')
        .eq('household_id', household_id)
        .eq('is_active', true);

      if (rulesError) {
        logger.error('Failed to fetch learning rules', rulesError, { householdId: household_id });
        return;
      }

      logger.info('Applicable learning rules fetched', { householdId: household_id, ruleCount: rules?.length ?? 0 });

      // Check which rules should be triggered
      for (const rule of rules ?? []) {
        const normalizedRule = this.normalizeLearningRule(rule);
        if (!normalizedRule) {
          continue;
        }
        const trigger = this.evaluateLearningRule(normalizedRule, pattern);
        
        if (trigger.conditions_met) {
          logger.info('Triggering learning rule', { ruleName: normalizedRule.rule_name, correctionPatternId: pattern.id });
          await this.executeLearningRule(normalizedRule, pattern, trigger);
        }
      }

    } catch (error) {
      logger.error('Error triggering learning rules', error as Error, { householdId: household_id });
    }
  }

  private normalizeLearningRule(rule: Database['public']['Tables']['ai_learning_rules']['Row']): AILearningRule | null {
    const conditions = (rule.trigger_conditions ?? {}) as Record<string, unknown>;
    const actions = (rule.learning_actions ?? {}) as Record<string, unknown>;

    const normalizedConditions: AILearningRule['trigger_conditions'] = {
      ...(typeof conditions.pattern_type === 'string' ? { pattern_type: conditions.pattern_type } : {}),
      ...(typeof conditions.issue_category === 'string' ? { issue_category: conditions.issue_category } : {}),
      ...(typeof conditions.correction_type === 'string' ? { correction_type: conditions.correction_type } : {}),
    };

    const normalizedActions: AILearningRule['learning_actions'] = {
      action: (actions.action as AILearningRuleActions['action']) ?? 'adjust_confidence_threshold',
      ...(typeof actions.parameters === 'object' && actions.parameters !== null
        ? { parameters: actions.parameters as Record<string, unknown> }
        : {}),
    };

    return {
      id: rule.id,
      household_id: rule.household_id,
      rule_name: rule.rule_name ?? 'Unnamed rule',
      rule_description: rule.rule_description ?? null,
      rule_type: rule.rule_type ?? 'general',
      trigger_conditions: normalizedConditions,
      learning_actions: normalizedActions,
      priority: rule.priority,
      is_active: rule.is_active,
      success_rate: rule.success_rate,
      created_at: rule.created_at,
      updated_at: rule.updated_at,
    };
  }

  /**
   * Evaluate if a learning rule should be triggered
   */
  private evaluateLearningRule(rule: AILearningRule, pattern: AICorrectionPattern): LearningRuleTrigger {
    const conditions = rule.trigger_conditions ?? {};
    let conditions_met = false;
    let confidence_score = 0;

    // Check if pattern type matches
    if (conditions.pattern_type && conditions.pattern_type === pattern.pattern_type) {
      conditions_met = true;
      confidence_score += 0.5;
    }

    // Check if issue category matches
    if (conditions.issue_category && conditions.issue_category === pattern.issue_category) {
      conditions_met = true;
      confidence_score += 0.3;
    }

    // Check if correction type matches
    if (conditions.correction_type && conditions.correction_type === pattern.correction_type) {
      conditions_met = true;
      confidence_score += 0.2;
    }

    const suggested_actions = rule.learning_actions?.action ? [rule.learning_actions.action] : [];

    return {
      rule,
      conditions_met,
      confidence_score: Math.min(confidence_score, 1.0),
      suggested_actions
    };
  }

  /**
   * Execute a learning rule
   */
  private async executeLearningRule(rule: AILearningRule, pattern: AICorrectionPattern, _trigger: LearningRuleTrigger): Promise<void> {
    try {
      const actions = rule.learning_actions;
      
      if (actions.action === 'update_email_format_preferences') {
        await this.updateEmailFormatPreferences(pattern);
      } else if (actions.action === 'update_bill_provider_patterns') {
        await this.updateBillProviderPatterns(pattern);
      } else if (actions.action === 'adjust_confidence_threshold') {
        await this.adjustConfidenceThreshold(pattern);
      }

      // Mark pattern as learned
      await this.supabase
        .from('ai_correction_patterns')
        .update({ is_learned: true, learned_at: new Date().toISOString() })
        .eq('id', pattern.id);

      logger.info('Executed learning rule', { ruleName: rule.rule_name, correctionPatternId: pattern.id });

    } catch (error) {
      logger.error('Error executing learning rule', error as Error, { ruleName: rule.rule_name, correctionPatternId: pattern.id });
    }
  }

  /**
   * Update email format preferences based on corrections
   */
  private async updateEmailFormatPreferences(_pattern: AICorrectionPattern): Promise<void> {
    logger.debug?.('Updating email format preferences based on correction pattern');
  }

  /**
   * Update bill provider patterns based on corrections
   */
  private async updateBillProviderPatterns(_pattern: AICorrectionPattern): Promise<void> {
    logger.debug?.('Updating bill provider patterns based on correction pattern');
  }

  /**
   * Adjust confidence thresholds based on corrections
   */
  private async adjustConfidenceThreshold(_pattern: AICorrectionPattern): Promise<void> {
    logger.debug?.('Adjusting confidence thresholds based on correction pattern');
  }

  /**
   * Update household learning profile
   */
  private async updateHouseholdProfile(household_id: string, pattern?: AICorrectionPattern): Promise<void> {
    try {
      // Get or create household profile
      let { data: profileRow } = await this.supabase
        .from('ai_household_profiles')
        .select('*')
        .eq('household_id', household_id)
        .single();

      let profile = this.mapProfile(profileRow);

      if (!profile) {
        // Create new profile
        const { data: newProfile, error } = await this.supabase
          .from('ai_household_profiles')
          .insert({
            household_id,
            total_corrections: 1,
            successful_learnings: 0,
            accuracy_improvement: 0.0
          })
          .select()
          .single();

        if (error) throw error;
        profile = this.mapProfile(newProfile);
      } else if (pattern) {
        // Update existing profile
        const currentCorrections = profile.total_corrections ?? 0;
        const { data: updatedProfile, error } = await this.supabase
          .from('ai_household_profiles')
          .update({
            total_corrections: currentCorrections + 1,
            successful_learnings: (profile.successful_learnings ?? 0) + (pattern.is_learned ? 1 : 0),
            accuracy_improvement: this.calculateAccuracyImprovement(profile, Boolean(pattern?.is_learned)),
            last_learning_update: new Date().toISOString(),
          })
          .eq('id', profile.id)
          .select('*')
          .single();

        if (error) throw error;
        profile = this.mapProfile(updatedProfile);
      }

      logger.info('Household learning profile updated', { householdId: household_id });

    } catch (error) {
      logger.error('Error updating household profile', error as Error, { householdId: household_id });
    }
  }

  /**
   * Get household learning insights
   */
  async getHouseholdLearningInsights(household_id: string): Promise<HouseholdLearningInsights> {
    try {
      // Get household profile
      const { data: profileRow } = await this.supabase
        .from('ai_household_profiles')
        .select('*')
        .eq('household_id', household_id)
        .single();

      const profile = this.mapProfile(profileRow);

      // Get total corrections count
      const { count: totalCorrections } = await this.supabase
        .from('ai_corrections')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', household_id);

      // Get learning patterns
      const { data: patternsRows } = await this.supabase
        .from('ai_correction_patterns')
        .select('*')
        .eq('household_id', household_id)
        .eq('is_learned', true);

      const patterns = (patternsRows ?? []).map((pattern) => this.mapPattern(pattern));

      // Calculate insights
      const total_patterns_learned = patterns.length;
      const accuracy_trend = this.calculateAccuracyTrend(profile ?? null, patterns);
      const top_learning_areas = this.getTopLearningAreas(patterns);
      const suggested_improvements = this.generateSuggestedImprovements(patterns);
      const next_learning_goals = this.generateNextLearningGoals(profile ?? null, patterns);

      return {
        household_id,
        total_corrections: totalCorrections || 0,
        patterns_identified: total_patterns_learned,
        accuracy_trend: this.convertTrendToPercentage(accuracy_trend),
        top_learning_areas,
        suggested_improvements,
        confidence_threshold: this.getConfidenceThreshold(profile ?? null),
        learning_goals: next_learning_goals,
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error getting household learning insights', error as Error, { householdId: household_id });
      throw error;
    }
  }

  /**
   * Calculate accuracy trend based on learning data
   */
  private calculateAccuracyTrend(profile: AIHouseholdProfile | null, patterns: AICorrectionPattern[]): 'improving' | 'stable' | 'declining' {
    if (!profile || !patterns || patterns.length === 0) return 'stable';
    
    // Simple trend calculation based on recent patterns
    const recent_patterns = patterns.filter(p => 
      p.created_at !== null && new Date(p.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    );
    
    if (recent_patterns.length === 0) return 'stable';
    
    const high_priority_patterns = recent_patterns.filter(p => 
      p.pattern_type === 'classification' || p.pattern_type === 'data_extraction'
    );
    
    if (high_priority_patterns.length > patterns.length * 0.3) {
      return 'improving';
    } else if (high_priority_patterns.length < patterns.length * 0.1) {
      return 'declining';
    }
    
    return 'stable';
  }

  /**
   * Get top learning areas based on patterns
   */
  private getTopLearningAreas(patterns: AICorrectionPattern[]): string[] {
    if (!patterns) return [];
    
    const areaCounts: Record<string, number> = {};
    
    patterns.forEach(pattern => {
      const patternType = pattern.pattern_type ?? 'unknown';
      const issueCategory = pattern.issue_category ?? 'unspecified';
      const area = `${patternType} (${issueCategory})`;
      areaCounts[area] = (areaCounts[area] || 0) + 1;
    });
    
    return Object.entries(areaCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([area]) => area);
  }

  /**
   * Calculate accuracy improvement based on current and previous profiles
   */
  private calculateAccuracyImprovement(currentProfile: AIHouseholdProfile | null, isNewPattern: boolean): number {
    if (!currentProfile) return 0;

    const previousAccuracyImprovement = currentProfile.accuracy_improvement ?? 0;

    if (isNewPattern) {
      return Math.min(previousAccuracyImprovement + 0.05, 1);
    }

    return Math.max(previousAccuracyImprovement - 0.01, 0);
  }

  /**
   * Convert trend to percentage for dashboard display
   */
  private convertTrendToPercentage(trend: 'improving' | 'stable' | 'declining'): number {
    switch (trend) {
      case 'improving':
        return 85; // High percentage for improving trend
      case 'stable':
        return 65; // Medium percentage for stable trend
      case 'declining':
        return 35; // Low percentage for declining trend
      default:
        return 50; // Default middle value
    }
  }

  /**
   * Generate next learning goals
   */
  private generateNextLearningGoals(profile: AIHouseholdProfile | null, patterns: AICorrectionPattern[]): string[] {
    const goals: string[] = [];
    
    if (!profile || !patterns) return goals;
    
    if ((profile.total_corrections ?? 0) < 10) {
      goals.push('Reach 10 total corrections for better pattern recognition');
    }
    
    if ((profile.successful_learnings ?? 0) < 5) {
      goals.push('Achieve 5 successful learning patterns');
    }
    
    if ((profile.accuracy_improvement ?? 0) < 0.1) {
      goals.push('Improve accuracy by 10% through learning');
    }
    
    return goals;
  }

  /**
   * Get confidence threshold from household profile
   */
  private getConfidenceThreshold(profile: AIHouseholdProfile | null): number {
    return profile?.confidence_threshold ?? 75;
  }

  private mapProfile(row: Database['public']['Tables']['ai_household_profiles']['Row'] | null): AIHouseholdProfile | null {
    if (!row) return null;

    return {
      id: row.id,
      household_id: row.household_id,
      total_corrections: row.total_corrections ?? 0,
      successful_learnings: row.successful_learnings ?? 0,
      accuracy_improvement: row.accuracy_improvement ?? 0,
      preferred_email_formats: this.toRecord(row.preferred_email_formats),
      common_bill_providers: this.toRecord(row.common_bill_providers),
      typical_shopping_patterns: this.toRecord(row.typical_shopping_patterns),
      event_preferences: this.toRecord(row.event_preferences),
      current_ai_model_version: row.current_ai_model_version,
      last_learning_update: row.last_learning_update,
      learning_status: row.learning_status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapPattern(row: Database['public']['Tables']['ai_correction_patterns']['Row']): AICorrectionPattern {
    return {
      ...row,
      original_ai_output: this.toRecord(row.original_ai_output),
      corrected_output: this.toRecord(row.corrected_output),
    };
  }

  private toRecord(value: Json | null): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
