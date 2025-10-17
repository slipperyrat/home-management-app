/**
 * RRULE Utilities for Calendar Events
 * Reuses and extends the RRULE logic from chores for calendar events
 */

import { RRuleSet, rrulestr } from 'rrule';
import { logger } from '@/lib/logging/logger';

export interface EventOccurrence {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  timezone: string;
  location?: string;
  isException?: boolean;
}

export interface EventData {
  id: string;
  title: string;
  description?: string | undefined;
  startAt: Date;
  endAt: Date;
  timezone: string;
  isAllDay: boolean;
  rrule?: string | undefined;
  exdates?: Date[] | undefined;
  rdates?: Date[] | undefined;
  location?: string | undefined;
}

/**
 * Generate event occurrences from an event with RRULE
 */
export function generateEventOccurrences(
  event: EventData,
  startDate: Date,
  endDate: Date
): EventOccurrence[] {
  const occurrences: EventOccurrence[] = [];
  
  // If no RRULE, just return the single event if it's in range
  if (!event.rrule) {
    if (event.startAt >= startDate && event.startAt <= endDate) {
      occurrences.push({
        id: `${event.id}-single`,
        eventId: event.id,
        title: event.title,
        description: event.description ?? '',
        startAt: event.startAt,
        endAt: event.endAt,
        isAllDay: event.isAllDay,
        timezone: event.timezone,
        location: event.location ?? '',
        isException: false
      });
    }
    return occurrences;
  }

  try {
    // Create RRuleSet to handle RRULE + EXDATES + RDATES
    const ruleSet = new RRuleSet();
    
    // Add the main RRULE
    const rrule = rrulestr(event.rrule, { dtstart: event.startAt });
    ruleSet.rrule(rrule);
    
    // Add exception dates (EXDATES)
    if (event.exdates && event.exdates.length > 0) {
      event.exdates.forEach(exdate => {
        ruleSet.exdate(exdate);
      });
    }
    
    // Add additional dates (RDATES)
    if (event.rdates && event.rdates.length > 0) {
      event.rdates.forEach(rdate => {
        ruleSet.rdate(rdate);
      });
    }
    
    // Generate occurrences within the date range
    const dates = ruleSet.between(startDate, endDate, true);
    
    dates.forEach((date, index) => {
      // Calculate duration for this occurrence
      const duration = event.endAt.getTime() - event.startAt.getTime();
      const occurrenceEnd = new Date(date.getTime() + duration);
      
      occurrences.push({
        id: `${event.id}-${index}`,
        eventId: event.id,
        title: event.title,
        description: event.description ?? '',
        startAt: date,
        endAt: occurrenceEnd,
        isAllDay: event.isAllDay,
        timezone: event.timezone,
        location: event.location ?? '',
        isException: false
      });
    });
    
  } catch (error) {
    console.error('Error generating event occurrences:', error);
    // Fallback to single occurrence if RRULE parsing fails
    if (event.startAt >= startDate && event.startAt <= endDate) {
      occurrences.push({
        id: `${event.id}-fallback`,
        eventId: event.id,
        title: event.title,
        description: event.description ?? '',
        startAt: event.startAt,
        endAt: event.endAt,
        isAllDay: event.isAllDay,
        timezone: event.timezone,
        location: event.location ?? '',
        isException: false
      });
    }
  }
  
  return occurrences;
}

/**
 * Common RRULE presets for easy event creation
 */
export const RRULE_PRESETS = {
  DAILY: 'FREQ=DAILY',
  WEEKDAYS: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  WEEKLY: 'FREQ=WEEKLY',
  MONTHLY: 'FREQ=MONTHLY',
  YEARLY: 'FREQ=YEARLY',
  MON_WED_FRI: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  TUES_THURS: 'FREQ=WEEKLY;BYDAY=TU,TH',
  FIRST_MONDAY: 'FREQ=MONTHLY;BYDAY=1MO',
  LAST_DAY: 'FREQ=MONTHLY;BYDAY=-1',
} as const;

/**
 * Generate RRULE string from common patterns
 */
