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

const GetQuietHoursSchema = z.object({
  household_id: z.string().uuid(),
});

const SetQuietHoursSchema = z.object({
  household_id: z.string().uuid(),
  enabled: z.boolean(),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  days_of_week: z.array(z.number().min(0).max(6)).min(1),
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

    const { household_id } = GetQuietHoursSchema.parse({ household_id: householdId });

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('household_id', household_id)
      .eq('user_id', userId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 });
    }

    // Get quiet hours settings
    const { data: quietHours, error: quietHoursError } = await supabase
      .from('quiet_hours')
      .select('*')
      .eq('household_id', household_id)
      .eq('is_active', true)
      .single();

    if (quietHoursError && quietHoursError.code !== 'PGRST116') {
      console.error('Error fetching quiet hours:', quietHoursError);
      return NextResponse.json({ error: 'Failed to fetch quiet hours' }, { status: 500 });
    }

    // Calculate current status
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    let isQuietHours = false;
    let nextChange = null;

    if (quietHours && quietHours.is_active) {
      const { start_time, end_time, days_of_week } = quietHours;
      const isDayActive = days_of_week.includes(currentDay);
      
      if (isDayActive) {
        // Check if we're in the time range
        if (start_time <= end_time) {
          // Same day range (e.g., 22:00 to 07:00)
          isQuietHours = currentTime >= start_time || currentTime <= end_time;
        } else {
          // Overnight range (e.g., 22:00 to 07:00)
          isQuietHours = currentTime >= start_time || currentTime <= end_time;
        }
      }

      // Calculate next change
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (isQuietHours) {
        // Currently in quiet hours, next change is when they end
        const endTimeToday = new Date(now);
        const [endHour, endMinute] = end_time.split(':').map(Number);
        endTimeToday.setHours(endHour, endMinute, 0, 0);
        
        if (endTimeToday <= now) {
          endTimeToday.setDate(endTimeToday.getDate() + 1);
        }
        
        nextChange = endTimeToday.toISOString();
      } else {
        // Currently not in quiet hours, next change is when they start
        const startTimeToday = new Date(now);
        const [startHour, startMinute] = start_time.split(':').map(Number);
        startTimeToday.setHours(startHour, startMinute, 0, 0);
        
        if (startTimeToday <= now) {
          startTimeToday.setDate(startTimeToday.getDate() + 1);
        }
        
        nextChange = startTimeToday.toISOString();
      }
    }

    const settings = quietHours ? {
      enabled: quietHours.is_active,
      start_time: quietHours.start_time,
      end_time: quietHours.end_time,
      days_of_week: quietHours.days_of_week
    } : {
      enabled: false,
      start_time: '22:00',
      end_time: '07:00',
      days_of_week: [0, 1, 2, 3, 4, 5, 6]
    };

    const status = {
      is_quiet_hours: isQuietHours,
      settings,
      next_change: nextChange,
      formatted: {
        next_change: nextChange ? new Date(nextChange).toLocaleString() : null,
        days_of_week: quietHours ? 
          quietHours.days_of_week.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') : 
          null,
        time_range: quietHours ? 
          `${quietHours.start_time} - ${quietHours.end_time}` : 
          null
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        settings,
        status
      }
    });
  } catch (error) {
    console.error('Error in GET /api/quiet-hours:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);
    console.log('🔐 Quiet hours POST auth result:', { userId });
    if (!userId) {
      console.log('❌ No user ID from auth in quiet hours POST');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { household_id, enabled, start_time, end_time, days_of_week } = SetQuietHoursSchema.parse(body);

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('household_id', household_id)
      .eq('user_id', userId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 });
    }

    if (enabled) {
      // Upsert quiet hours settings
      const { data, error } = await supabase
        .from('quiet_hours')
        .upsert({
          household_id,
          start_time,
          end_time,
          days_of_week,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'household_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving quiet hours:', error);
        return NextResponse.json({ error: 'Failed to save quiet hours settings' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data,
        message: 'Quiet hours settings saved successfully'
      });
    } else {
      // Disable quiet hours
      const { error } = await supabase
        .from('quiet_hours')
        .update({ is_active: false })
        .eq('household_id', household_id);

      if (error) {
        console.error('Error disabling quiet hours:', error);
        return NextResponse.json({ error: 'Failed to disable quiet hours' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Quiet hours disabled successfully'
      });
    }
  } catch (error) {
    console.error('Error in POST /api/quiet-hours:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}