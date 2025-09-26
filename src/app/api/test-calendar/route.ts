import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/api/database';

export async function GET(request: NextRequest) {
  try {
    const supabase = getDatabaseClient();
    
    // Test if events table exists
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .limit(1);
    
    console.log('Events table test:', { events, eventsError });
    
    // Test if calendars table exists
    const { data: calendars, error: calendarsError } = await supabase
      .from('calendars')
      .select('*')
      .limit(1);
    
    console.log('Calendars table test:', { calendars, calendarsError });
    
    return NextResponse.json({
      events: { exists: !eventsError, error: eventsError?.message },
      calendars: { exists: !calendarsError, error: calendarsError?.message },
      message: 'Calendar tables test completed'
    });
    
  } catch (error) {
    console.error('Test calendar error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
