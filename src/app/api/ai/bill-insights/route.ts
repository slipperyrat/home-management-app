import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
    const { data: userHousehold, error: householdError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();

    if (householdError || !userHousehold) {
      return NextResponse.json({ error: 'No household found' }, { status: 400 });
    }

    const householdId = userHousehold.household_id;

    // Fetch bills for the household
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .eq('household_id', householdId)
      .order('due_date', { ascending: true });

    if (billsError) {
      logger.error('Error fetching bills', billsError, { householdId, userId });
      return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
    }

    // Calculate AI insights
    const insights = await calculateAIBillInsights(bills ?? [], householdId);

    return NextResponse.json({
      success: true,
      insights
    });

  } catch (error) {
    logger.error('Error in bill insights API', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type BillRecord = Database['public']['Tables']['bills']['Row'];

type BillInsightCategory = {
  category: string;
  amount: number;
  percentage: number;
};

type BillCategoryTotals = Record<string, number>;

type BillInsightResponse = {
  total_bills: number;
  monthly_spending: number;
  spending_trend: 'increasing' | 'decreasing' | 'stable';
  top_categories: BillInsightCategory[];
  upcoming_bills: number;
  overdue_risk: number;
  ai_recommendations: string[];
  spending_patterns: Array<{ month: string; amount: number }>;
};

async function calculateAIBillInsights(bills: BillRecord[], _householdId: string): Promise<BillInsightResponse> {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Basic statistics
  const totalBills = bills.length;
  const overdueBills = bills.filter(bill => bill.status === 'overdue');

  // Monthly spending calculation
  const monthlyBills = bills.filter(bill => {
    const billDate = new Date(bill.due_date);
    return billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear;
  });
  const monthlySpending = monthlyBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);

  // Previous month spending for trend analysis
  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const previousMonthBills = bills.filter(bill => {
    const billDate = new Date(bill.due_date);
    return billDate.getMonth() === previousMonth && billDate.getFullYear() === previousYear;
  });
  const previousMonthSpending = previousMonthBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);

  // Spending trend
  let spendingTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (monthlySpending > previousMonthSpending * 1.1) {
    spendingTrend = 'increasing';
  } else if (monthlySpending < previousMonthSpending * 0.9) {
    spendingTrend = 'decreasing';
  }

  // Category analysis
  const categoryTotals: BillCategoryTotals = {};
  bills.forEach((bill) => {
    const category = bill.category ?? 'other';
    const amount = bill.amount ?? 0;
    categoryTotals[category] = (categoryTotals[category] ?? 0) + amount;
  });

  const totalSpending = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
  const topCategories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Upcoming bills (due in next 30 days)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingBills = bills.filter(bill => {
    const dueDate = new Date(bill.due_date);
    return dueDate > now && dueDate <= thirtyDaysFromNow && bill.status !== 'paid';
  }).length;

  // Overdue risk calculation
  const overdueRisk = bills.length > 0 ? (overdueBills.length / bills.length) * 100 : 0;

  // AI recommendations
  const aiRecommendations = generateAIRecommendations(bills, spendingTrend, topCategories, overdueRisk);

  // Spending patterns (last 6 months)
  const spendingPatterns = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date(currentYear, currentMonth - i, 1);
    const monthBills = bills.filter(bill => {
      const billDate = new Date(bill.due_date);
      return billDate.getMonth() === month.getMonth() && billDate.getFullYear() === month.getFullYear();
    });
    const monthTotal = monthBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
    
    spendingPatterns.push({
      month: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      amount: monthTotal
    });
  }

  return {
    total_bills: totalBills,
    monthly_spending: monthlySpending,
    spending_trend: spendingTrend,
    top_categories: topCategories,
    upcoming_bills: upcomingBills,
    overdue_risk: Math.round(overdueRisk),
    ai_recommendations: aiRecommendations,
    spending_patterns: spendingPatterns
  };
}

function generateAIRecommendations(
  bills: BillRecord[],
  spendingTrend: 'increasing' | 'decreasing' | 'stable',
  topCategories: BillInsightCategory[],
  overdueRisk: number,
): string[] {
  const recommendations: string[] = [];

  // Spending trend recommendations
  if (spendingTrend === 'increasing') {
    recommendations.push('Your monthly spending is increasing. Consider reviewing recurring subscriptions and utilities.');
  } else if (spendingTrend === 'decreasing') {
    recommendations.push('Great job! Your spending is decreasing. Keep up the good financial habits.');
  }

  // Category-based recommendations
  if (topCategories.length > 0) {
    const topCategory = topCategories[0];
    if (topCategory && topCategory.percentage > 50) {
      recommendations.push(`${topCategory.category} represents over 50% of your spending. Consider if this is necessary.`);
    }
  }

  // Overdue risk recommendations
  if (overdueRisk > 20) {
    recommendations.push('You have a high risk of overdue bills. Set up automatic payments or reminders.');
  } else if (overdueRisk === 0) {
    recommendations.push('Excellent! All your bills are up to date. Consider setting up automatic payments for convenience.');
  }

  // General recommendations
  if (bills.length < 5) {
    recommendations.push('You have few bills. This is great for financial management!');
  } else if (bills.length > 15) {
    recommendations.push('You have many bills. Consider consolidating services to reduce complexity.');
  }

  // Seasonal recommendations
  const currentMonth = new Date().getMonth();
  if (currentMonth === 11 || currentMonth === 0) {
    recommendations.push('Holiday season often brings extra expenses. Plan ahead for January bills.');
  } else if (currentMonth === 6 || currentMonth === 7) {
    recommendations.push('Summer months may have higher utility bills. Monitor your energy usage.');
  }

  return recommendations.slice(0, 5); // Limit to 5 recommendations
}
