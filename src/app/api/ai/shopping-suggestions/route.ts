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

    // Get AI-powered shopping suggestions
    const suggestions = await generateAIShoppingSuggestions(householdId);

    return NextResponse.json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('Error fetching AI shopping suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shopping suggestions' },
      { status: 500 }
    );
  }
}

async function generateAIShoppingSuggestions(householdId: string) {
  try {
    // Get shopping history
    const { data: shoppingHistory, error: historyError } = await supabase
      .from('shopping_items')
      .select(`
        *,
        shopping_lists!inner (
          household_id,
          created_at
        )
      `)
      .eq('shopping_lists.household_id', householdId)
      .order('created_at', { ascending: false });

    if (historyError) {
      console.error('Error fetching shopping history:', historyError);
      return getDefaultSuggestions();
    }

    if (!shoppingHistory || shoppingHistory.length === 0) {
      return getDefaultSuggestions();
    }

    // Analyze patterns and generate suggestions
    const suggestions = await analyzeShoppingPatterns(shoppingHistory);

    return suggestions;

  } catch (error) {
    console.error('Error generating AI shopping suggestions:', error);
    return getDefaultSuggestions();
  }
}

async function analyzeShoppingPatterns(shoppingHistory: any[]) {
  const suggestions: any[] = [];

  // Analyze frequently bought items
  const itemFrequency: { [key: string]: number } = {};
  const categoryFrequency: { [key: string]: number } = {};

  shoppingHistory.forEach(item => {
    // Count item frequency
    const itemKey = item.name.toLowerCase().trim();
    itemFrequency[itemKey] = (itemFrequency[itemKey] || 0) + 1;

    // Count category frequency
    if (item.category) {
      categoryFrequency[item.category] = (categoryFrequency[item.category] || 0) + 1;
    }
  });

  // Get top frequently bought items
  const topItems = Object.entries(itemFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([itemName, count]) => ({
      name: itemName,
      frequency: count,
      confidence: Math.min(95, 50 + (count * 5)) // Higher frequency = higher confidence
    }));

  // Get top categories
  const topCategories = Object.entries(categoryFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, count]) => ({
      name: category,
      frequency: count,
      confidence: Math.min(90, 60 + (count * 3))
    }));

  // Generate smart suggestions
  suggestions.push({
    type: 'frequently_bought',
    title: 'Frequently Bought Items',
    description: 'Items you buy regularly based on your shopping history',
    items: topItems.slice(0, 5),
    confidence: Math.min(90, 70 + (topItems.length * 2)),
    priority: 'high'
  });

  suggestions.push({
    type: 'category_based',
    title: 'Category Recommendations',
    description: 'Product categories you shop for most often',
    categories: topCategories,
    confidence: Math.min(85, 65 + (topCategories.length * 2)),
    priority: 'medium'
  });

  // Generate seasonal suggestions if applicable
  const seasonalSuggestions = generateSeasonalSuggestions();
  if (seasonalSuggestions.length > 0) {
    suggestions.push({
      type: 'seasonal',
      title: 'Seasonal Suggestions',
      description: 'Items that might be useful for the current season',
      items: seasonalSuggestions,
      confidence: 75,
      priority: 'medium'
    });
  }

  // Generate smart templates
  const smartTemplates = generateSmartTemplates(shoppingHistory);
  if (smartTemplates.length > 0) {
    suggestions.push({
      type: 'smart_templates',
      title: 'Smart Shopping Templates',
      description: 'Pre-made lists based on your shopping patterns',
      templates: smartTemplates,
      confidence: 80,
      priority: 'high'
    });
  }

  return suggestions;
}

function generateSeasonalSuggestions() {
  const currentMonth = new Date().getMonth();
  const suggestions: any[] = [];

  // Spring (March-May)
  if (currentMonth >= 2 && currentMonth <= 4) {
    suggestions.push(
      { name: 'Spring cleaning supplies', category: 'Household', confidence: 75 },
      { name: 'Garden supplies', category: 'Outdoor', confidence: 70 },
      { name: 'Light clothing', category: 'Clothing', confidence: 65 }
    );
  }
  // Summer (June-August)
  else if (currentMonth >= 5 && currentMonth <= 7) {
    suggestions.push(
      { name: 'BBQ supplies', category: 'Outdoor', confidence: 80 },
      { name: 'Beach items', category: 'Recreation', confidence: 75 },
      { name: 'Summer drinks', category: 'Beverages', confidence: 70 }
    );
  }
  // Fall (September-November)
  else if (currentMonth >= 8 && currentMonth <= 10) {
    suggestions.push(
      { name: 'Fall decorations', category: 'Home', confidence: 75 },
      { name: 'Warm clothing', category: 'Clothing', confidence: 70 },
      { name: 'Pumpkin spice items', category: 'Food', confidence: 65 }
    );
  }
  // Winter (December-February)
  else {
    suggestions.push(
      { name: 'Winter clothing', category: 'Clothing', confidence: 80 },
      { name: 'Holiday decorations', category: 'Home', confidence: 75 },
      { name: 'Hot beverages', category: 'Beverages', confidence: 70 }
    );
  }

  return suggestions;
}

function generateSmartTemplates(shoppingHistory: any[]) {
  const templates: any[] = [];

  // Analyze if user has weekly grocery patterns
  const groceryItems = shoppingHistory.filter(item => 
    ['Food', 'Beverages', 'Dairy', 'Produce'].includes(item.category)
  );

  if (groceryItems.length >= 10) {
    templates.push({
      name: 'Weekly Groceries',
      description: 'Essential grocery items for weekly shopping',
      items: [
        { name: 'Milk', category: 'Dairy', confidence: 85 },
        { name: 'Bread', category: 'Food', confidence: 80 },
        { name: 'Eggs', category: 'Dairy', confidence: 80 },
        { name: 'Fruits', category: 'Produce', confidence: 75 },
        { name: 'Vegetables', category: 'Produce', confidence: 75 }
      ],
      estimated_cost: '$50-80',
      frequency: 'weekly'
    });
  }

  // Analyze if user has household supplies patterns
  const householdItems = shoppingHistory.filter(item => 
    ['Household', 'Cleaning', 'Personal Care'].includes(item.category)
  );

  if (householdItems.length >= 5) {
    templates.push({
      name: 'Household Essentials',
      description: 'Common household items that need regular replenishment',
      items: [
        { name: 'Toilet paper', category: 'Household', confidence: 90 },
        { name: 'Paper towels', category: 'Household', confidence: 85 },
        { name: 'Dish soap', category: 'Cleaning', confidence: 80 },
        { name: 'Laundry detergent', category: 'Cleaning', confidence: 80 },
        { name: 'Trash bags', category: 'Household', confidence: 75 }
      ],
      estimated_cost: '$30-50',
      frequency: 'biweekly'
    });
  }

  return templates;
}

function getDefaultSuggestions() {
  return [
    {
      type: 'getting_started',
      title: 'Getting Started',
      description: 'Basic suggestions to help you begin',
      items: [
        { name: 'Milk', category: 'Dairy', confidence: 60 },
        { name: 'Bread', category: 'Food', confidence: 60 },
        { name: 'Eggs', category: 'Dairy', confidence: 55 }
      ],
      confidence: 60,
      priority: 'medium'
    }
  ];
}
