// Feature flag middleware for API routes
// This middleware automatically checks feature flags and adds them to response headers

import { NextRequest, NextResponse } from 'next/server';
import { canAccessFeature, getAvailableFeatures, FeatureKey, UserPlan } from '@/lib/server/canAccessFeature';

export interface FeatureFlagContext {
  userPlan: UserPlan;
  availableFeatures: FeatureKey[];
  featureFlags: Record<string, boolean>;
}

/**
 * Create feature flag context for a user
 * @param userPlan - The user's current plan
 * @returns Feature flag context with available features and flags
 */
export function createFeatureFlagContext(userPlan: UserPlan): FeatureFlagContext {
  const availableFeatures = getAvailableFeatures(userPlan);
  
  // Create a map of all feature flags and their availability
  const featureFlags: Record<string, boolean> = {
    brand_assets_v1: canAccessFeature(userPlan, 'brand_assets_v1'),
    onboarding_tour: canAccessFeature(userPlan, 'onboarding_tour'),
    consent_optout: canAccessFeature(userPlan, 'consent_optout'),
    projects_beta: canAccessFeature(userPlan, 'projects_beta'),
    finance_enabled: canAccessFeature(userPlan, 'finance_enabled'),
    notifications_minimal: canAccessFeature(userPlan, 'notifications_minimal'),
    ask_box_enabled: canAccessFeature(userPlan, 'ask_box_enabled'),
    // Add other flags as needed
  };

  return {
    userPlan,
    availableFeatures,
    featureFlags,
  };
}

/**
 * Add feature flag headers to API response
 * @param response - The NextResponse object
 * @param context - Feature flag context
 * @returns Response with feature flag headers
 */
export function addFeatureFlagHeaders(response: NextResponse, context: FeatureFlagContext): NextResponse {
  // Add feature flag headers for debugging and client-side use
  response.headers.set('X-User-Plan', context.userPlan);
  response.headers.set('X-Available-Features', context.availableFeatures.join(','));
  
  // Add individual feature flag headers
  Object.entries(context.featureFlags).forEach(([flag, enabled]) => {
    response.headers.set(`X-Feature-${flag.replace(/_/g, '-').toUpperCase()}`, enabled.toString());
  });

  return response;
}

/**
 * Middleware wrapper for API routes that need feature flag context
 * @param handler - The API route handler function
 * @param requiredFeatures - Optional array of features that must be available
 * @returns Wrapped handler with feature flag context
 */
export function withFeatureFlags<T = any>(
  handler: (req: NextRequest, context: FeatureFlagContext) => Promise<NextResponse<T>>,
  requiredFeatures?: FeatureKey[]
) {
  return async (req: NextRequest, userPlan: UserPlan): Promise<NextResponse<T>> => {
    const context = createFeatureFlagContext(userPlan);
    
    // Check if user has access to required features
    if (requiredFeatures) {
      for (const feature of requiredFeatures) {
        if (!canAccessFeature(userPlan, feature)) {
          return NextResponse.json(
            { 
              error: `Feature "${feature}" is not available on your plan`,
              requiredPlan: context.userPlan,
              availableFeatures: context.availableFeatures
            },
            { status: 403 }
          );
        }
      }
    }

    // Call the handler with feature flag context
    const response = await handler(req, context);
    
    // Add feature flag headers to response
    return addFeatureFlagHeaders(response, context);
  };
}

/**
 * Check if a specific feature flag is enabled for a user
 * @param userPlan - The user's current plan
 * @param feature - The feature to check
 * @returns Boolean indicating if the feature is enabled
 */
export function isFeatureEnabled(userPlan: UserPlan, feature: FeatureKey): boolean {
  return canAccessFeature(userPlan, feature);
}

/**
 * Get all enabled feature flags for a user
 * @param userPlan - The user's current plan
 * @returns Object with feature flags and their enabled status
 */
export function getEnabledFeatures(userPlan: UserPlan): Record<string, boolean> {
  const context = createFeatureFlagContext(userPlan);
  return context.featureFlags;
}

/**
 * Feature flag constants for easy reference
 */
export const FEATURE_FLAGS = {
  // Roadmap Week 1 flags
  BRAND_ASSETS_V1: 'brand_assets_v1' as const,
  ONBOARDING_TOUR: 'onboarding_tour' as const,
  CONSENT_OPTOUT: 'consent_optout' as const,
  PROJECTS_BETA: 'projects_beta' as const,
  FINANCE_ENABLED: 'finance_enabled' as const,
  NOTIFICATIONS_MINIMAL: 'notifications_minimal' as const,
  ASK_BOX_ENABLED: 'ask_box_enabled' as const,
} as const;

