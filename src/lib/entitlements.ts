import { logger } from '@/lib/logging/logger';

/**
 * Entitlements system for MVP pricing structure
 * Manages feature access per household based on subscription tier
 */

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
  content: Record<string, any>;
  status: 'pending' | 'sent' | 'failed';
  error_message?: string;
  created_at: string;
}

/**
 * MVP Feature Gates
 * Maps feature names to required tier
 */
export const MVP_FEATURE_GATES = {
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
} as const;

export type FeatureName = keyof typeof MVP_FEATURE_GATES;

/**
 * Check if a household can access a specific feature
 */
export function canAccessFeature(entitlements: Entitlements, feature: FeatureName): boolean {
  if (!entitlements) {
    return false;
  }

  const requiredTier = MVP_FEATURE_GATES[feature];
  
  // Check basic tier access
  if (requiredTier === 'free') {
    return true;
  }
  
  if (requiredTier === 'pro' && entitlements.tier !== 'pro') {
    return false;
  }

  // Check specific entitlement flags for Pro features
  switch (feature) {
    case 'advanced_rrule':
      return entitlements.advanced_rrule === true;
    case 'conflict_detection':
      return entitlements.conflict_detection !== 'none';
    case 'calendar_templates':
      return entitlements.tier === 'pro';
    case 'google_import':
      return entitlements.google_import === true;
    case 'digest_max_per_day':
      return entitlements.digest_max_per_day > 0;
    case 'quiet_hours':
      return entitlements.quiet_hours === true;
    case 'history_months':
      return entitlements.history_months > 12;
    case 'meal_automation':
      return entitlements.tier === 'pro';
    default:
      return entitlements.tier === 'pro';
  }
}

/**
 * Check if a household can perform an action (quota check)
 */
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
        userId,
        householdId,
        route: '/entitlements/check'
      });
      return false;
    }
    
    const data = await response.json();
    return data.canPerform;
  } catch (error) {
    logger.error('Error checking quota', error as Error, {
      userId,
      householdId,
      route: '/entitlements/check'
    });
    return false;
  }
}

/**
 * Increment quota usage for a household
 */
export async function incrementQuotaUsage(householdId: string): Promise<void> {
  try {
    await fetch(`/api/entitlements/${householdId}/increment-quota`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error('Error incrementing quota', error as Error, {
      userId,
      householdId,
      route: '/entitlements/incrementQuota'
    });
  }
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const entitlementsCache = new Map<string, { data: Entitlements | null; expires: number }>();
const calendarTemplateCache = new Map<string, { data: CalendarTemplate[]; expires: number }>();
const quietHoursCache = new Map<string, { data: QuietHours | null; expires: number }>();

function isServer() {
  return typeof window === 'undefined';
}

async function safeFetch(input: RequestInfo, init?: RequestInit) {
  return fetch(input, init);
}

export async function getEntitlements(householdId: string): Promise<Entitlements | null> {
  if (isServer()) {
    return null;
  }
  const cached = getCache(entitlementsCache, householdId);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const response = await safeFetch(`/api/entitlements?householdId=${householdId}`);

    if (!response.ok) {
      logger.error('Error fetching entitlements', new Error(response.statusText), {
        householdId,
        route: '/entitlements'
      });
      setCache(entitlementsCache, householdId, null);
      return null;
    }

    const data = await response.json();
    setCache(entitlementsCache, householdId, data);
    return data;
  } catch (error) {
    logger.error('Error fetching entitlements', error as Error, {
      householdId,
      route: '/entitlements'
    });
    return null;
  }
}

export async function updateEntitlements(householdId: string, entitlements: Partial<Entitlements>): Promise<boolean> {
  try {
    const response = await fetch(`/api/entitlements?householdId=${householdId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entitlements),
    });

    if (!response.ok) {
      logger.error('Error updating entitlements', new Error(response.statusText), {
        householdId,
        route: '/entitlements'
      });
      return false;
    }

    entitlementsCache.delete(householdId);
    return true;
  } catch (error) {
    logger.error('Error updating entitlements', error as Error, {
      householdId,
      route: '/entitlements'
    });
    return false;
  }
}

/**
 * Update entitlements for a subscription change
 */
export async function updateEntitlementsForSubscription(
  householdId: string,
  tier: Tier,
  stripeSubscriptionId?: string
): Promise<void> {
  try {
    await fetch(`/api/entitlements/${householdId}/update-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tier,
        stripeSubscriptionId,
      }),
    });
  } catch (error) {
    logger.error('Error updating entitlements', error as Error, {
      householdId,
      route: '/entitlements/updateSubscription'
    });
    throw error;
  }
}

export async function getCalendarTemplates(householdId: string): Promise<CalendarTemplate[]> {
  if (isServer()) {
    return [];
  }
  const cached = getCache(calendarTemplateCache, householdId);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(`/api/calendar-templates?householdId=${householdId}`);

    if (!response.ok) {
      logger.error('Error fetching calendar templates', new Error(response.statusText), {
        householdId,
        route: '/calendar-templates'
      });
      return [];
    }

    const data = await response.json();
    setCache(calendarTemplateCache, householdId, data);
    return data;
  } catch (error) {
    logger.error('Error fetching calendar templates', error as Error, {
      householdId,
      route: '/calendar-templates'
    });
    return [];
  }
}

