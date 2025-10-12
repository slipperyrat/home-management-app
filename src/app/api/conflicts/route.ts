import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuth } from '@clerk/nextjs/server';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const GetConflictsSchema = z.object({
  household_id: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('household_id');
    
    if (!householdId) {
      return NextResponse.json({ error: 'household_id is required' }, { status: 400 });
    }

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 });
    }

    // First, run conflict detection to ensure we have current conflicts
    const { error: detectionError } = await supabase
      .rpc('upsert_calendar_conflicts', { p_household_id: householdId });
    
    if (detectionError) {
      console.error('Error running conflict detection:', detectionError);
      // Continue anyway - maybe there are existing conflicts
    }

    // Get conflicts for the household with event details
    const { data: conflicts, error: conflictsError } = await supabase
      .from('calendar_conflicts')
      .select('id, household_id, event1_id, event2_id, conflict_type, severity, is_resolved, created_at, resolved_at, resolved_by')
      .eq('household_id', householdId)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false });

    if (conflictsError) {
      console.error('Error fetching conflicts:', conflictsError);
      return NextResponse.json({ error: 'Failed to fetch conflicts' }, { status: 500 });
    }

    const eventIds = Array.from(new Set(
      (conflicts || []).flatMap(conflict => [conflict.event1_id, conflict.event2_id]).filter(Boolean)
    ));

    const eventMap = new Map<string, { id: string; title: string | null; start_at: string | null; end_at: string | null; attendee_user_id: string | null }>();

    if (eventIds.length > 0) {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_at, end_at, attendee_user_id')
        .in('id', eventIds);

      if (eventsError) {
        console.error('Error fetching conflict events:', eventsError);
        return NextResponse.json({ error: 'Failed to fetch conflicts' }, { status: 500 });
      }

      events?.forEach(event => {
        eventMap.set(event.id, {
          id: event.id,
          title: event.title ?? null,
          start_at: event.start_at ?? null,
          end_at: event.end_at ?? null,
          attendee_user_id: event.attendee_user_id ?? null,
        });
      });
    }

    // Get conflict statistics
    const { data: allConflicts, error: statsError } = await supabase
      .from('calendar_conflicts')
      .select('conflict_type, severity, is_resolved')
      .eq('household_id', householdId);

    if (statsError) {
      console.error('Error fetching conflict stats:', statsError);
      return NextResponse.json({ error: 'Failed to fetch conflict statistics' }, { status: 500 });
    }

    // Calculate statistics
    const totalConflicts = allConflicts?.length || 0;
    const unresolvedConflicts = allConflicts?.filter(c => !c.is_resolved).length || 0;
    const resolvedConflicts = allConflicts?.filter(c => c.is_resolved).length || 0;

    const conflictsByType = allConflicts?.reduce((acc, conflict) => {
      acc[conflict.conflict_type] = (acc[conflict.conflict_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const conflictsBySeverity = allConflicts?.reduce((acc, conflict) => {
      acc[conflict.severity] = (acc[conflict.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const stats = {
      totalConflicts,
      unresolvedConflicts,
      resolvedConflicts,
      conflictsByType,
      conflictsBySeverity
    };

    // Transform conflicts data
    const transformedConflicts = conflicts?.map(conflict => {
      const event1 = eventMap.get(conflict.event1_id) || null;
      const event2 = eventMap.get(conflict.event2_id) || null;

      return {
      id: conflict.id,
      household_id: conflict.household_id,
      event1_id: conflict.event1_id,
      event2_id: conflict.event2_id,
      conflict_type: conflict.conflict_type,
      severity: conflict.severity,
      description: getConflictDescription(
        conflict.conflict_type,
        event1,
        event2
      ),
      detected_at: conflict.created_at,
      resolved_at: conflict.is_resolved ? conflict.updated_at : null,
      resolution_notes: null,
      event1: event1 ? {
        id: event1.id,
        title: event1.title || 'Unknown Event',
        start_at: event1.start_at,
        end_at: event1.end_at,
        attendee_user_id: event1.attendee_user_id
      } : null,
      event2: event2 ? {
        id: event2.id,
        title: event2.title || 'Unknown Event',
        start_at: event2.start_at,
        end_at: event2.end_at,
        attendee_user_id: event2.attendee_user_id
      } : null
    };
    }) || [];

    return NextResponse.json({
      success: true,
      data: {
        conflicts: transformedConflicts,
        stats
      }
    });
  } catch (error) {
    console.error('Error in GET /api/conflicts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getConflictDescription(
  conflictType: string, 
  event1: any, 
  event2: any
): string {
  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString();
  };

  switch (conflictType) {
    case 'time_overlap':
      return `"${event1?.title || 'Event 1'}" and "${event2?.title || 'Event 2'}" have overlapping times (${formatTime(event1?.start_at)} - ${formatTime(event1?.end_at)} vs ${formatTime(event2?.start_at)} - ${formatTime(event2?.end_at)})`;
    case 'same_title':
      return `"${event1?.title || 'Event 1'}" and "${event2?.title || 'Event 2'}" have identical titles`;
    case 'exact_duplicate':
      return `"${event1?.title || 'Event 1'}" and "${event2?.title || 'Event 2'}" appear to be exact duplicates (same title, start, and end times)`;
    default:
      return `Conflict detected between "${event1?.title || 'Event 1'}" and "${event2?.title || 'Event 2'}"`;
  }
}