export function createRRule(
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
  interval: number = 1,
  byDay?: string[],
  count?: number,
  until?: Date
): string {
  let rrule = `FREQ=${frequency}`;
  
  if (interval > 1) {
    rrule += `;INTERVAL=${interval}`;
  }
  
  if (byDay && byDay.length > 0) {
    rrule += `;BYDAY=${byDay.join(',')}`;
  }
  
  if (count) {
    rrule += `;COUNT=${count}`;
  }
  
  if (until) {
    rrule += `;UNTIL=${until.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  }
  
  return rrule;
}

/**
 * Parse RRULE string to human-readable description
 */
export function parseRRuleDescription(rrule: string): string {
  try {
    const rule = rrulestr(rrule);
    const {
      freq,
      interval = 1,
      byweekday,
      count,
      until,
    } = rule.options;

    if (!freq) return 'No recurrence';

    const freqLabel = ['', 'Daily', 'Weekly', 'Monthly', 'Yearly'][freq] ?? 'Custom';

    let description = `Every ${interval > 1 ? `${interval} ` : ''}${freqLabel.toLowerCase()}`;

    if (byweekday) {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const days = byweekday.map((day) => {
        if (typeof day === 'number') {
          return dayNames[day] ?? String(day);
        }
        const weekday = typeof day === 'object' && day !== null && 'weekday' in day ? (day as { weekday: number }).weekday : undefined;
        if (typeof weekday === 'number') {
          return dayNames[weekday] ?? String(weekday);
        }
        return 'Custom';
      });
      description += ` on ${days.join(', ')}`;
    }

    if (count) {
      description += ` (${count} times)`;
    }

    if (until) {
      description += ` until ${until.toLocaleDateString()}`;
    }

    return description;
  } catch (error) {
    logger.error('Error parsing RRULE', error as Error, { rrule });
    return 'Custom recurrence';
  }
}

/**
 * Check if two events have time conflicts
 */
export function hasTimeConflict(
  event1: { startAt: Date; endAt: Date },
  event2: { startAt: Date; endAt: Date }
): boolean {
  return event1.startAt < event2.endAt && event2.startAt < event1.endAt;
}

/**
 * Find conflicts between events in a list
 */
export function findConflicts(events: EventOccurrence[]): Array<{
  event1: EventOccurrence;
  event2: EventOccurrence;
  conflictType: 'overlap' | 'adjacent';
}> {
  const conflicts: Array<{
    event1: EventOccurrence;
    event2: EventOccurrence;
    conflictType: 'overlap' | 'adjacent';
  }> = [];
  
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const event1 = events[i];
      const event2 = events[j];

      if (!event1 || !event2) {
        continue;
      }

      if (hasTimeConflict(event1, event2)) {
        // Check if they're just adjacent (touching) or actually overlapping
        const isAdjacent = 
          event1.endAt.getTime() === event2.startAt.getTime() ||
          event2.endAt.getTime() === event1.startAt.getTime();
        
        conflicts.push({
          event1,
          event2,
          conflictType: isAdjacent ? 'adjacent' : 'overlap'
        });
      }
    }
  }
  
  return conflicts;
}

/**
 * Convert timezone-aware date to UTC for storage
 */
export function toUTC(date: Date, timezone: string): Date {
  // Convert to UTC by adjusting for timezone offset
  // This is a simplified implementation - in production, use date-fns-tz or similar
  const utcDate = new Date(date.toISOString());
  
  // Get timezone offset in minutes
  const timezoneOffset = getTimezoneOffset(timezone);
  const offsetMs = timezoneOffset * 60 * 1000;
  
  return new Date(utcDate.getTime() + offsetMs);
}

/**
 * Convert UTC date to timezone-aware date for display
 */
export function fromUTC(utcDate: Date, timezone: string): Date {
  // Convert from UTC to target timezone
  const timezoneOffset = getTimezoneOffset(timezone);
  const offsetMs = timezoneOffset * 60 * 1000;
  
  return new Date(utcDate.getTime() - offsetMs);
}

/**
 * Get timezone offset in minutes for common timezones
 * In production, use a proper timezone library like date-fns-tz
 */
function getTimezoneOffset(timezone: string): number {
  const timezoneMap: Record<string, number> = {
    'Australia/Melbourne': 600, // UTC+10 (AEST) or UTC+11 (AEDT)
    'Australia/Sydney': 600,
    'Australia/Brisbane': 600,
    'Australia/Perth': 480, // UTC+8
    'Australia/Adelaide': 570, // UTC+9:30
    'America/New_York': -300, // UTC-5 (EST) or UTC-4 (EDT)
    'America/Los_Angeles': -480, // UTC-8 (PST) or UTC-7 (PDT)
    'America/Chicago': -360, // UTC-6 (CST) or UTC-5 (CDT)
    'Europe/London': 0, // UTC+0 (GMT) or UTC+1 (BST)
    'Europe/Paris': 60, // UTC+1 (CET) or UTC+2 (CEST)
    'Asia/Tokyo': 540, // UTC+9
    'UTC': 0
  };
  
  return timezoneMap[timezone] || 0;
}

/**
 * Get current timezone offset for a timezone (accounting for DST)
 */
export function getCurrentTimezoneOffset(timezone: string): number {
  // This is a simplified implementation
  // In production, use Intl.DateTimeFormat or a proper timezone library
  const now = new Date();
  
  // For Australia/Melbourne, check if we're in daylight saving time
  if (timezone === 'Australia/Melbourne' || timezone === 'Australia/Sydney') {
    const year = now.getFullYear();
    const dstStart = new Date(year, 9, 1, 2, 0, 0); // First Sunday in October
    const dstEnd = new Date(year, 3, 1, 2, 0, 0); // First Sunday in April
    
    // Adjust to first Sunday
    dstStart.setDate(dstStart.getDate() + (7 - dstStart.getDay()));
    dstEnd.setDate(dstEnd.getDate() + (7 - dstEnd.getDay()));
    
    if (now >= dstStart && now < dstEnd) {
      return 660; // UTC+11 (AEDT)
    }
    return 600; // UTC+10 (AEST)
  }
  
  return getTimezoneOffset(timezone) + (now.getTimezoneOffset() * -1);
}
