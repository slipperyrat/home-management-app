import { createSupabaseAdminClient } from "./supabaseAdmin";
import { logger } from "@/lib/logging/logger";

type RawFeatureFlagsRow = {
  flag: string;
  enabled: boolean;
  rollout_percentage: number | null;
};

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
    const { data, error } = await supabase.from("feature_flags").select("flag, enabled, rollout_percentage");

    if (error) {
      logger.error("fetchFeatureFlags supabase error", error);
      return FALLBACK_FLAGS;
    }

    if (!data || data.length === 0) {
      return FALLBACK_FLAGS;
    }

    return transformFlags(data);
  } catch (error) {
    logger.error("fetchFeatureFlags unexpected error", error as Error);
    return FALLBACK_FLAGS;
  }
}

function transformFlags(rows: RawFeatureFlagsRow[]): FeatureFlagsResponse {
  const flags: Record<string, boolean> = {};
  const rollout: Record<string, number> = {};

  rows.forEach((row) => {
    flags[row.flag] = row.enabled;
    if (typeof row.rollout_percentage === "number") {
      rollout[row.flag] = row.rollout_percentage;
    }
  });

  return { flags, rollout };
}

