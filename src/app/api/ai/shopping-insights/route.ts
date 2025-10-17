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
      .eq('clerk_id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const householdId = userData.household_id;

    // Calculate AI shopping insights
    const insights = await calculateAIShoppingInsights(householdId);

    return NextResponse.json({
      success: true,
      insights
    });

  } catch (error) {
    logger.error('Error fetching AI shopping insights', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to fetch shopping insights' },
      { status: 500 }
    );
  }
}

type ShoppingList = Database['public']['Tables']['shopping_lists']['Row'] & {
  shopping_items?: Array<Database['public']['Tables']['shopping_items']['Row']>;
};

type ShoppingFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

type ShoppingInsights = {
  total_lists: number;
  completed_lists: number;
  average_items_per_list: number;
  most_common_categories: string[];
  shopping_frequency: ShoppingFrequency;
  suggested_improvements: string[];
  ai_learning_progress: number;
  next_shopping_prediction: string;
};

async function calculateAIShoppingInsights(householdId: string): Promise<ShoppingInsights> {
  try {
    // Get all shopping lists for the household
    const { data: shoppingLists, error: listsError } = await supabase
      .from('shopping_lists')
      .select(`
        *,
        shopping_items (
          id,
          name,
          category,
          completed,
          created_at
        )
      `)
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (listsError) {
      logger.error('Error fetching shopping lists for insights', listsError, { householdId });
      return getDefaultInsights();
    }

    if (!shoppingLists || shoppingLists.length === 0) {
      return getDefaultInsights();
    }

    // Calculate insights
    const totalLists = shoppingLists.length;
    const completedLists = shoppingLists.filter(list => list.is_completed).length;
    
    // Calculate average items per list
    const totalItems = shoppingLists.reduce((sum, list) => {
      return sum + (list.shopping_items?.length || 0);
    }, 0);
    const averageItemsPerList = totalItems > 0 ? Math.round(totalItems / totalLists) : 0;

    // Analyze shopping frequency
    const shoppingFrequency = analyzeShoppingFrequency(shoppingLists as ShoppingList[]);

    // Get most common categories
    const mostCommonCategories = getMostCommonCategories(shoppingLists as ShoppingList[]);

    // Calculate AI learning progress
    const aiLearningProgress = calculateAILearningProgress(shoppingLists as ShoppingList[]);

    // Generate next shopping prediction
    const nextShoppingPrediction = predictNextShopping(shoppingLists as ShoppingList[]);

    // Generate suggested improvements
    const suggestedImprovements = generateSuggestedImprovements(shoppingLists as ShoppingList[], {
      totalLists,
      completedLists,
      averageItemsPerList,
      shoppingFrequency
    });

    return {
      total_lists: totalLists,
      completed_lists: completedLists,
      average_items_per_list: averageItemsPerList,
      most_common_categories: mostCommonCategories,
      shopping_frequency: shoppingFrequency,
      suggested_improvements: suggestedImprovements,
      ai_learning_progress: aiLearningProgress,
      next_shopping_prediction: nextShoppingPrediction
    };

  } catch (error) {
    logger.error('Error calculating AI shopping insights', error instanceof Error ? error : new Error(String(error)), {
      householdId,
    });
    return getDefaultInsights();
  }
}

function analyzeShoppingFrequency(shoppingLists: ShoppingList[]): ShoppingFrequency {
  if (shoppingLists.length < 2) return 'weekly';

  // Sort by creation date
  const sortedLists = shoppingLists
    .filter((list) => list.created_at)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  if (sortedLists.length < 2) return 'weekly';

  // Calculate average days between lists
  let totalDays = 0;
  let count = 0;

  for (let i = 0; i < sortedLists.length - 1; i++) {
    const currentCreatedAt = sortedLists[i]?.created_at;
    const nextCreatedAt = sortedLists[i + 1]?.created_at;

    if (!currentCreatedAt || !nextCreatedAt) {
      continue;
    }

    const currentDate = new Date(currentCreatedAt);
    const nextDate = new Date(nextCreatedAt);
    const daysDiff = Math.abs(currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24);
    totalDays += daysDiff;
    count++;
  }

  if (count === 0) return 'weekly';

  const averageDays = totalDays / count;

  if (averageDays <= 2) return 'daily';
  if (averageDays <= 7) return 'weekly';
  if (averageDays <= 14) return 'biweekly';
  return 'monthly';
}

