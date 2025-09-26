import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export interface QuietHours {
  id: string;
  household_id: string;
  start_time: string; // HH:MM format
  end_time: string;   // HH:MM format
  enabled: boolean;
  days_of_week: number[]; // 0 = Sunday, 1 = Monday, etc.
  created_at: string;
  updated_at: string;
}

export interface QuietHoursSettings {
  enabled: boolean;
  start_time: string;
  end_time: string;
  days_of_week: number[];
}

export class QuietHoursService {
  /**
   * Get quiet hours settings for a household
   */
  static async getQuietHours(householdId: string): Promise<QuietHours | null> {
    try {
      const { data, error } = await supabase
        .from('quiet_hours')
        .select('*')
        .eq('household_id', householdId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching quiet hours:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching quiet hours:', error);
      return null;
    }
  }

  /**
   * Create or update quiet hours settings
   */
  static async setQuietHours(
    householdId: string, 
    settings: QuietHoursSettings
  ): Promise<{ success: boolean; data?: QuietHours; error?: string }> {
    try {
      // Check if quiet hours already exist
      const existing = await this.getQuietHours(householdId);

      const quietHoursData = {
        household_id: householdId,
        start_time: settings.start_time,
        end_time: settings.end_time,
        enabled: settings.enabled,
        days_of_week: settings.days_of_week,
        updated_at: new Date().toISOString()
      };

      let result;
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('quiet_hours')
          .update(quietHoursData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating quiet hours:', error);
          return { success: false, error: error.message };
        }

        result = data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('quiet_hours')
          .insert({
            ...quietHoursData,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating quiet hours:', error);
          return { success: false, error: error.message };
        }

        result = data;
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('Error setting quiet hours:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Check if current time is within quiet hours for a household
   */
  static async isQuietHours(householdId: string): Promise<boolean> {
    try {
      const quietHours = await this.getQuietHours(householdId);
      
      if (!quietHours || !quietHours.enabled) {
        return false;
      }

      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

      // Check if today is in the enabled days
      if (!quietHours.days_of_week.includes(currentDay)) {
        return false;
      }

      // Check if current time is within the quiet hours window
      const startTime = quietHours.start_time;
      const endTime = quietHours.end_time;

      // Handle overnight quiet hours (e.g., 22:00 to 06:00)
      if (startTime > endTime) {
        return currentTime >= startTime || currentTime <= endTime;
      } else {
        // Normal quiet hours (e.g., 22:00 to 23:00)
        return currentTime >= startTime && currentTime <= endTime;
      }
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * Get quiet hours status for display
   */
  static async getQuietHoursStatus(householdId: string): Promise<{
    isQuietHours: boolean;
    settings: QuietHours | null;
    nextChange: Date | null;
  }> {
    try {
      const settings = await this.getQuietHours(householdId);
      const isQuietHours = await this.isQuietHours(householdId);

      let nextChange: Date | null = null;
      
      if (settings && settings.enabled) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const currentDay = now.getDay();

        // Calculate next change time
        if (isQuietHours) {
          // Currently in quiet hours, find when it ends
          const endTime = settings.end_time;
          nextChange = new Date();
          nextChange.setHours(
            parseInt(endTime.split(':')[0]),
            parseInt(endTime.split(':')[1]),
            0,
            0
          );

          // If end time is before start time (overnight), and we're past midnight
          if (settings.start_time > settings.end_time && currentTime < endTime) {
            // End time is tomorrow
            nextChange.setDate(nextChange.getDate() + 1);
          }
        } else {
          // Not in quiet hours, find when they start next
          const startTime = settings.start_time;
          nextChange = new Date();
          nextChange.setHours(
            parseInt(startTime.split(':')[0]),
            parseInt(startTime.split(':')[1]),
            0,
            0
          );

          // If start time has passed today, it's tomorrow
          if (currentTime >= startTime) {
            nextChange.setDate(nextChange.getDate() + 1);
          }
        }
      }

      return {
        isQuietHours,
        settings,
        nextChange
      };
    } catch (error) {
      console.error('Error getting quiet hours status:', error);
      return {
        isQuietHours: false,
        settings: null,
        nextChange: null
      };
    }
  }

  /**
   * Format time for display
   */
  static formatTime(time: string): string {
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  }

  /**
   * Format days of week for display
   */
  static formatDaysOfWeek(days: number[]): string {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(day => dayNames[day]).join(', ');
  }

  /**
   * Get default quiet hours settings
   */
  static getDefaultSettings(): QuietHoursSettings {
    return {
      enabled: false,
      start_time: '22:00',
      end_time: '07:00',
      days_of_week: [0, 1, 2, 3, 4, 5, 6] // All days
    };
  }
}
