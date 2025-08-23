// Server-side feature gating utility
// This ensures features are properly gated at the API level

export type UserPlan = 'free' | 'premium' | 'pro';

export type FeatureKey = 
  | 'grocery_auto_gen'
  | 'leaderboard'
  | 'meal_planner'
  | 'advanced_analytics'
  | 'ai_insights'
  | 'automation_rules'
  | 'priority_support'
  | 'data_export'
  | 'recurring_chores'
  | 'calendar_sync';

// Feature access map - defines which plan is required for each feature
const featureAccessMap: Record<FeatureKey, UserPlan> = {
  // Free features
  leaderboard: 'free',
  meal_planner: 'free',
  
  // Premium features
  grocery_auto_gen: 'premium',
  recurring_chores: 'premium',
  calendar_sync: 'premium',
  data_export: 'premium',
  
  // Pro features
  advanced_analytics: 'pro',
  ai_insights: 'pro',
  automation_rules: 'pro',
  priority_support: 'pro',
};

/**
 * Check if a user can access a specific feature based on their plan
 * @param userPlan - The user's current plan
 * @param feature - The feature to check access for
 * @returns boolean indicating if access is allowed
 */
export function canAccessFeature(userPlan: UserPlan, feature: FeatureKey): boolean {
  const requiredPlan = featureAccessMap[feature];
  
  if (!requiredPlan) {
    console.warn(`Unknown feature: ${feature}, defaulting to free`);
    return true; // Default to allowing access for unknown features
  }
  
  // Free plan can access free features
  if (requiredPlan === 'free') {
    return true;
  }
  
  // Premium plan can access free and premium features
  if (requiredPlan === 'premium' && (userPlan === 'premium' || userPlan === 'pro')) {
    return true;
  }
  
  // Pro plan can access all features
  if (requiredPlan === 'pro' && userPlan === 'pro') {
    return true;
  }
  
  return false;
}

/**
 * Get all features available to a user based on their plan
 * @param userPlan - The user's current plan
 * @returns Array of available feature keys
 */
export function getAvailableFeatures(userPlan: UserPlan): FeatureKey[] {
  return Object.entries(featureAccessMap)
    .filter(([_, requiredPlan]) => canAccessFeature(userPlan, requiredPlan as FeatureKey))
    .map(([feature]) => feature as FeatureKey);
}

/**
 * Get features that require a plan upgrade
 * @param userPlan - The user's current plan
 * @returns Array of feature keys that require upgrade
 */
export function getUpgradeRequiredFeatures(userPlan: UserPlan): FeatureKey[] {
  return Object.entries(featureAccessMap)
    .filter(([_, requiredPlan]) => !canAccessFeature(userPlan, requiredPlan as FeatureKey))
    .map(([feature]) => feature as FeatureKey);
}

/**
 * Get the minimum plan required for a specific feature
 * @param feature - The feature to check
 * @returns The minimum plan required, or null if feature doesn't exist
 */
export function getRequiredPlanForFeature(feature: FeatureKey): UserPlan | null {
  return featureAccessMap[feature] || null;
}

/**
 * Validate that a user can access a feature and throw an error if not
 * Use this in API routes to enforce feature access
 * @param userPlan - The user's current plan
 * @param feature - The feature to check access for
 * @throws Error if access is denied
 */
export function requireFeatureAccess(userPlan: UserPlan, feature: FeatureKey): void {
  if (!canAccessFeature(userPlan, feature)) {
    const requiredPlan = getRequiredPlanForFeature(feature);
    throw new Error(
      `Feature "${feature}" requires ${requiredPlan} plan or higher. Current plan: ${userPlan}`
    );
  }
}
