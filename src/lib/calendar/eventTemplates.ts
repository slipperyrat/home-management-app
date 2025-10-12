/**
 * Event Templates for Common Household Activities
 * Provides pre-configured event templates for quick creation
 */

export interface EventTemplate {
  id: string;
  name: string;
  description: string;
  category: 'family' | 'work' | 'health' | 'social' | 'maintenance' | 'shopping' | 'meal' | 'chore';
  duration: number; // in minutes
  rrule?: string; // recurrence rule
  location?: string;
  attendees?: Array<{
    email?: string;
    status: 'accepted' | 'declined' | 'tentative' | 'needsAction';
    isOptional: boolean;
  }>;
  reminders?: Array<{
    minutesBefore: number;
    method: 'push' | 'email' | 'sms';
  }>;
  color?: string;
  isAllDay?: boolean;
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  // Family Events
  {
    id: 'family-dinner',
    name: 'Family Dinner',
    description: 'Weekly family dinner together',
    category: 'family',
    duration: 90,
    rrule: 'FREQ=WEEKLY;BYDAY=SU',
    location: 'Home',
    reminders: [{ minutesBefore: 60, method: 'push' }],
    color: '#FF6B6B',
    isAllDay: false
  },
  {
    id: 'family-meeting',
    name: 'Family Meeting',
    description: 'Weekly family meeting to discuss household matters',
    category: 'family',
    duration: 60,
    rrule: 'FREQ=WEEKLY;BYDAY=SU',
    location: 'Living Room',
    reminders: [{ minutesBefore: 30, method: 'push' }],
    color: '#4ECDC4',
    isAllDay: false
  },

  // Health & Wellness
  {
    id: 'gym-session',
    name: 'Gym Session',
    description: 'Regular workout session',
    category: 'health',
    duration: 60,
    rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    location: 'Gym',
    reminders: [{ minutesBefore: 15, method: 'push' }],
    color: '#45B7D1',
    isAllDay: false
  },
  {
    id: 'doctor-appointment',
    name: 'Doctor Appointment',
    description: 'Regular health checkup',
    category: 'health',
    duration: 30,
    rrule: 'FREQ=MONTHLY',
    location: 'Medical Center',
    reminders: [{ minutesBefore: 1440, method: 'email' }, { minutesBefore: 60, method: 'push' }],
    color: '#96CEB4',
    isAllDay: false
  },

  // Maintenance & Chores
  {
    id: 'garden-maintenance',
    name: 'Garden Maintenance',
    description: 'Weekly garden care and maintenance',
    category: 'maintenance',
    duration: 120,
    rrule: 'FREQ=WEEKLY;BYDAY=SA',
    location: 'Garden',
    reminders: [{ minutesBefore: 60, method: 'push' }],
    color: '#6BCF7F',
    isAllDay: false
  },
  {
    id: 'deep-clean',
    name: 'Deep Clean',
    description: 'Monthly deep cleaning session',
    category: 'maintenance',
    duration: 240,
    rrule: 'FREQ=MONTHLY;BYDAY=1SA',
    location: 'Home',
    reminders: [{ minutesBefore: 1440, method: 'push' }],
    color: '#FFD93D',
    isAllDay: false
  },

  // Shopping & Meals
  {
    id: 'grocery-shopping',
    name: 'Grocery Shopping',
    description: 'Weekly grocery shopping trip',
    category: 'shopping',
    duration: 90,
    rrule: 'FREQ=WEEKLY;BYDAY=SA',
    location: 'Supermarket',
    reminders: [{ minutesBefore: 60, method: 'push' }],
    color: '#FF8C42',
    isAllDay: false
  },
  {
    id: 'meal-prep',
    name: 'Meal Prep',
    description: 'Weekly meal preparation session',
    category: 'meal',
    duration: 180,
    rrule: 'FREQ=WEEKLY;BYDAY=SU',
    location: 'Kitchen',
    reminders: [{ minutesBefore: 30, method: 'push' }],
    color: '#FF6B9D',
    isAllDay: false
  },

  // Social Events
  {
    id: 'date-night',
    name: 'Date Night',
    description: 'Weekly date night with partner',
    category: 'social',
    duration: 180,
    rrule: 'FREQ=WEEKLY;BYDAY=FR',
    location: 'Restaurant',
    reminders: [{ minutesBefore: 60, method: 'push' }],
    color: '#C44569',
    isAllDay: false
  },
  {
    id: 'friends-gathering',
    name: 'Friends Gathering',
    description: 'Monthly get-together with friends',
    category: 'social',
    duration: 240,
    rrule: 'FREQ=MONTHLY;BYDAY=1SA',
    location: 'Home',
    reminders: [{ minutesBefore: 1440, method: 'email' }, { minutesBefore: 60, method: 'push' }],
    color: '#F8B500',
    isAllDay: false
  },

