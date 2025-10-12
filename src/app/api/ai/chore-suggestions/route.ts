import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database.types';

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

    // Fetch existing chores for pattern analysis
    const { data: chores, error: choresError } = await supabase
      .from('chores')
      .select('*')
      .eq('household_id', householdId);

    if (choresError) {
      logger.error('Error fetching chores', choresError, { householdId, userId });
      return NextResponse.json({ error: 'Failed to fetch chores' }, { status: 500 });
    }

    // Fetch completion patterns for learning
    const { data: completions, error: completionsError } = await supabase
      .from('chore_completion_patterns')
      .select('*')
      .eq('household_id', householdId);

    if (completionsError) {
      logger.error('Error fetching completions', completionsError, { householdId, userId });
      return NextResponse.json({ error: 'Failed to fetch completions' }, { status: 500 });
    }

    // Generate AI-powered chore suggestions
    const suggestions = generateAIChoreSuggestions(
      chores ?? [],
      completions ?? [],
      householdId
    );

    return NextResponse.json({
      success: true,
      suggestions
    });

  } catch (error) {
    logger.error('Error in chore suggestions API', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type ChoreRecord = Database['public']['Tables']['chores']['Row'];
type CompletionRecord = Database['public']['Tables']['chore_completion_patterns']['Row'];

type SuggestionPriority = 'low' | 'medium' | 'high';

type ChoreSuggestion = {
  id: string;
  title: string;
  description: string;
  category: string;
  ai_difficulty_rating: number;
  ai_estimated_duration: number;
  ai_energy_level: 'low' | 'medium' | 'high';
  ai_confidence: number;
  reasoning: string;
  suggested_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'seasonal';
  priority: SuggestionPriority;
  ai_suggested: boolean;
  household_id: string;
  created_at: string;
  updated_at: string;
};

type EnergyDistribution = Record<'low' | 'medium' | 'high', number>;

function generateAIChoreSuggestions(
  chores: ChoreRecord[],
  completions: CompletionRecord[],
  householdId: string,
): ChoreSuggestion[] {
  const suggestions: ChoreSuggestion[] = [];
  const now = new Date();

  // Analyze existing chore patterns
  const choreCategories = chores.map(c => c.category || 'general');
  const categoryCounts: Record<string, number> = {};
  const difficultyLevels = chores.map(c => c.ai_difficulty_rating || 50);
  const energyLevels = chores.map(c => c.ai_energy_level || 'medium');

  // Count categories
  choreCategories.forEach(category => {
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  // Find most common categories
  const mostCommonCategories = Object.entries(categoryCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([category]) => category);

  // Calculate average difficulty and energy
  const avgDifficulty = difficultyLevels.length > 0 
    ? Math.round(difficultyLevels.reduce((sum, d) => sum + d, 0) / difficultyLevels.length)
    : 50;

  const energyDistribution: EnergyDistribution = { low: 0, medium: 0, high: 0 };
  energyLevels.forEach(energy => {
    energyDistribution[energy as keyof typeof energyDistribution]++;
  });

  // Generate category-based suggestions
  mostCommonCategories.forEach(category => {
    const categoryChores = chores.filter(c => c.category === category);
    const categoryDifficulty = categoryChores.length > 0
      ? Math.round(categoryChores.reduce((sum, c) => sum + (c.ai_difficulty_rating || 50), 0) / categoryChores.length)
      : 50;

    // Suggest complementary chores
    if (category === 'cleaning') {
      suggestions.push({
        id: 'deep-clean-suggestion',
        title: 'Deep Clean Session',
        description: 'Based on your cleaning patterns, consider a comprehensive deep cleaning session',
        category: 'cleaning',
        ai_difficulty_rating: Math.min(100, categoryDifficulty + 10),
        ai_estimated_duration: 120,
        ai_energy_level: 'high',
        ai_confidence: 85,
        reasoning: 'You frequently do cleaning chores, suggesting a preference for maintaining a clean environment',
        suggested_frequency: 'monthly',
        priority: 'medium'
      });
    }

    if (category === 'maintenance') {
      suggestions.push({
        id: 'preventive-maintenance',
        title: 'Preventive Maintenance Check',
        description: 'Schedule regular maintenance to prevent larger issues',
        category: 'maintenance',
        ai_difficulty_rating: Math.max(20, categoryDifficulty - 15),
        ai_estimated_duration: 60,
        ai_energy_level: 'medium',
        ai_confidence: 80,
        reasoning: 'Regular maintenance can reduce the need for complex repairs',
        suggested_frequency: 'quarterly',
        priority: 'high'
      });
    }

    if (category === 'cooking') {
      suggestions.push({
        id: 'meal-prep-suggestion',
        title: 'Weekly Meal Prep',
        description: 'Batch cooking can save time and ensure healthy meals',
        category: 'cooking',
        ai_difficulty_rating: Math.max(30, categoryDifficulty - 10),
        ai_estimated_duration: 90,
        ai_energy_level: 'medium',
        ai_confidence: 75,
        reasoning: 'Meal prep can complement your existing cooking routine',
        suggested_frequency: 'weekly',
        priority: 'medium'
      });
    }
  });

  // Generate difficulty-based suggestions
  if (avgDifficulty > 70) {
    suggestions.push({
      id: 'easy-chore-balance',
      title: 'Quick Daily Tasks',
      description: 'Add some simple daily chores to balance your routine',
      category: 'general',
      ai_difficulty_rating: 20,
      ai_estimated_duration: 15,
      ai_energy_level: 'low',
      ai_confidence: 90,
      reasoning: 'Your current chores are mostly high-difficulty, adding easy tasks can provide balance',
      suggested_frequency: 'daily',
      priority: 'low'
    });
  }

  if (avgDifficulty < 40) {
    suggestions.push({
      id: 'challenge-suggestion',
      title: 'Skill-Building Project',
      description: 'Consider a more challenging chore to develop new skills',
      category: 'maintenance',
      ai_difficulty_rating: 80,
      ai_estimated_duration: 180,
      ai_energy_level: 'high',
      ai_confidence: 85,
      reasoning: 'Adding challenging tasks can help develop new household skills',
      suggested_frequency: 'monthly',
      priority: 'medium'
    });
  }

  // Generate energy-level based suggestions
  if (energyDistribution.high > energyDistribution.low) {
    suggestions.push({
      id: 'low-energy-balance',
      title: 'Evening Relaxation Tasks',
      description: 'Add some low-energy evening chores for better balance',
      category: 'general',
      ai_difficulty_rating: 30,
      ai_estimated_duration: 20,
      ai_energy_level: 'low',
      ai_confidence: 80,
      reasoning: 'You have many high-energy tasks, adding low-energy evening tasks can provide balance',
      suggested_frequency: 'daily',
      priority: 'low'
    });
  }

  // Generate seasonal suggestions
  const currentMonth = now.getMonth();
  
  if (currentMonth >= 2 && currentMonth <= 4) { // Spring
    suggestions.push({
      id: 'spring-cleaning',
      title: 'Spring Cleaning',
      description: 'Perfect time for deep cleaning and organization',
      category: 'cleaning',
      ai_difficulty_rating: 70,
      ai_estimated_duration: 240,
      ai_energy_level: 'high',
      ai_confidence: 95,
      reasoning: 'Spring is ideal for comprehensive cleaning and organization',
      suggested_frequency: 'seasonal',
      priority: 'high'
    });
  }

  if (currentMonth >= 8 && currentMonth <= 10) { // Fall
    suggestions.push({
      id: 'fall-maintenance',
      title: 'Fall Home Maintenance',
      description: 'Prepare your home for winter with essential maintenance',
      category: 'maintenance',
      ai_difficulty_rating: 60,
      ai_estimated_duration: 120,
      ai_energy_level: 'medium',
      ai_confidence: 90,
      reasoning: 'Fall is the perfect time to prepare your home for winter',
      suggested_frequency: 'seasonal',
      priority: 'high'
    });
  }

  // Generate completion pattern-based suggestions
  if (completions.length > 0) {
    const recentCompletions = completions
      .filter(c => new Date(c.completed_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
      .length;

    if (recentCompletions < 3) {
      suggestions.push({
        id: 'motivation-boost',
        title: 'Quick Wins',
        description: 'Add some simple, satisfying tasks to boost motivation',
        category: 'general',
        ai_difficulty_rating: 25,
        ai_estimated_duration: 10,
        ai_energy_level: 'low',
        ai_confidence: 85,
        reasoning: 'Recent completion rate suggests adding simple tasks could boost motivation',
        suggested_frequency: 'daily',
        priority: 'low'
      });
    }
  }

  // Generate household harmony suggestions
  if (chores.length > 0) {
    const assignedChores = chores.filter(c => c.assigned_to).length;
    const unassignedChores = chores.length - assignedChores;

    if (unassignedChores > assignedChores * 0.3) {
      suggestions.push({
        id: 'assignment-optimization',
        title: 'Smart Assignment Review',
        description: 'Review and optimize chore assignments for better household harmony',
        category: 'organization',
        ai_difficulty_rating: 40,
        ai_estimated_duration: 30,
        ai_energy_level: 'low',
        ai_confidence: 90,
        reasoning: 'Many chores are unassigned, suggesting an opportunity to optimize distribution',
        suggested_frequency: 'weekly',
        priority: 'medium'
      });
    }
  }

  // Add AI confidence and metadata
  suggestions.forEach(suggestion => {
    suggestion.ai_suggested = true;
    suggestion.household_id = householdId;
    suggestion.created_at = now.toISOString();
    suggestion.updated_at = now.toISOString();
  });

  // Sort by AI confidence and priority
  return suggestions.sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (b.priority === 'high' && a.priority !== 'high') return 1;
    return b.ai_confidence - a.ai_confidence;
  });
}
