import { createSupabaseAdminClient } from './supabaseAdmin';
import { logger } from '@/lib/logging/logger';

export type FeatureFlagsResponse = {
  flags: Record<string, boolean>;
  rollout: Record<string, number>;
};

const FALLBACK_FLAGS: FeatureFlagsResponse = {
  flags: {},
  rollout: {},
};

export async function fetchFeatureFlags(): Promise<FeatureFlagsResponse | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('household_plan_features')
      .select('feature_flags_enabled')
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('fetchFeatureFlags supabase error', error);
      return FALLBACK_FLAGS;
    }

    if (!data) {
      return FALLBACK_FLAGS;
    }

    return {
      flags: {
        feature_flags_enabled: Boolean((data as { feature_flags_enabled?: boolean }).feature_flags_enabled),
      },
      rollout: {},
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown feature flag error');
    logger.error('fetchFeatureFlags unexpected error', err);
    return FALLBACK_FLAGS;
  }
}

