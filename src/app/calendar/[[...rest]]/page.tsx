'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Plus, Download, Clock, MapPin, Users, X, Link } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { EVENT_TEMPLATES, getTemplatesByCategory, getSuggestedTemplates, templateToEventData } from '@/lib/calendar/eventTemplates';
import CreateEventModal from '@/components/calendar/CreateEventModal';

interface Event {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  timezone: string;
  location?: string;
  isRecurring?: boolean;
  originalEventId?: string;
  calendar?: {
    name: string;
    color: string;
  };
  attendees?: Array<{
    user_id?: string;
    email?: string;
    status: string;
    is_optional: boolean;
  }>;
  reminders?: Array<{
    minutes_before: number;
    method: string;
  }>;
}

interface CalendarData {
  events: Event[];
  count: number;
}

export default function CalendarPage() {
  const { user } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Fetch user data and household ID
  useEffect(() => {
    const getUserData = async () => {
      try {
        const response = await fetch('/api/user-data');
        if (response.ok) {
          const userData = await response.json();
          setHouseholdId(userData.data.household_id);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    if (user) {
      getUserData();
    }
  }, [user]);

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      if (!householdId) return;

      setLoading(true);
      try {
        const startOfWeekDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
        const endOfWeekDate = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday
        
        const response = await fetch(
          `/api/calendar?start=${startOfWeekDate.toISOString()}&end=${endOfWeekDate.toISOString()}`
        );
        
        if (response.ok) {
          const responseData = await response.json();
          const events = responseData.data?.events || [];
          setEvents(events);
        } else {
          setError('Failed to fetch events');
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        setError('Failed to fetch events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [householdId, currentDate]);

  const formatEventTime = (event: Event) => {
    if (event.isAllDay) {
      return 'All day';
    }
    
    const start = parseISO(event.startAt);
    const end = parseISO(event.endAt);
    
    const startTime = format(start, 'h:mm a');
    const endTime = format(end, 'h:mm a');
    
    return `${startTime} - ${endTime}`;
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.startAt);
      return isSameDay(eventDate, day);
    });
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events
      .filter(event => parseISO(event.startAt) >= now)
      .slice(0, 5);
  };

  const getICSExportUrl = () => {
    if (!householdId) return '#';
    return `/api/calendars/${householdId}/ics`;
  };

  const handleNewEvent = () => {
    setShowNewEventModal(true);
  };

  const handleTemplateEvent = () => {
    setShowTemplateModal(true);
  };

  const createEventFromTemplate = async (template: any, startDate: Date) => {
    try {
      const eventData = templateToEventData(template, startDate);
      
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        // Refresh events
        window.location.reload();
        setShowTemplateModal(false);
      } else {
        console.error('Failed to create event from template');
      }
    } catch (error) {
      console.error('Error creating event from template:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground">Loading calendar...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Calendar</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">
            Manage your household events and activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/calendar/sync">
              <Link className="h-4 w-4 mr-2" />
              Sync Settings
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={getICSExportUrl()} download>
              <Download className="h-4 w-4 mr-2" />
              Export Calendar
            </a>
          </Button>
          <Button variant="outline" onClick={handleTemplateEvent}>
            <Calendar className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button onClick={handleNewEvent}>
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Button>
        </div>
      </div>

      <Tabs defaultValue="week" className="space-y-6">
        <TabsList>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getUpcomingEvents().length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getUpcomingEvents().map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{event.title}</h3>
                          {event.isRecurring && (
                            <Badge variant="secondary" className="text-xs">
                              Recurring
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {format(parseISO(event.startAt), 'EEEE, MMMM d, yyyy')} • {formatEventTime(event)}
                        </p>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {event.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </div>
                          )}
                          {event.attendees && event.attendees.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="week" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(addDays(currentDate, -7))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(addDays(currentDate, 7))}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-4">
            {getWeekDays().map((day, index) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <Card key={index} className={isToday ? 'ring-2 ring-primary' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {format(day, 'EEE')}
                    </CardTitle>
                    <p className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="p-2 text-xs bg-muted rounded hover:bg-muted/80 transition-colors cursor-pointer"
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          {!event.isAllDay && (
                            <div className="text-muted-foreground">
                              {format(parseISO(event.startAt), 'h:mm a')}
                            </div>
                          )}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Event Templates
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplateModal(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <p className="text-muted-foreground">
                  Choose from common household event templates to quickly add recurring events to your calendar.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {EVENT_TEMPLATES.map((template) => (
                    <Card 
                      key={template.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => createEventFromTemplate(template, new Date())}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-sm">{template.name}</h3>
                          <Badge 
                            variant="secondary" 
                            className="text-xs"
                            style={{ backgroundColor: template.color + '20', color: template.color }}
                          >
                            {template.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          {template.description}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {template.isAllDay ? 'All day' : `${template.duration} min`}
                          </span>
                          {template.rrule && (
                            <Badge variant="outline" className="text-xs">
                              Recurring
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* New Event Modal */}
      {showNewEventModal && (
        <CreateEventModal 
          isOpen={showNewEventModal}
          onClose={() => setShowNewEventModal(false)}
          onEventCreated={() => {
            setShowNewEventModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}