  // Work & Productivity
  {
    id: 'work-from-home',
    name: 'Work from Home',
    description: 'Remote work day',
    category: 'work',
    duration: 480,
    rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    location: 'Home Office',
    reminders: [{ minutesBefore: 30, method: 'push' }],
    color: '#6C5CE7',
    isAllDay: false
  },
  {
    id: 'project-review',
    name: 'Project Review',
    description: 'Weekly project status review',
    category: 'work',
    duration: 60,
    rrule: 'FREQ=WEEKLY;BYDAY=FR',
    location: 'Home Office',
    reminders: [{ minutesBefore: 15, method: 'push' }],
    color: '#A29BFE',
    isAllDay: false
  },

  // All-Day Events
  {
    id: 'birthday',
    name: 'Birthday Celebration',
    description: 'Birthday celebration',
    category: 'family',
    duration: 0,
    rrule: 'FREQ=YEARLY',
    location: 'Home',
    reminders: [{ minutesBefore: 10080, method: 'email' }, { minutesBefore: 1440, method: 'push' }],
    color: '#FD79A8',
    isAllDay: true
  },
  {
    id: 'anniversary',
    name: 'Anniversary',
    description: 'Anniversary celebration',
    category: 'family',
    duration: 0,
    rrule: 'FREQ=YEARLY',
    location: 'Home',
    reminders: [{ minutesBefore: 10080, method: 'email' }, { minutesBefore: 1440, method: 'push' }],
    color: '#E84393',
    isAllDay: true
  },
  {
    id: 'holiday',
    name: 'Public Holiday',
    description: 'Public holiday - no work',
    category: 'family',
    duration: 0,
    rrule: 'FREQ=YEARLY',
    location: 'Home',
    reminders: [{ minutesBefore: 1440, method: 'push' }],
    color: '#00B894',
    isAllDay: true
  }
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: EventTemplate['category']): EventTemplate[] {
  return EVENT_TEMPLATES.filter(template => template.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): EventTemplate | undefined {
  return EVENT_TEMPLATES.find(template => template.id === id);
}

/**
 * Get all categories
 */
export function getCategories(): EventTemplate['category'][] {
  return Array.from(new Set(EVENT_TEMPLATES.map(template => template.category)));
}

/**
 * Convert template to event data for API
 */
export interface CalendarEventData {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  event_type: EventTemplate['category'];
  priority: 'medium';
  location: string;
}

export function templateToEventData(template: EventTemplate, startDate: Date): CalendarEventData {
  const endDate = new Date(startDate.getTime() + template.duration * 60 * 1000);
  
  return {
    title: template.name,
    description: template.description,
    start_time: startDate.toISOString(),
    end_time: endDate.toISOString(),
    event_type: template.category,
    priority: 'medium',
    location: template.location
  };
}

/**
 * Get suggested templates based on time of day
 */
export function getSuggestedTemplates(time: Date): EventTemplate[] {
  const hour = time.getHours();
  const dayOfWeek = time.getDay();
  
  let suggestions: EventTemplate[] = [];
  
  // Morning suggestions (6-11 AM)
  if (hour >= 6 && hour < 11) {
    suggestions = suggestions.concat(
      getTemplatesByCategory('health'),
      getTemplatesByCategory('work').filter(t => t.id !== 'work-from-home')
    );
  }
  
  // Afternoon suggestions (12-5 PM)
  if (hour >= 12 && hour < 17) {
    suggestions = suggestions.concat(
      getTemplatesByCategory('work'),
      getTemplatesByCategory('shopping')
    );
  }
  
  // Evening suggestions (6-9 PM)
  if (hour >= 18 && hour < 21) {
    suggestions = suggestions.concat(
      getTemplatesByCategory('family'),
      getTemplatesByCategory('social')
    );
  }
  
  // Weekend suggestions
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    suggestions = suggestions.concat(
      getTemplatesByCategory('maintenance'),
      getTemplatesByCategory('family'),
      getTemplatesByCategory('social')
    );
  }
  
  // Remove duplicates
  return suggestions.filter((template, index, self) => 
    index === self.findIndex(t => t.id === template.id)
  );
}
