import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/supabase.generated';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey);

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const householdId = userData.household_id;

    // Fetch chores and related data for insights
    const { data: chores, error: choresError } = await supabase
      .from('chores')
      .select('*')
      .eq('household_id', householdId);

    if (choresError) {
      logger.error('Error fetching chores', choresError, { householdId, userId });
      return NextResponse.json({ error: 'Failed to fetch chores' }, { status: 500 });
    }

    // Fetch chore completions for pattern analysis
    const { data: completions, error: completionsError } = await supabase
      .from('chore_completion_patterns')
      .select('*');

    if (completionsError) {
      logger.warn('Completions table not available, continuing without completion data', {
        error: completionsError.message,
        householdId,
      });
    }

    // Fetch chore preferences for optimization
    const { data: preferences, error: preferencesError } = await supabase
      .from('chore_preferences')
      .select('*');

    if (preferencesError) {
      logger.warn('Preferences table not available, continuing without preference data', {
        error: preferencesError.message,
        householdId,
      });
    }

    // Generate AI insights
    const insights = calculateAIChoreInsights(
      chores ?? [],
      completions ?? [],
      preferences ?? []
    );

    return NextResponse.json({
      success: true,
      insights
    });

  } catch (error) {
    logger.error('Error in chore insights API', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type ChoreRecord = Database['public']['Tables']['chores']['Row'];
type CompletionRecord = Database['public']['Tables']['chore_completion_patterns']['Row'];
type PreferenceRecord = Database['public']['Tables']['chore_preferences']['Row'];

type EnergyLevel = 'low' | 'medium' | 'high';

type ChoreInsights = {
  total_chores: number;
  pending_chores: number;
  completed_chores: number;
  ai_suggested_chores: number;
  average_difficulty: number;
  average_duration: number;
  fairness_score: number;
  household_patterns: string[];
  suggested_improvements: string[];
  ai_learning_progress: number;
  optimal_scheduling: string[];
  skill_gaps: string[];
  energy_distribution: Record<EnergyLevel, number>;
  category_breakdown: Record<string, number>;
  user_workload_distribution: Record<string, number>;
  completion_efficiency: number;
  ai_confidence_trends: {
    improving: number;
    stable: number;
    declining: number;
  };
};

function calculateAIChoreInsights(
  chores: ChoreRecord[],
  completions: CompletionRecord[],
  preferences: PreferenceRecord[],
): ChoreInsights {
  const insights = {
    total_chores: chores.length,
    pending_chores: chores.filter(c => c.status === 'pending').length,
    completed_chores: chores.filter(c => c.status === 'completed').length,
    ai_suggested_chores: chores.filter(c => c.ai_suggested).length,
    average_difficulty: 0,
    average_duration: 0,
    fairness_score: 0,
    household_patterns: [] as string[],
    suggested_improvements: [] as string[],
    ai_learning_progress: 0,
    optimal_scheduling: [] as string[],
    skill_gaps: [] as string[],
    energy_distribution: {
      low: 0,
      medium: 0,
      high: 0
    },
    category_breakdown: {} as Record<string, number>,
    user_workload_distribution: {} as Record<string, number>,
    completion_efficiency: 0,
    ai_confidence_trends: {
      improving: 0,
      stable: 0,
      declining: 0
    }
  };

  // Calculate averages
  if (chores.length > 0) {
    insights.average_difficulty = Math.round(
      chores.reduce((sum, c) => sum + (c.ai_difficulty_rating || 50), 0) / chores.length
    );
    insights.average_duration = Math.round(
      chores.reduce((sum, c) => sum + (c.ai_estimated_duration || 30), 0) / chores.length
    );
  }

  // Calculate energy distribution
  chores.forEach(chore => {
    const energy = (chore.ai_energy_level ?? 'medium') as EnergyLevel;
    insights.energy_distribution[energy] += 1;
  });

  // Calculate category breakdown
  chores.forEach(chore => {
    const category = chore.category || 'general';
    insights.category_breakdown[category] = (insights.category_breakdown[category] || 0) + 1;
  });

  // Calculate user workload distribution
  chores.forEach(chore => {
    if (chore.assigned_to) {
      insights.user_workload_distribution[chore.assigned_to] =
        (insights.user_workload_distribution[chore.assigned_to] || 0) + 1;
    }
  });

  // Calculate fairness score
  const userCounts = Object.values(insights.user_workload_distribution);
  if (userCounts.length > 0) {
    const mean = userCounts.reduce((sum, count) => sum + count, 0) / userCounts.length;
    const variance = userCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / userCounts.length;
    insights.fairness_score = Math.round(Math.max(0, 100 - (Math.sqrt(variance) / mean * 100)));
  }

  // Analyze completion patterns
  if (completions.length > 0) {
    const totalEstimatedTime = chores.reduce((sum, c) => sum + (c.ai_estimated_duration || 30), 0);
    const totalActualTime = completions.reduce((sum, c) => sum + (c.completion_time ?? 0), 0);
    insights.completion_efficiency = totalActualTime > 0
      ? Math.round((totalEstimatedTime / totalActualTime) * 100)
      : 0;
  }

  // Generate household patterns
  if (chores.length >= 5) {
    insights.household_patterns.push(
      'You have a good variety of chores across different difficulty levels'
    );
  }

  if (insights.fairness_score >= 80) {
    insights.household_patterns.push(
      'Chore distribution is well-balanced across household members'
    );
  } else if (insights.fairness_score >= 60) {
    insights.household_patterns.push(
      'Chore distribution is moderately balanced with room for improvement'
    );
  } else {
    insights.household_patterns.push(
      'Chore distribution could be more balanced for better household harmony'
    );
  }

  // Generate suggested improvements
  if (insights.pending_chores > insights.completed_chores) {
    insights.suggested_improvements.push(
      'Consider breaking down large chores into smaller, manageable tasks'
    );
  }

  if (insights.fairness_score < 70) {
    insights.suggested_improvements.push(
      'Use AI-powered rotation to ensure fair chore distribution'
    );
  }

  if (insights.completion_efficiency < 80) {
    insights.suggested_improvements.push(
      'Review time estimates and adjust based on actual completion patterns'
    );
  }

  if (insights.ai_suggested_chores < chores.length * 0.3) {
    insights.suggested_improvements.push(
      'Enable more AI suggestions to optimize chore scheduling and assignment'
    );
  }

  // Calculate AI learning progress
  const learningFactors = [
    completions.length > 0 ? 25 : 0,
    preferences.length > 0 ? 25 : 0,
    insights.fairness_score > 70 ? 25 : 0,
    insights.completion_efficiency > 80 ? 25 : 0
  ];
  insights.ai_learning_progress = learningFactors.reduce((sum, factor) => sum + factor, 0);

  // Generate optimal scheduling suggestions
  const morningChores = chores.filter(c => c.ai_energy_level === 'high').length;
  const eveningChores = chores.filter(c => c.ai_energy_level === 'low').length;
  
  if (morningChores > eveningChores) {
    insights.optimal_scheduling.push('Schedule high-energy tasks in the morning');
  }
  if (eveningChores > morningChores) {
    insights.optimal_scheduling.push('Schedule low-energy tasks in the evening');
  }

  // Identify skill gaps
  const requiredSkills = new Set<string>();
  chores.forEach(chore => {
    if (chore.ai_skill_requirements && Array.isArray(chore.ai_skill_requirements)) {
      chore.ai_skill_requirements.forEach((skill: unknown) => {
        if (typeof skill === 'string' && skill.trim().length > 0) {
          requiredSkills.add(skill);
        }
      });
    }
  });

  if (requiredSkills.size > 0) {
    insights.skill_gaps.push(
      `Consider training opportunities for: ${Array.from(requiredSkills).join(', ')}`
    );
  }

  return insights;
}
