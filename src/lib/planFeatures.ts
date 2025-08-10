// src/lib/planFeatures.ts

export const planFeatures: Record<string, string[]> = {
  free: ['basic_dashboard', 'shopping_list', 'meal_planner', 'collaborative_planner', 'chores', 'leaderboard'],
  premium: ['basic_dashboard', 'shopping_list', 'meal_planner', 'collaborative_planner', 'chores', 'calendar', 'xp_rewards', 'reminders', 'leaderboard'],
};

export function canAccessFeature(plan: string, feature: string): boolean {
  return planFeatures[plan]?.includes(feature) ?? false;
} 