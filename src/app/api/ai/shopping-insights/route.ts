import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    console.error('Error fetching AI shopping insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shopping insights' },
      { status: 500 }
    );
  }
}

async function calculateAIShoppingInsights(householdId: string) {
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
      console.error('Error fetching shopping lists:', listsError);
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
    const shoppingFrequency = analyzeShoppingFrequency(shoppingLists);

    // Get most common categories
    const mostCommonCategories = getMostCommonCategories(shoppingLists);

    // Calculate AI learning progress
    const aiLearningProgress = calculateAILearningProgress(shoppingLists);

    // Generate next shopping prediction
    const nextShoppingPrediction = predictNextShopping(shoppingLists);

    // Generate suggested improvements
    const suggestedImprovements = generateSuggestedImprovements(shoppingLists, {
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
    console.error('Error calculating AI shopping insights:', error);
    return getDefaultInsights();
  }
}

function analyzeShoppingFrequency(shoppingLists: any[]): 'daily' | 'weekly' | 'biweekly' | 'monthly' {
  if (shoppingLists.length < 2) return 'weekly';

  // Sort by creation date
  const sortedLists = shoppingLists
    .filter(list => list.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (sortedLists.length < 2) return 'weekly';

  // Calculate average days between lists
  let totalDays = 0;
  let count = 0;

  for (let i = 0; i < sortedLists.length - 1; i++) {
    const currentDate = new Date(sortedLists[i].created_at);
    const nextDate = new Date(sortedLists[i + 1].created_at);
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

function getMostCommonCategories(shoppingLists: any[]): string[] {
  const categoryCounts: { [key: string]: number } = {};

  shoppingLists.forEach(list => {
    if (list.shopping_items) {
      list.shopping_items.forEach((item: any) => {
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

function calculateAILearningProgress(shoppingLists: any[]): number {
  if (shoppingLists.length === 0) return 0;

  // Base progress on number of lists and completion rate
  const totalLists = shoppingLists.length;
  const completedLists = shoppingLists.filter(list => list.is_completed).length;
  const completionRate = completedLists / totalLists;

  // Calculate complexity score based on items and categories
  let complexityScore = 0;
  const uniqueCategories = new Set<string>();

  shoppingLists.forEach(list => {
    if (list.shopping_items) {
      complexityScore += list.shopping_items.length;
      list.shopping_items.forEach((item: any) => {
        if (item.category) {
          uniqueCategories.add(item.category);
        }
      });
    }
  });

  const averageComplexity = complexityScore / totalLists;
  const categoryDiversity = uniqueCategories.size;

  // Calculate learning progress (0-100)
  let progress = Math.min(100, 
    (totalLists * 10) + // Base progress from list count
    (completionRate * 20) + // Progress from completion rate
    (Math.min(averageComplexity, 10) * 3) + // Progress from complexity
    (Math.min(categoryDiversity, 10) * 2) // Progress from category diversity
  );

  return Math.round(progress);
}

function predictNextShopping(shoppingLists: any[]): string {
  if (shoppingLists.length === 0) return 'This week';

  const sortedLists = shoppingLists
    .filter(list => list.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (sortedLists.length === 0) return 'This week';

  const lastShoppingDate = new Date(sortedLists[0].created_at);
  const now = new Date();
  const daysSinceLastShopping = Math.floor((now.getTime() - lastShoppingDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceLastShopping <= 2) return 'In the next few days';
  if (daysSinceLastShopping <= 7) return 'This week';
  if (daysSinceLastShopping <= 14) return 'Next week';
  return 'In the next few weeks';
}

function generateSuggestedImprovements(shoppingLists: any[], stats: any): string[] {
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
