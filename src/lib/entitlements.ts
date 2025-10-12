import { logger } from '@/lib/logging/logger';


export type Tier = 'free' | 'pro';

export interface Entitlements {
  household_id: string;
  tier: Tier;
  history_months: number;
  advanced_rrule: boolean;
  conflict_detection: 'none' | 'basic' | 'advanced';
  google_import: boolean;
  digest_max_per_day: number;
  quiet_hours: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quota_actions_per_month: number;
  quota_actions_used: number;
  quota_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarTemplate {
  id: string;
  household_id: string | null;
  name: string;
  description?: string;
  template_type: 'school_term' | 'sports_training' | 'custom';
  rrule: string;
  events: Array<{
    title: string;
    start: string;
    end: string;
    color: string;
    recurring?: boolean;
  }>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuietHours {
  id: string;
  household_id: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarConflict {
  id: string;
  household_id: string;
  event1_id: string;
  event2_id: string;
  conflict_type: 'same_time' | 'same_title' | 'overlap';
  severity: 'low' | 'medium' | 'high';
  is_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}

export interface GoogleCalendarImport {
  id: string;
  household_id: string;
  google_calendar_id: string;
  last_import_at?: string;
  last_successful_import_at?: string;
  import_count: number;
  error_count: number;
  last_error?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyDigest {
  id: string;
  household_id: string;
  digest_date: string;
  sent_at?: string;
  content: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  error_message?: string;
  created_at: string;
}

export const MVP_FEATURE_GATES = {
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
} as const;

export type FeatureName = keyof typeof MVP_FEATURE_GATES;

const CALENDAR_TEMPLATE_ROUTE = '/api/calendar-templates';
const CALENDAR_TEMPLATE_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

type CalendarTemplateCacheEntry = {
  expiresAt: number;
  data: CalendarTemplate[];
};

const calendarTemplateCache = new Map<string, CalendarTemplateCacheEntry>();

export function canAccessFeature(entitlements: Entitlements | null, feature: FeatureName): boolean {
  if (!entitlements) {
    return false;
  }

  const requiredTier = MVP_FEATURE_GATES[feature];

  if (requiredTier === 'free') {
    return true;
  }

  if (entitlements.tier !== 'pro') {
    return false;
  }

  switch (feature) {
    case 'advanced_rrule':
      return entitlements.advanced_rrule;
    case 'conflict_detection':
      return entitlements.conflict_detection !== 'none';
    case 'google_import':
      return entitlements.google_import;
    case 'digest_max_per_day':
      return entitlements.digest_max_per_day > 0;
    case 'quiet_hours':
      return entitlements.quiet_hours;
    case 'history_months':
      return entitlements.history_months > 12;
    default:
      return true;
  }
}

export async function canPerformAction(householdId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/entitlements/${householdId}/can-perform-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logger.error('Failed to check quota', new Error(response.statusText), {
        householdId,
        route: '/entitlements/check',
      });
      return false;
    }

    const data = (await response.json()) as { success: boolean };
    return data.success;
  } catch (error) {
    logger.error('Failed to check quota', error as Error, {
      householdId,
      route: '/entitlements/check',
    });
    return false;
  }
}

export async function getCalendarTemplates(
  householdId: string,
  options: { forceRefresh?: boolean; templateType?: CalendarTemplate['template_type'] | null } = {}
): Promise<CalendarTemplate[]> {
  const cacheKeyParts = [householdId];
  if (options.templateType) {
    cacheKeyParts.push(options.templateType);
  }
  const cacheKey = `calendar-templates:${cacheKeyParts.join(':')}`;
  const now = Date.now();
  const cached = calendarTemplateCache.get(cacheKey);

  if (!options.forceRefresh && cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
  const origin = typeof window !== 'undefined' ? window.location.origin : globalThis.__TEST_ORIGIN__ ?? 'http://localhost';
  const requestUrl = new URL(CALENDAR_TEMPLATE_ROUTE, origin);
  requestUrl.searchParams.set('household_id', householdId);
  if (options.templateType) {
    requestUrl.searchParams.set('template_type', options.templateType);
  }

  const response = await fetch(requestUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to load calendar templates: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as CalendarTemplate[];
    calendarTemplateCache.set(cacheKey, {
      data,
      expiresAt: now + CALENDAR_TEMPLATE_CACHE_TTL_MS,
    });

    return data;
  } catch (error) {
    calendarTemplateCache.delete(cacheKey);
    logger.error('Failed to load calendar templates', error as Error, {
      householdId,
      templateType: options.templateType,
      route: CALENDAR_TEMPLATE_ROUTE,
    });
    throw error;
  }
}

export const __testing = {
  calendarTemplateCache,
  CALENDAR_TEMPLATE_CACHE_TTL_MS,
};
