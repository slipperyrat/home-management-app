import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export interface CalendarConflict {
  id: string;
  household_id: string;
  event1_id: string;
  event2_id: string;
  conflict_type: 'time_overlap' | 'same_title' | 'same_time';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected_at: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: CalendarConflict[];
  newConflicts: CalendarConflict[];
  resolvedConflicts: string[];
}

export interface EventData {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  household_id: string;
}

export class ConflictDetectionService {
  /**
   * Detect conflicts for a specific event
   */
  static async detectConflictsForEvent(
    eventId: string,
    householdId: string,
    eventData: EventData
  ): Promise<ConflictDetectionResult> {
    try {
      // Get all other events in the same household
      const { data: otherEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_at, end_at, is_all_day')
        .eq('household_id', householdId)
        .neq('id', eventId);

      if (eventsError) {
        console.error('Error fetching events for conflict detection:', eventsError);
        return { hasConflicts: false, conflicts: [], newConflicts: [], resolvedConflicts: [] };
      }

      const conflicts: CalendarConflict[] = [];
      const newConflicts: CalendarConflict[] = [];

      // Check for conflicts with each other event
      for (const otherEvent of otherEvents || []) {
        const conflict = await this.checkEventConflict(eventData, otherEvent, householdId);
        if (conflict) {
          conflicts.push(conflict);
          
          // Check if this is a new conflict
          const existingConflict = await this.getExistingConflict(
            eventId,
            otherEvent.id,
            householdId
          );
          
          if (!existingConflict) {
            newConflicts.push(conflict);
          }
        }
      }

      // Get existing conflicts for this event
      const { data: existingConflicts } = await supabase
        .from('calendar_conflicts')
        .select('*')
        .eq('household_id', householdId)
        .or(`event1_id.eq.${eventId},event2_id.eq.${eventId}`)
        .is('resolved_at', null);

      // Find resolved conflicts
      const resolvedConflicts: string[] = [];
      for (const existing of existingConflicts || []) {
        const stillConflicts = conflicts.some(conflict => 
          (conflict.event1_id === existing.event1_id && conflict.event2_id === existing.event2_id) ||
          (conflict.event1_id === existing.event2_id && conflict.event2_id === existing.event1_id)
        );
        
        if (!stillConflicts) {
          resolvedConflicts.push(existing.id);
        }
      }

      // Mark resolved conflicts
      if (resolvedConflicts.length > 0) {
        await supabase
          .from('calendar_conflicts')
          .update({ resolved_at: new Date().toISOString() })
          .in('id', resolvedConflicts);
      }

      // Insert new conflicts
      if (newConflicts.length > 0) {
        const conflictData = newConflicts.map(conflict => ({
          household_id: conflict.household_id,
          event1_id: conflict.event1_id,
          event2_id: conflict.event2_id,
          conflict_type: conflict.conflict_type,
          severity: conflict.severity,
          description: conflict.description,
          detected_at: conflict.detected_at
        }));

        await supabase
          .from('calendar_conflicts')
          .insert(conflictData);
      }

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        newConflicts,
        resolvedConflicts
      };

    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return { hasConflicts: false, conflicts: [], newConflicts: [], resolvedConflicts: [] };
    }
  }

