import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey);

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const householdId = userData.household_id;

    // Fetch existing events for conflict analysis
    const { data: events, error: eventsError } = await supabase
      .from('household_events')
      .select('*')
      .eq('household_id', householdId)
      .order('start_time', { ascending: true });

    if (eventsError) {
      logger.error('Error fetching events for scheduling suggestions', eventsError, { householdId, userId });
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Generate AI scheduling suggestions
    const suggestions = generateAISchedulingSuggestions(events || []);

    return NextResponse.json({
      success: true,
      suggestions
    });

  } catch (error) {
    logger.error('Error in scheduling suggestions API', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type HouseholdEvent = Database['public']['Tables']['household_events']['Row'];

type SchedulingSuggestion = {
  id: string;
  title: string;
  description: string;
  suggested_time: string;
  suggested_date: string;
  event_type: string;
  priority: 'low' | 'medium' | 'high';
  ai_confidence: number;
  reasoning: string;
};

function formatDate(date: Date): string {
  const iso = date.toISOString();
  const index = iso.indexOf('T');
  return index === -1 ? iso : iso.slice(0, index);
}

function generateAISchedulingSuggestions(events: HouseholdEvent[]): SchedulingSuggestion[] {
  const suggestions: SchedulingSuggestion[] = [];
  const now = new Date();

  // Analyze existing events for patterns
  const eventTypes = events.map((event) => event.event_type || 'general');
  const timeSlots = events.map((event) => {
    const start = event.start_time ? new Date(event.start_time) : null;
    const hour = start?.getHours();
    if (hour === undefined || Number.isNaN(hour)) {
      return 'morning';
    }
    return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  });

  // Find most common patterns
  const typeCounts: Record<string, number> = {};
  const timeCounts: Record<string, number> = {};

  eventTypes.forEach((type) => {
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  timeSlots.forEach((time) => {
    timeCounts[time] = (timeCounts[time] || 0) + 1;
  });

  const mostCommonTime = Object.entries(timeCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'morning';

  // Generate time-based suggestions
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Morning routine suggestion
  if (mostCommonTime === 'morning') {
    suggestions.push({
      id: 'morning-routine',
      title: 'Morning Routine Optimization',
      description: 'Based on your morning scheduling preference, consider creating a structured morning routine',
      suggested_time: '09:00',
      suggested_date: formatDate(nextWeek),
      event_type: 'routine',
      priority: 'medium',
      ai_confidence: 85,
      reasoning: 'You frequently schedule morning events, suggesting a preference for early productivity'
    });
  }

  // Weekly planning suggestion
  if (events.length >= 3) {
    suggestions.push({
      id: 'weekly-planning',
      title: 'Weekly Planning Session',
      description: 'Schedule a weekly planning session to organize your upcoming week',
      suggested_time: '18:00',
      suggested_date: formatDate(nextWeek),
      event_type: 'planning',
      priority: 'high',
      ai_confidence: 90,
      reasoning: 'Regular planning sessions can help optimize your scheduling patterns'
    });
  }

  // Conflict prevention suggestion
  if (events.length >= 5) {
    const conflictingEvents = findPotentialConflicts(events);
    if (conflictingEvents.length > 0) {
      suggestions.push({
        id: 'conflict-prevention',
        title: 'Schedule Buffer Time',
        description: 'Add buffer time between events to prevent scheduling conflicts',
        suggested_time: '15:00',
        suggested_date: formatDate(nextWeek),
        event_type: 'buffer',
        priority: 'medium',
        ai_confidence: 80,
        reasoning: 'Adding buffer time can help prevent scheduling conflicts and reduce stress'
      });
    }
  }

  // Personal time suggestion
  if (events.filter((event) => event.event_type === 'personal').length < 2) {
    suggestions.push({
      id: 'personal-time',
      title: 'Personal Time Block',
      description: 'Schedule dedicated personal time for self-care and relaxation',
      suggested_time: '20:00',
      suggested_date: formatDate(nextWeek),
      event_type: 'personal',
      priority: 'medium',
      ai_confidence: 75,
      reasoning: 'Balancing work and personal time is important for overall well-being'
    });
  }

  // Monthly review suggestion
  if (events.length >= 10) {
    suggestions.push({
      id: 'monthly-review',
      title: 'Monthly Schedule Review',
      description: 'Review your monthly schedule and identify optimization opportunities',
      suggested_time: '19:00',
      suggested_date: formatDate(nextMonth),
      event_type: 'review',
      priority: 'medium',
      ai_confidence: 85,
      reasoning: 'Regular schedule reviews help maintain optimal time management'
    });
  }

  // Default suggestions for new users
  if (events.length < 3) {
    suggestions.push({
      id: 'first-event',
      title: 'Schedule Your First Event',
      description: 'Start building your schedule by adding your first calendar event',
      suggested_time: '10:00',
      suggested_date: formatDate(now),
      event_type: 'general',
      priority: 'low',
      ai_confidence: 95,
      reasoning: 'Getting started with scheduling helps the AI learn your preferences'
    });
  }

  return suggestions;
}

type EventConflict = [HouseholdEvent, HouseholdEvent];

function findPotentialConflicts(events: HouseholdEvent[]): EventConflict[] {
  const conflicts: EventConflict[] = [];
  const toDateSafe = (iso: string | null) => (iso ? new Date(iso) : null);

  const sortedEvents = [...events].sort((a, b) => {
    const startA = toDateSafe(a.start_time)?.getTime() ?? 0;
    const startB = toDateSafe(b.start_time)?.getTime() ?? 0;
    return startA - startB;
  });

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const current = sortedEvents[i];
    const next = sortedEvents[i + 1];

    if (!current || !next) {
      continue;
    }

    const currentEnd = toDateSafe(current.end_time);
    const nextStart = toDateSafe(next.start_time);

    if (currentEnd && nextStart && currentEnd > nextStart) {
      conflicts.push([current, next]);
    }
  }

  return conflicts;
}