export async function getQuietHours(householdId: string): Promise<QuietHours | null> {
  if (isServer()) {
    return null;
  }
  const cached = getCache(quietHoursCache, householdId);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const response = await safeFetch(`/api/quiet-hours?householdId=${householdId}`);

    if (!response.ok) {
      logger.error('Error fetching quiet hours', new Error(response.statusText), {
        householdId,
        route: '/quiet-hours'
      });
      setCache(quietHoursCache, householdId, null);
      return null;
    }

    const data = await response.json();
    setCache(quietHoursCache, householdId, data);
    return data;
  } catch (error) {
    logger.error('Error fetching quiet hours', error as Error, {
      householdId,
      route: '/quiet-hours'
    });
    return null;
  }
}

export async function createQuietHours(householdId: string, quietHours: Partial<QuietHours>): Promise<boolean> {
  try {
    const response = await fetch(`/api/quiet-hours?householdId=${householdId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quietHours),
    });

    if (!response.ok) {
      logger.error('Error creating quiet hours', new Error(response.statusText), {
        householdId,
        route: '/quiet-hours'
      });
      return false;
    }

    quietHoursCache.delete(householdId);
    return true;
  } catch (error) {
    logger.error('Error creating quiet hours', error as Error, {
      householdId,
      route: '/quiet-hours'
    });
    return false;
  }
}

/**
 * Update quiet hours for a household
 */
export async function updateQuietHours(
  householdId: string,
  startTime: string,
  endTime: string
): Promise<void> {
  try {
    await fetch(`/api/quiet-hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        household_id: householdId,
        start_time: startTime,
        end_time: endTime,
      }),
    });
  } catch (error) {
    logger.error('Error updating quiet hours', error as Error, {
      householdId,
      route: '/updateQuietHours'
    });
    throw error;
  }
}

/**
 * Get calendar conflicts for a household
 */
export async function getCalendarConflicts(householdId: string): Promise<CalendarConflict[]> {
  try {
    const response = await fetch(`/api/calendar-conflicts?household_id=${householdId}`);
    
    if (!response.ok) {
      logger.error('Error fetching calendar conflicts', new Error(response.statusText), {
        householdId,
        route: '/calendarConflicts'
      });
      throw new Error(`Failed to fetch conflicts: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Error fetching calendar conflicts', error as Error, {
      householdId,
      route: '/calendarConflicts'
    });
    return [];
  }
}

/**
 * Resolve a calendar conflict
 */
export async function resolveCalendarConflict(
  conflictId: string,
  resolvedBy: string
): Promise<void> {
  try {
    await fetch(`/api/calendar-conflicts/${conflictId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resolved_by: resolvedBy,
      }),
    });
  } catch (error) {
    logger.error('Error resolving conflict', error as Error, {
      conflictId,
      route: '/resolveConflict'
    });
    throw error;
  }
}

/**
 * Get Google Calendar import status for a household
 */
export async function getGoogleCalendarImports(householdId: string): Promise<GoogleCalendarImport[]> {
  try {
    const response = await fetch(`/api/google-calendar-imports?household_id=${householdId}`);
    
    if (!response.ok) {
      logger.error('Error fetching Google Calendar imports', new Error(response.statusText), {
        householdId,
        route: '/googleCalendarImports'
      });
      throw new Error(`Failed to fetch imports: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Error fetching Google Calendar imports', error as Error, {
      householdId,
      route: '/googleCalendarImports'
    });
    return [];
  }
}

/**
 * Get daily digest status for a household
 */
export async function getDailyDigests(householdId: string): Promise<DailyDigest[]> {
  try {
    const response = await fetch(`/api/daily-digests?household_id=${householdId}`);
    
    if (!response.ok) {
      logger.error('Error fetching daily digests', new Error(response.statusText), {
        householdId,
        route: '/dailyDigests'
      });
      throw new Error(`Failed to fetch digests: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Error fetching daily digests', error as Error, {
      householdId,
      route: '/dailyDigests'
    });
    return [];
  }
}

/**
 * Check if current time is within quiet hours
 */
export function isWithinQuietHours(quietHours: QuietHours | null): boolean {
  if (!quietHours || !quietHours.is_active) {
    return false;
  }
  
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  const startTime = quietHours.start_time;
  const endTime = quietHours.end_time;
  
  // Handle overnight quiet hours (e.g., 22:00 to 06:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }
  
  // Handle same-day quiet hours (e.g., 09:00 to 17:00)
  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Get quota usage percentage
 */
export function getQuotaUsagePercentage(entitlements: Entitlements): number {
  return Math.round((entitlements.quota_actions_used / entitlements.quota_actions_per_month) * 100);
}

/**
 * Check if quota is near limit (80% or more)
 */
export function isQuotaNearLimit(entitlements: Entitlements): boolean {
  return getQuotaUsagePercentage(entitlements) >= 80;
}

/**
 * Check if quota is exceeded
 */
export function isQuotaExceeded(entitlements: Entitlements): boolean {
  return entitlements.quota_actions_used >= entitlements.quota_actions_per_month;
}