function getMostCommonCategories(shoppingLists: ShoppingList[]): string[] {
  const categoryCounts: { [key: string]: number } = {};

  shoppingLists.forEach((list) => {
    if (list.shopping_items) {
      list.shopping_items.forEach((item) => {
        if (item.category) {
          categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
        }
      });
    }
  });

  return Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category]) => category);
}

function calculateAILearningProgress(shoppingLists: ShoppingList[]): number {
  if (shoppingLists.length === 0) return 0;

  // Base progress on number of lists and completion rate
  const totalLists = shoppingLists.length;
  const completedLists = shoppingLists.filter(list => list.is_completed).length;
  const completionRate = completedLists / totalLists;

  // Calculate complexity score based on items and categories
  let complexityScore = 0;
  const uniqueCategories = new Set<string>();

  shoppingLists.forEach((list) => {
    if (list.shopping_items) {
      complexityScore += list.shopping_items.length;
      list.shopping_items.forEach((item) => {
        if (item.category) {
          uniqueCategories.add(item.category);
        }
      });
    }
  });

  const averageComplexity = complexityScore / totalLists;
  const categoryDiversity = uniqueCategories.size;

  // Calculate learning progress (0-100)
  const progress = Math.min(100, 
    (totalLists * 10) + // Base progress from list count
    (completionRate * 20) + // Progress from completion rate
    (Math.min(averageComplexity, 10) * 3) + // Progress from complexity
    (Math.min(categoryDiversity, 10) * 2) // Progress from category diversity
  );

  return Math.round(progress);
}

function predictNextShopping(shoppingLists: ShoppingList[]): string {
  const sortedLists = shoppingLists
    .filter(list => list.created_at)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  if (sortedLists.length === 0) return 'This week';

  const latestCreatedAt = sortedLists[0]?.created_at;
  if (!latestCreatedAt) {
    return 'This week';
  }

  const lastShoppingDate = new Date(latestCreatedAt);
  const now = new Date();
  const daysSinceLastShopping = Math.floor((now.getTime() - lastShoppingDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceLastShopping <= 2) return 'In the next few days';
  if (daysSinceLastShopping <= 7) return 'This week';
  if (daysSinceLastShopping <= 14) return 'Next week';
  return 'In the next few weeks';
}

type ShoppingStats = {
  totalLists: number;
  completedLists: number;
  averageItemsPerList: number;
  shoppingFrequency: ShoppingFrequency;
};

function generateSuggestedImprovements(_shoppingLists: ShoppingList[], stats: ShoppingStats): string[] {
  const suggestions: string[] = [];

  if (stats.totalLists < 3) {
    suggestions.push('Create more shopping lists to help the AI learn your patterns');
  }

  if (stats.completedLists < stats.totalLists * 0.7) {
    suggestions.push('Complete more shopping lists to improve AI accuracy');
  }

  if (stats.averageItemsPerList < 5) {
    suggestions.push('Add more items to your lists for better AI suggestions');
  }

  if (stats.shoppingFrequency === 'monthly') {
    suggestions.push('Consider shopping more frequently to maintain fresh AI insights');
  }

  if (stats.totalLists >= 5) {
    suggestions.push('Great progress! The AI is learning your shopping habits well');
  }

  if (stats.totalLists >= 10) {
    suggestions.push('Excellent! Consider using AI templates for common shopping trips');
  }

  return suggestions;
}

function getDefaultInsights() {
  return {
    total_lists: 0,
    completed_lists: 0,
    average_items_per_list: 0,
    most_common_categories: [],
    shopping_frequency: 'weekly' as const,
    suggested_improvements: ['Create your first shopping list to get started'],
    ai_learning_progress: 0,
    next_shopping_prediction: 'This week'
  };
}
