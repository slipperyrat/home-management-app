import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logging/logger';
import type { TableRow, Database } from '@/types/supabase.generated';

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

    // Fetch calendar events for the household
    const { data: events, error: eventsError } = await supabase
      .from('household_events')
      .select('*')
      .eq('household_id', householdId)
      .order('start_time', { ascending: true });

    if (eventsError) {
      logger.error('Error fetching events', eventsError, { householdId, userId });
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Calculate AI insights
    const insights = calculateAICalendarInsights(events ?? []);

    return NextResponse.json({
      success: true,
      insights
    });

  } catch (error) {
    logger.error('Error in calendar insights API', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type CalendarEvent = TableRow<'household_events'>;

type CalendarInsightStats = {
  totalEvents: number;
  upcomingCount: number;
  mostCommonEventTypes: string[];
};

type CalendarInsights = {
  total_events: number;
  upcoming_events: number;
  conflicts_resolved: number;
  ai_suggestions_count: number;
  most_common_event_types: string[];
  optimal_scheduling_times: string[];
  household_patterns: string[];
  suggested_improvements: string[];
  ai_learning_progress: number;
  next_optimal_scheduling: string;
};

function calculateAICalendarInsights(events: CalendarEvent[]): CalendarInsights {
  const now = new Date();
  const eventsWithStartTime = events.filter(
    (event): event is CalendarEvent & { start_time: string } => typeof event.start_time === 'string'
  );
  const upcomingEvents = eventsWithStartTime.filter(event => new Date(event.start_time) > now);
  
  // Calculate basic stats
  const totalEvents = events.length;
  const upcomingCount = upcomingEvents.length;
  
  // Analyze event types
  const eventTypeCounts: Record<string, number> = {};
  events.forEach(event => {
    const type = event.type || 'unknown';
    eventTypeCounts[type] = (eventTypeCounts[type] || 0) + 1;
  });
  
  const mostCommonEventTypes = Object.entries(eventTypeCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([type]) => type);

  // Analyze scheduling patterns
  const timeSlots: Record<string, number> = {};
  eventsWithStartTime.forEach(event => {
    const hour = new Date(event.start_time).getHours();
    const timeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    timeSlots[timeSlot] = (timeSlots[timeSlot] || 0) + 1;
  });

  const optimalSchedulingTimes = Object.entries(timeSlots)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([time]) => time);

  // Detect patterns
  const householdPatterns: string[] = [];
  
  if (totalEvents >= 5) {
    if (mostCommonEventTypes.length > 0) {
      householdPatterns.push(`Frequently schedule ${mostCommonEventTypes[0]} events`);
    }
    
    if (optimalSchedulingTimes.length > 0) {
      householdPatterns.push(`Prefer ${optimalSchedulingTimes[0]} scheduling`);
    }
    
    if (upcomingCount > totalEvents * 0.3) {
      householdPatterns.push('Plan events well in advance');
    }
  }

  // Generate suggestions
  const suggestedImprovements = generateSuggestedImprovements({
    totalEvents,
    upcomingCount,
    mostCommonEventTypes
  });

  // Calculate AI learning progress (simplified)
  const aiLearningProgress = Math.min(100, Math.floor((totalEvents / 10) * 100));

  // Calculate conflicts resolved (simplified)
  const conflictsResolved = Math.floor(totalEvents * 0.1); // Assume 10% of events had conflicts

  // AI suggestions count
  const aiSuggestionsCount = events.filter(event => event.ai_suggested).length;

  return {
    total_events: totalEvents,
    upcoming_events: upcomingCount,
    conflicts_resolved: conflictsResolved,
    ai_suggestions_count: aiSuggestionsCount,
    most_common_event_types: mostCommonEventTypes,
    optimal_scheduling_times: optimalSchedulingTimes,
    household_patterns: householdPatterns,
    suggested_improvements: suggestedImprovements,
    ai_learning_progress: aiLearningProgress,
    next_optimal_scheduling: optimalSchedulingTimes[0] || 'morning'
  };
}

function generateSuggestedImprovements(stats: CalendarInsightStats): string[] {
  const suggestions: string[] = [];

  if (stats.totalEvents < 3) {
    suggestions.push('Schedule more events to help the AI learn your patterns');
  }

  if (stats.upcomingCount < stats.totalEvents * 0.2) {
    suggestions.push('Try scheduling events further in advance for better planning');
  }

  if (stats.mostCommonEventTypes.length < 2) {
    suggestions.push('Diversify your event types for better AI insights');
  }

  if (stats.totalEvents >= 5) {
    suggestions.push('Great! The AI is learning your scheduling preferences');
  }

  if (stats.totalEvents >= 10) {
    suggestions.push('Consider using AI templates for recurring events');
  }

  if (stats.totalEvents >= 20) {
    suggestions.push('Excellent! You can now use advanced AI scheduling features');
  }

  return suggestions;
}
