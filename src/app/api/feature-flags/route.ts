import { NextRequest, NextResponse } from "next/server";
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { createFeatureFlagContext } from "@/lib/middleware/featureFlags";
import { UserPlan } from "@/lib/server/canAccessFeature";

/**
 * GET /api/feature-flags
 * Returns feature flag status for the current user
 */
export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's plan from the request context or default to free
    const userPlan = (req.headers.get('x-user-plan') as UserPlan) || 'free';
    
    // Create feature flag context
    const context = createFeatureFlagContext(userPlan);
    
    return NextResponse.json({
      success: true,
      data: {
        userPlan: context.userPlan,
        availableFeatures: context.availableFeatures,
        featureFlags: context.featureFlags,
        timestamp: new Date().toISOString()
      }
    });
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

/**
 * POST /api/feature-flags/test
 * Test feature flag access for a specific feature
 */
export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = await req.json();
      const { feature, userPlan = 'free' } = body;

      if (!feature) {
        return NextResponse.json({ 
          error: "Feature name is required" 
        }, { status: 400 });
      }

      // Create feature flag context
      const context = createFeatureFlagContext(userPlan as UserPlan);
      
      // Check if feature is available
      const isEnabled = context.featureFlags[feature] || false;
      
      return NextResponse.json({
        success: true,
        data: {
          feature,
          enabled: isEnabled,
          userPlan: context.userPlan,
          availableFeatures: context.availableFeatures,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Feature flag test error:', error);
      return NextResponse.json({ 
        error: "Invalid request body" 
      }, { status: 400 });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

