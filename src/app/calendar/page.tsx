'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Calendar, 
  Brain, 
  Lightbulb, 
  TrendingUp, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  BarChart3,
  Zap,
  Users,
  Target,
  CalendarDays,
  Smartphone,
  Bell
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  household_id: string;
  created_by: string;
  event_type: string;
  priority: 'low' | 'medium' | 'high';
  ai_suggested: boolean;
  ai_confidence: number;
  conflict_resolved: boolean;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

interface AICalendarInsights {
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
}

export default function CalendarPage() {
  const { userId } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [aiInsights, setAiInsights] = useState<AICalendarInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (userId) {
      fetchEvents();
      fetchAICalendarInsights();
    }
  }, [userId]);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/calendar');
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAICalendarInsights = async () => {
    try {
      const response = await fetch('/api/ai/calendar-insights');
      if (response.ok) {
        const data = await response.json();
        setAiInsights(data.insights);
      }
    } catch (error) {
      console.error('Error fetching AI insights:', error);
    }
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events.filter(event => new Date(event.start_time) > now).slice(0, 5);
  };

  const getConflicts = () => {
    // Simple conflict detection - events that overlap
    const conflicts: CalendarEvent[][] = [];
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const current = sortedEvents[i];
      const next = sortedEvents[i + 1];
      
      if (current && next && new Date(current.end_time) > new Date(next.start_time)) {
        conflicts.push([current, next]);
      }
    }

    return conflicts;
  };

  const getAIConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAIConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Calendar className="h-12 w-12 animate-pulse mx-auto mb-4 text-blue-500" />
          <p className="text-lg text-gray-600">Loading Smart Calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-900">Smart Calendar & Events</h1>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            <Brain className="h-4 w-4 mr-1" />
            AI-Powered
          </Badge>
        </div>
        <p className="text-gray-600 text-lg">
          Intelligent scheduling with AI conflict resolution and smart reminders
        </p>
      </div>

      {/* AI Insights Summary */}
      {aiInsights && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.total_events}</div>
              <p className="text-xs text-gray-500">Events scheduled</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.upcoming_events}</div>
              <p className="text-xs text-gray-500">Events ahead</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Learning</CardTitle>
              <Brain className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.ai_learning_progress}%</div>
              <p className="text-xs text-gray-500">Pattern recognition</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conflicts Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.conflicts_resolved}</div>
              <p className="text-xs text-gray-500">AI resolved</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="suggestions">Smart Suggestions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Create new events or get AI-powered scheduling suggestions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Event
                </Button>
                <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                  <Brain className="h-4 w-4 mr-2" />
                  AI Suggestions
                </Button>
                <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
                  <Target className="h-4 w-4 mr-2" />
                  Smart Templates
                </Button>
                <Button variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50">
                  <Bell className="h-4 w-4 mr-2" />
                  Reminder Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Upcoming Events
              </CardTitle>
              <CardDescription>
                Your next scheduled events with AI insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getUpcomingEvents().length > 0 ? (
                <div className="space-y-4">
                  {getUpcomingEvents().map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{event.title}</h4>
                          {event.ai_suggested && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI Suggested
                            </Badge>
                          )}
                          <Badge variant={event.priority === 'high' ? 'destructive' : event.priority === 'medium' ? 'default' : 'secondary'}>
                            {event.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{new Date(event.start_time).toLocaleDateString()}</span>
                          <span>{new Date(event.start_time).toLocaleTimeString()} - {new Date(event.end_time).toLocaleTimeString()}</span>
                          <span className={getAIConfidenceColor(event.ai_confidence)}>
                            AI Confidence: {event.ai_confidence}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600 mb-1">Type</div>
                        <Badge variant="outline">{event.event_type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No upcoming events. Schedule your first event to get started!
                </p>
              )}
            </CardContent>
          </Card>

          {/* AI Learning Progress */}
          {aiInsights && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  AI Learning Progress
                </CardTitle>
                <CardDescription>
                  How well the AI understands your scheduling patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Pattern Recognition</span>
                    <span>{aiInsights.ai_learning_progress}%</span>
                  </div>
                  <Progress value={aiInsights.ai_learning_progress} />
                  <p className="text-sm text-gray-600">
                    The AI is learning from your scheduling habits to provide better suggestions and conflict resolution
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Calendar View</h2>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Event
            </Button>
          </div>

          {/* Calendar Grid Placeholder */}
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Calendar View</h3>
              <p className="text-gray-500 mb-4">
                Interactive calendar view with AI-powered scheduling insights
              </p>
              <p className="text-sm text-gray-400">
                Calendar grid implementation coming in next iteration
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="ai-insights" className="space-y-6">
          {aiInsights ? (
            <>
              {/* Scheduling Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Scheduling Patterns
                  </CardTitle>
                  <CardDescription>
                    AI analysis of your scheduling behavior and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Most Common Event Types</h4>
                      {aiInsights.most_common_event_types.length > 0 ? (
                        <div className="space-y-2">
                          {aiInsights.most_common_event_types.map((type, index) => (
                            <div key={index} className="flex items-center gap-3">
                              <Badge variant="secondary" className="w-16 justify-center">
                                #{index + 1}
                              </Badge>
                              <span className="text-sm">{type}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">
                          Event types will appear as you schedule more events
                        </p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium mb-3">Optimal Scheduling Times</h4>
                      {aiInsights.optimal_scheduling_times.length > 0 ? (
                        <div className="space-y-2">
                          {aiInsights.optimal_scheduling_times.map((time, index) => (
                            <div key={index} className="flex items-center gap-3">
                              <Badge variant="outline" className="w-20 justify-center">
                                {time}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">
                          AI will learn optimal times as you schedule events
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Household Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-500" />
                    Household Patterns
                  </CardTitle>
                  <CardDescription>
                    AI insights about your household's scheduling preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {aiInsights.household_patterns.length > 0 ? (
                    <div className="space-y-3">
                      {aiInsights.household_patterns.map((pattern, index) => (
                        <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-start gap-3">
                            <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-blue-800">{pattern}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Household patterns will emerge as the AI learns your scheduling habits
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">AI Insights Loading</h3>
                <p className="text-gray-500">
                  Schedule your first events to generate AI insights
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Conflicts Tab */}
        <TabsContent value="conflicts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Schedule Conflicts
              </CardTitle>
              <CardDescription>
                AI-detected and resolved scheduling conflicts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getConflicts().length > 0 ? (
                <div className="space-y-4">
                  {getConflicts().map((conflict, index) => (
                    <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        <h4 className="font-medium text-orange-800">Conflict Detected</h4>
                      </div>
                      <div className="space-y-2">
                        {conflict.map((event) => (
                          <div key={event.id} className="flex items-center justify-between p-2 bg-white rounded border">
                            <div>
                              <span className="font-medium">{event.title}</span>
                              <span className="text-sm text-gray-600 ml-2">
                                {new Date(event.start_time).toLocaleTimeString()} - {new Date(event.end_time).toLocaleTimeString()}
                              </span>
                            </div>
                            <Badge variant="outline">{event.event_type}</Badge>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-orange-200">
                        <Button size="sm" variant="outline" className="text-orange-700 border-orange-300">
                          <Brain className="h-4 w-4 mr-2" />
                          AI Resolve Conflict
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Conflicts Found</h3>
                  <p className="text-gray-500">
                    Great! Your schedule is conflict-free. The AI will continue monitoring for potential issues.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Smart Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Smart Suggestions
              </CardTitle>
              <CardDescription>
                AI-powered recommendations to improve your scheduling experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiInsights?.suggested_improvements && aiInsights.suggested_improvements.length > 0 ? (
                <div className="space-y-4">
                  {aiInsights.suggested_improvements.map((suggestion, index) => (
                    <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-800">{suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Lightbulb className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions yet</h3>
                  <p className="text-gray-500">
                    Schedule more events to get personalized AI recommendations
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 