'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Users, 
  ShoppingCart, 
  ChefHat, 
  Star,
  TrendingUp,
  AlertCircle,
  Plus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, addDays, subDays, isToday } from 'date-fns';
import Link from 'next/link';

interface TodayViewData {
  date: string;
  chores: Array<{
    id: string;
    title: string;
    description?: string;
    assigned_to?: string;
    due_date?: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed';
    xp_reward: number;
    estimated_duration?: number;
  }>;
  events: Array<{
    id: string;
    title: string;
    description?: string;
    startAt: string;
    endAt: string;
    isAllDay: boolean;
    location?: string;
    attendees?: Array<{
      email?: string;
      status: string;
    }>;
    reminders?: Array<{
      minutesBefore: number;
      method: string;
    }>;
  }>;
  meals: Array<{
    id: string;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    recipe_name?: string;
    planned_for: string;
    assigned_to?: string;
    ingredients_needed: Array<{
      name: string;
      quantity: string;
      unit: string;
      is_available: boolean;
    }>;
  }>;
  shopping: {
    urgent_items: Array<{
      id: string;
      name: string;
      quantity?: string;
      notes?: string;
      is_complete: boolean;
      list_name: string;
    }>;
    missing_ingredients: Array<{
      ingredient_name: string;
      meal_name: string;
      meal_type: string;
      quantity_needed: string;
    }>;
  };
  digest: {
    total_chores: number;
    completed_chores: number;
    upcoming_events: number;
    meals_planned: number;
    shopping_items_needed: number;
    xp_earned_today: number;
    xp_available_today: number;
  };
}

export default function TodayView() {
  const [data, setData] = useState<TodayViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchTodayData();
  }, [currentDate]);

  const fetchTodayData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/today-view?date=${currentDate.toISOString()}`);
      if (response.ok) {
        const todayData = await response.json();
        setData(todayData);
      } else {
        setError('Failed to fetch today\'s data');
      }
    } catch (error) {
      console.error('Error fetching today data:', error);
      setError('Failed to fetch today\'s data');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousDay = () => {
    setCurrentDate(subDays(currentDate, 1));
  };

  const handleNextDay = () => {
    setCurrentDate(addDays(currentDate, 1));
  };

  const handleGoToToday = () => {
    setCurrentDate(new Date());
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getMealTypeIcon = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return '🌅';
      case 'lunch': return '🌞';
      case 'dinner': return '🌙';
      case 'snack': return '🍎';
      default: return '🍽️';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground">Loading today's overview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Today View</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchTodayData}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completionPercentage = data.digest.total_chores > 0 
    ? (data.digest.completed_chores / data.digest.total_chores) * 100 
    : 100;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Today's Overview</h1>
          <p className="text-muted-foreground">
            {isToday(currentDate) ? 'Here\'s what\'s happening today' : `Overview for ${format(currentDate, 'MMMM d, yyyy')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleGoToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Digest Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.digest.completed_chores}</div>
              <div className="text-sm text-muted-foreground">Chores Done</div>
              <div className="text-xs text-muted-foreground">of {data.digest.total_chores}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.digest.upcoming_events}</div>
              <div className="text-sm text-muted-foreground">Events Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{data.digest.meals_planned}</div>
              <div className="text-sm text-muted-foreground">Meals Planned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{data.digest.xp_earned_today}</div>
              <div className="text-sm text-muted-foreground">XP Earned</div>
              <div className="text-xs text-muted-foreground">of {data.digest.xp_available_today}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Task Completion</span>
              <span>{Math.round(completionPercentage)}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chores */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Today's Chores
            </CardTitle>
            <Link href="/chores">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data.chores.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-muted-foreground">No chores scheduled for today!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.chores.slice(0, 5).map((chore) => (
                  <div
                    key={chore.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {getStatusIcon(chore.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{chore.title}</h4>
                        <Badge className={`text-xs ${getPriorityColor(chore.priority)}`}>
                          {chore.priority}
                        </Badge>
                      </div>
                      {chore.estimated_duration && (
                        <p className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {chore.estimated_duration} min
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">{chore.xp_reward}</span>
                    </div>
                  </div>
                ))}
                {data.chores.length > 5 && (
                  <div className="text-center pt-2">
                    <Link href="/chores">
                      <Button variant="ghost" size="sm">
                        View all {data.chores.length} chores
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today's Events
            </CardTitle>
            <Link href="/calendar">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data.events.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No events scheduled for today!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.events.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{event.title}</h4>
                      {event.isAllDay && (
                        <Badge variant="secondary" className="text-xs">All day</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {format(new Date(event.startAt), 'h:mm a')}
                        {!event.isAllDay && event.endAt && (
                          <> - {format(new Date(event.endAt), 'h:mm a')}</>
                        )}
                      </p>
                      {event.location && (
                        <p className="text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 inline mr-1" />
                          {event.location}
                        </p>
                      )}
                      {event.attendees && event.attendees.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <Users className="h-3 w-3 inline mr-1" />
                          {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {data.events.length > 5 && (
                  <div className="text-center pt-2">
                    <Link href="/calendar">
                      <Button variant="ghost" size="sm">
                        View all {data.events.length} events
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Today's Meals
            </CardTitle>
            <Link href="/meal-planner">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Plan
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data.meals.length === 0 ? (
              <div className="text-center py-8">
                <ChefHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No meals planned for today!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.meals.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-2xl">{getMealTypeIcon(meal.meal_type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm capitalize">{meal.meal_type}</h4>
                        {meal.recipe_name && (
                          <Badge variant="secondary" className="text-xs">
                            {meal.recipe_name}
                          </Badge>
                        )}
                      </div>
                      {meal.ingredients_needed && meal.ingredients_needed.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {meal.ingredients_needed.filter(ing => !ing.is_available).length} missing ingredients
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shopping */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Shopping Needs
            </CardTitle>
            <Link href="/shopping-lists">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data.shopping.urgent_items.length === 0 && data.shopping.missing_ingredients.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-muted-foreground">All shopping needs covered!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.shopping.urgent_items.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.name}</h4>
                      <p className="text-xs text-muted-foreground">{item.list_name}</p>
                    </div>
                    {item.quantity && (
                      <Badge variant="outline" className="text-xs">
                        {item.quantity}
                      </Badge>
                    )}
                  </div>
                ))}
                {data.shopping.missing_ingredients.slice(0, 3).map((ingredient, index) => (
                  <div
                    key={`missing-${index}`}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{ingredient.ingredient_name}</h4>
                      <p className="text-xs text-muted-foreground">
                        For {ingredient.meal_name} ({ingredient.meal_type})
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs text-orange-600">
                      {ingredient.quantity_needed}
                    </Badge>
                  </div>
                ))}
                {(data.shopping.urgent_items.length > 3 || data.shopping.missing_ingredients.length > 3) && (
                  <div className="text-center pt-2">
                    <Link href="/shopping-lists">
                      <Button variant="ghost" size="sm">
                        View all shopping needs
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}