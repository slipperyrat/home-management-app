// Server-side feature gating utility for MVP pricing structure
// This ensures features are properly gated at the API level

export type UserPlan = 'free' | 'pro';

export type FeatureKey = 
  // Free features
  | 'basic_calendar'
  | 'basic_recurrence'
  | 'meal_planner_manual'
  | 'shopping_lists'
  | 'chores'
  | 'ics_export'
  | 'leaderboard'
  | 'basic_reminders'
  | 'templates_starter'
  | 'basic_analytics'
  
  // Pro features
  | 'advanced_rrule'
  | 'conflict_detection'
  | 'calendar_templates'
  | 'google_import'
  | 'digest_max_per_day'
  | 'quiet_hours'
  | 'history_months'
  | 'meal_automation'
  | 'advanced_analytics'
  | 'ai_insights'
  | 'automation_rules'
  | 'priority_support'
  | 'data_export'
  | 'projects'
  | 'budget_envelopes'
  | 'spending_tracking'
  | 'bill_management'
  | 'finance_analytics'
  | 'push_notifications'
  | 'enhanced_notifications'
  
  // Legacy features (mapped to MVP structure)
  | 'grocery_auto_gen'  // Maps to meal_automation
  | 'meal_planner'      // Maps to meal_planner_manual
  | 'calendar'          // Maps to basic_calendar
  | 'calendar_sync'     // Maps to google_import
  | 'finance_enabled'   // Maps to bill_management + budget_envelopes
  | 'notifications_minimal'  // Maps to digest_max_per_day
  | 'daily_digest'      // Maps to digest_max_per_day
  | 'ask_box_enabled'   // Maps to ai_insights
  | 'projects_beta'     // Maps to projects
  | 'brand_assets_v1'   // Maps to basic_calendar
  | 'onboarding_tour'   // Maps to basic_calendar
  | 'consent_optout'    // Maps to basic_calendar
  | 'google_calendar_read'  // Maps to google_import
  | 'google_calendar_sync'  // Maps to google_import (deferred)
  | 'availability_resolver' // Deferred to post-MVP
  | 'multi_household'   // Deferred to post-MVP
  | 'admin_tools'       // Deferred to post-MVP
  | 'unlimited_automations' // Deferred to post-MVP
  | 'unlimited_notifications'; // Deferred to post-MVP

// MVP Feature access map - defines which plan is required for each feature
const featureAccessMap: Record<FeatureKey, UserPlan> = {
  // Free features
  basic_calendar: 'free',
  basic_recurrence: 'free',
  meal_planner_manual: 'free',
  shopping_lists: 'free',
  chores: 'free',
  ics_export: 'free',
  leaderboard: 'free',
  basic_reminders: 'free',
  templates_starter: 'free',
  basic_analytics: 'free',
  
  // Pro features
  advanced_rrule: 'pro',
  conflict_detection: 'pro',
  calendar_templates: 'pro',
  google_import: 'pro',
  digest_max_per_day: 'pro',
  quiet_hours: 'pro',
  history_months: 'pro',
  meal_automation: 'pro',
  advanced_analytics: 'pro',
  ai_insights: 'pro',
  automation_rules: 'pro',
  priority_support: 'pro',
  data_export: 'pro',
  projects: 'pro',
  budget_envelopes: 'pro',
  spending_tracking: 'pro',
  bill_management: 'pro',
  finance_analytics: 'pro',
  push_notifications: 'pro',
  enhanced_notifications: 'pro',
  
  // Legacy feature mappings
  grocery_auto_gen: 'pro',        // Maps to meal_automation
  meal_planner: 'free',           // Maps to meal_planner_manual
  calendar: 'free',               // Maps to basic_calendar
  calendar_sync: 'pro',           // Maps to google_import
  finance_enabled: 'pro',         // Maps to bill_management + budget_envelopes
  notifications_minimal: 'pro',   // Maps to digest_max_per_day
  daily_digest: 'pro',            // Maps to digest_max_per_day
  ask_box_enabled: 'pro',         // Maps to ai_insights
  projects_beta: 'pro',           // Maps to projects
  brand_assets_v1: 'free',        // Maps to basic_calendar
  onboarding_tour: 'free',        // Maps to basic_calendar
  consent_optout: 'free',         // Maps to basic_calendar
  google_calendar_read: 'pro',    // Maps to google_import
  google_calendar_sync: 'pro',    // Maps to google_import (deferred)
  availability_resolver: 'pro',   // Deferred to post-MVP
  multi_household: 'pro',         // Deferred to post-MVP
  admin_tools: 'pro',             // Deferred to post-MVP
  unlimited_automations: 'pro',   // Deferred to post-MVP
  unlimited_notifications: 'pro', // Deferred to post-MVP
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
  
  // Pro plan can access free and pro features
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
 * Get Pro features that are available to Pro users
 * @returns Array of Pro feature keys
 */
export function getProFeatures(): FeatureKey[] {
  return Object.entries(featureAccessMap)
    .filter(([_, requiredPlan]) => requiredPlan === 'pro')
    .map(([feature]) => feature as FeatureKey);
}

/**
 * Get Free features that are available to all users
 * @returns Array of Free feature keys
 */
export function getFreeFeatures(): FeatureKey[] {
  return Object.entries(featureAccessMap)
    .filter(([_, requiredPlan]) => requiredPlan === 'free')
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

/**
 * Check if a user can access a feature based on entitlements (for use with database entitlements)
 * This is the new MVP way of checking feature access
 * @param entitlements - The user's entitlements from the database
 * @param feature - The feature to check access for
 * @returns boolean indicating if access is allowed
 */
export function canAccessFeatureFromEntitlements(entitlements: any, feature: FeatureKey): boolean {
  if (!entitlements) {
    return false;
  }

  const tier = entitlements.tier as UserPlan;
  
  // Check basic feature access
  if (!canAccessFeature(tier, feature)) {
    return false;
  }

  // Check specific entitlement flags for Pro features
  switch (feature) {
    case 'advanced_rrule':
      return entitlements.advanced_rrule === true;
    case 'conflict_detection':
      return entitlements.conflict_detection !== 'none';
    case 'calendar_templates':
      return entitlements.tier === 'pro'; // Pro feature
    case 'google_import':
      return entitlements.google_import === true;
    case 'digest_max_per_day':
    case 'daily_digest': // Legacy mapping
      return entitlements.digest_max_per_day > 0;
    case 'quiet_hours':
      return entitlements.quiet_hours === true;
    case 'history_months':
      return entitlements.history_months > 12;
    case 'meal_automation':
      return entitlements.tier === 'pro'; // Pro feature
    default:
      return canAccessFeature(tier, feature);
  }
}

/**
 * Check if user has quota available for an action
 * @param entitlements - The user's entitlements from the database
 * @returns boolean indicating if quota is available
 */
export function hasQuotaAvailable(entitlements: any): boolean {
  if (!entitlements) {
    return false;
  }

  // Check if quota has reset (new month)
  const today = new Date();
  const quotaResetDate = new Date(entitlements.quota_reset_date);
  
  if (today > quotaResetDate) {
    // Quota should be reset - this will be handled by the database function
    return true;
  }

  return entitlements.quota_actions_used < entitlements.quota_actions_per_month;
}
