// src/lib/planFeatures.ts

export const planFeatures: Record<string, string[]> = {
  free: ['basic_dashboard', 'shopping_list', 'meal_planner', 'collaborative_planner', 'chores', 'leaderboard', 'calendar', 'basic_reminders', 'ics_export', 'basic_analytics'],
  pro: ['basic_dashboard', 'shopping_list', 'meal_planner', 'collaborative_planner', 'chores', 'calendar', 'xp_rewards', 'reminders', 'leaderboard', 'finance_enabled', 'bill_management', 'spending_tracking', 'budget_envelopes', 'advanced_analytics', 'ai_insights', 'push_notifications', 'google_calendar_read', 'data_export', 'projects', 'priority_support'],
  pro_plus: ['basic_dashboard', 'shopping_list', 'meal_planner', 'collaborative_planner', 'chores', 'calendar', 'xp_rewards', 'reminders', 'leaderboard', 'finance_enabled', 'bill_management', 'spending_tracking', 'budget_envelopes', 'advanced_analytics', 'ai_insights', 'push_notifications', 'google_calendar_read', 'data_export', 'projects', 'priority_support', 'google_calendar_sync', 'multi_household', 'admin_tools', 'unlimited_automations', 'unlimited_notifications', 'availability_resolver'],
};

export function canAccessFeature(plan: string, feature: string): boolean {
  return planFeatures[plan]?.includes(feature) ?? false;
} 