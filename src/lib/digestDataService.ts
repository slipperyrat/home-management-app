import { createClient } from '@supabase/supabase-js';
import { DigestData } from './emailService';
import { logger } from '@/lib/logging/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export class DigestDataService {
  /**
   * Collect data for daily digest
   */
  static async collectDailyDigestData(
    householdId: string,
    userId: string,
    userEmail: string,
    userName: string,
    householdName: string
  ): Promise<DigestData> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const [chores, meals, shopping, events] = await Promise.all([
      this.getChoresData(householdId, startOfDay, endOfDay),
      this.getMealsData(householdId, startOfDay, endOfDay),
      this.getShoppingData(householdId),
      this.getEventsData(householdId, startOfDay, endOfDay)
    ]);

    return {
      household_id: householdId,
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      household_name: householdName,
      date: today.toLocaleDateString(),
      type: 'daily',
      chores,
      meals,
      shopping,
      events
    };
  }

  /**
   * Collect data for weekly digest
   */
  static async collectWeeklyDigestData(
    householdId: string,
    userId: string,
    userEmail: string,
    userName: string,
    householdName: string
  ): Promise<DigestData> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7); // End of current week

    const [chores, meals, shopping, events, achievements, insights] = await Promise.all([
      this.getChoresData(householdId, startOfWeek, endOfWeek),
      this.getMealsData(householdId, startOfWeek, endOfWeek),
      this.getShoppingData(householdId),
      this.getEventsData(householdId, startOfWeek, endOfWeek),
      this.getAchievementsData(householdId, startOfWeek, endOfWeek),
      this.getInsightsData(householdId, startOfWeek, endOfWeek)
    ]);

    return {
      household_id: householdId,
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      household_name: householdName,
      date: now.toLocaleDateString(),
      type: 'weekly',
      chores,
      meals,
      shopping,
      events,
      achievements,
      insights
    };
  }

  /**
   * Get chores data for the specified date range
   */
  private static async getChoresData(householdId: string, startDate: Date, endDate: Date) {
    try {
      // Check if chores table exists
      const { data: tableExists } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'chores')
        .single();

      if (!tableExists) {
        logger.debug?.('Chores table does not exist, returning empty data', { householdId });
        return { pending: [], completed: [] };
      }

      // Get pending chores
      const { data: pendingChores, error: pendingError } = await supabase
        .from('chores')
        .select(`
          id,
          title,
          description,
          priority,
          due_date,
          assigned_to
        `)
        .eq('household_id', householdId)
        .eq('completed', false)
        .lte('due_date', endDate.toISOString())
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true });

      if (pendingError) {
        logger.error('Error fetching pending chores', pendingError, { householdId });
      }

      // Get completed chores in date range
      const { data: completedChores, error: completedError } = await supabase
        .from('chores')
        .select(`
          id,
          title,
          completed_at,
          completed_by
        `)
        .eq('household_id', householdId)
        .eq('completed', true)
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString())
        .order('completed_at', { ascending: false });

      if (completedError) {
        logger.error('Error fetching completed chores', completedError, { householdId });
      }

      return {
        pending: pendingChores?.map(chore => ({
          id: chore.id,
          title: chore.title,
          description: chore.description,
          priority: chore.priority || 'medium',
          due_date: chore.due_date,
          assigned_to: chore.assigned_to
        })) || [],
        completed: completedChores?.map(chore => ({
          id: chore.id,
          title: chore.title,
          completed_at: chore.completed_at,
          completed_by: chore.completed_by || 'Unknown'
        })) || []
      };
    } catch (error) {
      logger.error('Error fetching chores data', error as Error, { householdId });
      return { pending: [], completed: [] };
    }
  }

  /**
   * Get meals data for the specified date range
   */
  private static async getMealsData(householdId: string, startDate: Date, endDate: Date) {
    try {
      // Check if meal_plans table exists
      const { data: tableExists } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'meal_plans')
        .single();

      if (!tableExists) {
        logger.debug?.('Meal plans table does not exist, returning empty data', { householdId });
        return { today: [], this_week: [] };
      }

      const { data: meals, error: mealsError } = await supabase
        .from('meal_plans')
        .select(`
          id,
          name,
          meal_type,
          planned_date,
          planned_time
        `)
        .eq('household_id', householdId)
        .gte('planned_date', startDate.toISOString().split('T')[0])
        .lte('planned_date', endDate.toISOString().split('T')[0])
        .order('planned_date', { ascending: true })
        .order('planned_time', { ascending: true });

      if (mealsError) {
        logger.error('Error fetching meals data', mealsError, { householdId });
        return { today: [], this_week: [] };
      }

      const today = new Date().toISOString().split('T')[0];
      const todayMeals = meals?.filter(meal => meal.planned_date === today) || [];
      const weekMeals = meals || [];

      return {
        today: todayMeals.map(meal => ({
          id: meal.id,
          name: meal.name,
          meal_type: meal.meal_type || 'dinner',
          time: meal.planned_time
        })),
        this_week: weekMeals.map(meal => ({
          id: meal.id,
          name: meal.name,
          meal_type: meal.meal_type || 'dinner',
          date: meal.planned_date
        }))
      };
    } catch (error) {
      logger.error('Error fetching meals data', error as Error, { householdId });
      return { today: [], this_week: [] };
    }
  }

  /**
   * Get shopping data
   */
  private static async getShoppingData(householdId: string) {
    try {
      // Check if shopping_items table exists
      const { data: tableExists } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'shopping_items')
        .single();

      if (!tableExists) {
        logger.debug?.('Shopping items table does not exist, returning empty data', { householdId });
        return { pending: [], completed: [] };
      }

      // Get pending shopping items
      const { data: pendingItems, error: pendingError } = await supabase
        .from('shopping_items')
        .select(`
          id,
          name,
          quantity,
          unit,
          category,
          completed
        `)
        .eq('household_id', householdId)
        .eq('completed', false)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (pendingError) {
        logger.error('Error fetching pending shopping items', pendingError, { householdId });
      }

      // Get recently completed items (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: completedItems, error: completedError } = await supabase
        .from('shopping_items')
        .select(`
          id,
          name,
          completed_at
        `)
        .eq('household_id', householdId)
        .eq('completed', true)
        .gte('completed_at', sevenDaysAgo.toISOString())
        .order('completed_at', { ascending: false });

      if (completedError) {
        logger.error('Error fetching completed shopping items', completedError, { householdId });
      }

      return {
        pending: pendingItems?.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category
        })) || [],
        completed: completedItems?.map(item => ({
          id: item.id,
          name: item.name,
          completed_at: item.completed_at
        })) || []
      };
    } catch (error) {
      logger.error('Error fetching shopping data', error as Error, { householdId });
      return { pending: [], completed: [] };
    }
  }

  /**
   * Get events data for the specified date range
   */
  private static async getEventsData(householdId: string, startDate: Date, endDate: Date) {
    try {
      // Check if events table exists
      const { data: tableExists } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'events')
        .single();

      if (!tableExists) {
        logger.debug?.('Events table does not exist, returning empty data', { householdId });
        return { today: [], upcoming: [] };
      }

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_at,
          end_at,
          location
        `)
        .eq('household_id', householdId)
        .gte('start_at', startDate.toISOString())
        .lte('start_at', endDate.toISOString())
        .order('start_at', { ascending: true });

      if (eventsError) {
        logger.error('Error fetching events data', eventsError, { householdId });
        return { today: [], upcoming: [] };
      }

      const today = new Date();
      const todayEvents = events?.filter(event => {
        const eventDate = new Date(event.start_at);
        return eventDate.toDateString() === today.toDateString();
      }) || [];

      const upcomingEvents = events?.filter(event => {
        const eventDate = new Date(event.start_at);
        return eventDate > today;
      }) || [];

      return {
        today: todayEvents.map(event => ({
          id: event.id,
          title: event.title,
          start_time: event.start_at,
          end_time: event.end_at,
          location: event.location
        })),
        upcoming: upcomingEvents.map(event => ({
          id: event.id,
          title: event.title,
          start_time: event.start_at,
          end_time: event.end_at,
          location: event.location
        }))
      };
    } catch (error) {
      logger.error('Error fetching events data', error as Error, { householdId });
      return { today: [], upcoming: [] };
    }
  }

  /**
   * Get achievements data for the specified date range
   */
  private static async getAchievementsData(householdId: string, startDate: Date, endDate: Date) {
    try {
      // Check if achievements table exists
      const { data: tableExists } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'achievements')
        .single();

      if (!tableExists) {
        logger.debug?.('Achievements table does not exist, returning empty data', { householdId });
        return [];
      }

      const { data: achievements, error: achievementsError } = await supabase
        .from('achievements')
        .select(`
          id,
          title,
          description,
          xp_reward,
          earned_at,
          user_id
        `)
        .eq('household_id', householdId)
        .gte('earned_at', startDate.toISOString())
        .lte('earned_at', endDate.toISOString())
        .order('earned_at', { ascending: false });

      if (achievementsError) {
        logger.error('Error fetching achievements data', achievementsError, { householdId });
        return [];
      }

      return achievements?.map(achievement => ({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        earned_at: achievement.earned_at,
        xp: achievement.xp_reward || 0
      })) || [];
    } catch (error) {
      logger.error('Error fetching achievements data', error as Error, { householdId });
      return [];
    }
  }

  /**
   * Get AI insights data for the specified date range
   */
  private static async getInsightsData(householdId: string, startDate: Date, endDate: Date) {
    try {
      // Check if ai_insights table exists
      const { data: tableExists } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'ai_insights')
        .single();

      if (!tableExists) {
        logger.debug?.('AI insights table does not exist, returning empty data', { householdId });
        return [];
      }

      const { data: insights, error: insightsError } = await supabase
        .from('ai_insights')
        .select(`
          id,
          type,
          title,
          description,
          confidence,
          created_at
        `)
        .eq('household_id', householdId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (insightsError) {
        logger.error('Error fetching insights data', insightsError, { householdId });
        return [];
      }

      return insights?.map(insight => ({
        type: insight.type,
        title: insight.title,
        description: insight.description,
        confidence: insight.confidence || 0
      })) || [];
    } catch (error) {
      logger.error('Error fetching insights data', error as Error, { householdId });
      return [];
    }
  }
}