  /**
   * Check for conflicts between two events
   */
  private static async checkEventConflict(
    event1: EventData,
    event2: EventData,
    householdId: string
  ): Promise<CalendarConflict | null> {
    const conflicts: CalendarConflict[] = [];

    // Check for same title conflict
    if (event1.title.toLowerCase() === event2.title.toLowerCase()) {
      conflicts.push({
        id: '',
        household_id: householdId,
        event1_id: event1.id,
        event2_id: event2.id,
        conflict_type: 'same_title',
        severity: 'medium',
        description: `Both events have the same title: "${event1.title}"`,
        detected_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Check for time overlap conflict
    const timeOverlap = this.checkTimeOverlap(event1, event2);
    if (timeOverlap) {
      conflicts.push({
        id: '',
        household_id: householdId,
        event1_id: event1.id,
        event2_id: event2.id,
        conflict_type: 'time_overlap',
        severity: 'high',
        description: `Events overlap in time: "${event1.title}" and "${event2.title}"`,
        detected_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Check for exact same time conflict
    const sameTime = this.checkSameTime(event1, event2);
    if (sameTime) {
      conflicts.push({
        id: '',
        household_id: householdId,
        event1_id: event1.id,
        event2_id: event2.id,
        conflict_type: 'same_time',
        severity: 'high',
        description: `Events have exactly the same time: "${event1.title}" and "${event2.title}"`,
        detected_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Return the highest severity conflict
    if (conflicts.length > 0) {
      return conflicts.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })[0];
    }

    return null;
  }

  /**
   * Check if two events overlap in time
   */
  private static checkTimeOverlap(event1: EventData, event2: EventData): boolean {
    const start1 = new Date(event1.start_at);
    const end1 = new Date(event1.end_at);
    const start2 = new Date(event2.start_at);
    const end2 = new Date(event2.end_at);

    // Handle all-day events
    if (event1.is_all_day || event2.is_all_day) {
      const date1 = start1.toDateString();
      const date2 = start2.toDateString();
      return date1 === date2;
    }

    // Check for overlap: start1 < end2 && start2 < end1
    return start1 < end2 && start2 < end1;
  }

  /**
   * Check if two events have exactly the same time
   */
  private static checkSameTime(event1: EventData, event2: EventData): boolean {
    const start1 = new Date(event1.start_at);
    const end1 = new Date(event1.end_at);
    const start2 = new Date(event2.start_at);
    const end2 = new Date(event2.end_at);

    return start1.getTime() === start2.getTime() && end1.getTime() === end2.getTime();
  }

  /**
   * Get existing conflict between two events
   */
  private static async getExistingConflict(
    event1Id: string,
    event2Id: string,
    householdId: string
  ): Promise<CalendarConflict | null> {
    const { data, error } = await supabase
      .from('calendar_conflicts')
      .select('*')
      .eq('household_id', householdId)
      .or(`and(event1_id.eq.${event1Id},event2_id.eq.${event2Id}),and(event1_id.eq.${event2Id},event2_id.eq.${event1Id})`)
      .is('resolved_at', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking existing conflict:', error);
      return null;
    }

    return data;
  }

  /**
   * Get all conflicts for a household
   */
  static async getHouseholdConflicts(householdId: string): Promise<CalendarConflict[]> {
    try {
      const { data, error } = await supabase
        .from('calendar_conflicts')
        .select(`
          *,
          event1:events!calendar_conflicts_event1_id_fkey(title, start_at, end_at),
          event2:events!calendar_conflicts_event2_id_fkey(title, start_at, end_at)
        `)
        .eq('household_id', householdId)
        .is('resolved_at', null)
        .order('detected_at', { ascending: false });

      if (error) {
        console.error('Error fetching household conflicts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting household conflicts:', error);
      return [];
    }
  }

  /**
   * Resolve a conflict
   */
  static async resolveConflict(
    conflictId: string,
    resolutionNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('calendar_conflicts')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', conflictId);

      if (error) {
        console.error('Error resolving conflict:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error resolving conflict:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get conflict statistics for a household
   */
  static async getConflictStats(householdId: string): Promise<{
    totalConflicts: number;
    unresolvedConflicts: number;
    resolvedConflicts: number;
    conflictsByType: Record<string, number>;
    conflictsBySeverity: Record<string, number>;
  }> {
    try {
      const { data: allConflicts, error: allError } = await supabase
        .from('calendar_conflicts')
        .select('conflict_type, severity, resolved_at')
        .eq('household_id', householdId);

      if (allError) {
        console.error('Error fetching conflict stats:', allError);
        return {
          totalConflicts: 0,
          unresolvedConflicts: 0,
          resolvedConflicts: 0,
          conflictsByType: {},
          conflictsBySeverity: {}
        };
      }

      const conflicts = allConflicts || [];
      const unresolvedConflicts = conflicts.filter(c => !c.resolved_at);
      const resolvedConflicts = conflicts.filter(c => c.resolved_at);

      const conflictsByType = conflicts.reduce((acc, conflict) => {
        acc[conflict.conflict_type] = (acc[conflict.conflict_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const conflictsBySeverity = conflicts.reduce((acc, conflict) => {
        acc[conflict.severity] = (acc[conflict.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalConflicts: conflicts.length,
        unresolvedConflicts: unresolvedConflicts.length,
        resolvedConflicts: resolvedConflicts.length,
        conflictsByType,
        conflictsBySeverity
      };
    } catch (error) {
      console.error('Error getting conflict stats:', error);
      return {
        totalConflicts: 0,
        unresolvedConflicts: 0,
        resolvedConflicts: 0,
        conflictsByType: {},
        conflictsBySeverity: {}
      };
    }
  }
}
