import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Types
export interface DigestPreferences {
  id: string;
  user_id: string;
  household_id: string;
  
  // Timing preferences
  daily_digest_enabled: boolean;
  daily_digest_time: string; // HH:MM format
  weekly_digest_enabled: boolean;
  weekly_digest_day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  weekly_digest_time: string; // HH:MM format
  
  // Content preferences
  include_chores: boolean;
  include_meals: boolean;
  include_shopping: boolean;
  include_events: boolean;
  include_achievements: boolean;
  include_insights: boolean;
  
  // Delivery preferences
  email_enabled: boolean;
  email_address?: string;
  push_enabled: boolean;
  
  // Advanced preferences
  priority_filter: 'all' | 'high' | 'medium_high'; // Only include high/medium+ priority items
  completion_status: 'all' | 'pending' | 'overdue'; // Include completed items or not
  
  created_at: string;
  updated_at: string;
}

export interface UpdateDigestPreferencesData {
  daily_digest_enabled: boolean;
  daily_digest_time: string;
  weekly_digest_enabled: boolean;
  weekly_digest_day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  weekly_digest_time: string;
  include_chores: boolean;
  include_meals: boolean;
  include_shopping: boolean;
  include_events: boolean;
  include_achievements: boolean;
  include_insights: boolean;
  email_enabled: boolean;
  email_address?: string;
  push_enabled: boolean;
  priority_filter: 'all' | 'high' | 'medium_high';
  completion_status: 'all' | 'pending' | 'overdue';
}

// Default preferences
export const DEFAULT_DIGEST_PREFERENCES: Partial<DigestPreferences> = {
  daily_digest_enabled: true,
  daily_digest_time: '08:00',
  weekly_digest_enabled: true,
  weekly_digest_day: 'sunday',
  weekly_digest_time: '09:00',
  include_chores: true,
  include_meals: true,
  include_shopping: true,
  include_events: true,
  include_achievements: true,
  include_insights: true,
  email_enabled: true,
  push_enabled: true,
  priority_filter: 'all',
  completion_status: 'all',
};

// API functions
const fetchDigestPreferences = async (): Promise<DigestPreferences> => {
  const response = await fetch('/api/digest/preferences');
  if (!response.ok) {
    throw new Error('Failed to fetch digest preferences');
  }
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch digest preferences');
  }
  
  return data.data;
};

const updateDigestPreferences = async (preferences: UpdateDigestPreferencesData): Promise<DigestPreferences> => {
  const response = await fetch('/api/digest/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update digest preferences');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to update digest preferences');
  }
  
  return data.data;
};

const sendTestDigest = async (type: 'daily' | 'weekly'): Promise<{ success: boolean; message: string }> => {
  const response = await fetch('/api/digest/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to send test digest');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to send test digest');
  }
  
  return data;
};

// Custom hooks
export function useDigestPreferences() {
  return useQuery({
    queryKey: ['digestPreferences'],
    queryFn: fetchDigestPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useUpdateDigestPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateDigestPreferences,
    onSuccess: (data) => {
      // Update the cache with the new preferences
      queryClient.setQueryData(['digestPreferences'], data);
      toast.success('Digest preferences updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update preferences: ${error.message}`);
    },
  });
}

export function useSendTestDigest() {
  return useMutation({
    mutationFn: sendTestDigest,
    onSuccess: (data) => {
      toast.success(data.message || 'Test digest sent successfully');
    },
    onError: (error) => {
      toast.error(`Failed to send test digest: ${error.message}`);
    },
  });
}

// Utility functions
export function formatDigestTime(time: string | undefined): string {
  try {
    if (!time) return '';
    const [hoursRaw, minutesRaw] = time.split(':');
    const hour = Number.parseInt(hoursRaw ?? '0', 10);
    const minutes = minutesRaw ?? '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return time ?? '';
  }
}

export function getNextDigestTime(preferences: DigestPreferences): { type: 'daily' | 'weekly'; time: Date } | null {
  const now = new Date();
  const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate next daily digest time
  const dailyTime = new Date();
  const [dailyHourRaw, dailyMinuteRaw] = (preferences.daily_digest_time ?? '').split(':').map(Number);
  const dailyHour = Number.isFinite(dailyHourRaw) ? dailyHourRaw : 0;
  const dailyMinute = Number.isFinite(dailyMinuteRaw) ? dailyMinuteRaw : 0;
  dailyTime.setHours(dailyHour ?? 0, dailyMinute ?? 0, 0, 0);
  
  // If daily time has passed today, move to tomorrow
  if (dailyTime <= now) {
    dailyTime.setDate(dailyTime.getDate() + 1);
  }
  
  // Calculate next weekly digest time
  const weeklyTime = new Date();
  const [weeklyHourRaw, weeklyMinuteRaw] = (preferences.weekly_digest_time ?? '').split(':').map(Number);
  const weeklyHour = Number.isFinite(weeklyHourRaw) ? weeklyHourRaw : 0;
  const weeklyMinute = Number.isFinite(weeklyMinuteRaw) ? weeklyMinuteRaw : 0;
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weeklyDayIndex = dayNames.indexOf(preferences.weekly_digest_day ?? '');
  
  weeklyTime.setHours(weeklyHour ?? 0, weeklyMinute ?? 0, 0, 0);
  
  // Find next occurrence of the weekly digest day
  const validWeeklyDayIndex = weeklyDayIndex >= 0 ? weeklyDayIndex : today;
  const daysUntilWeekly = (validWeeklyDayIndex - today + 7) % 7;
  if (daysUntilWeekly === 0 && weeklyTime <= now) {
    // If it's today but time has passed, move to next week
    weeklyTime.setDate(weeklyTime.getDate() + 7);
  } else {
    weeklyTime.setDate(weeklyTime.getDate() + daysUntilWeekly);
  }
  
  // Determine which is next
  if (!preferences.daily_digest_enabled && !preferences.weekly_digest_enabled) {
    return null;
  } else if (!preferences.daily_digest_enabled) {
    return { type: 'weekly', time: weeklyTime };
  } else if (!preferences.weekly_digest_enabled) {
    return { type: 'daily', time: dailyTime };
  } else {
    return dailyTime <= weeklyTime 
      ? { type: 'daily', time: dailyTime }
      : { type: 'weekly', time: weeklyTime };
  }
}
