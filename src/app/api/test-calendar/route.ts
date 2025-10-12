import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/api/database';
import { logger } from '@/lib/logging/logger';

export async function GET(_: NextRequest) {
  try {
    const supabase = getDatabaseClient();
    
    // Test if events table exists
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .limit(1);
    
    logger.info('Events table test', { hasRows: Boolean(events?.length), error: eventsError?.message });
    
    // Test if calendars table exists
    const { data: calendars, error: calendarsError } = await supabase
      .from('calendars')
      .select('*')
      .limit(1);
    
    logger.info('Calendars table test', { hasRows: Boolean(calendars?.length), error: calendarsError?.message });
    
    return NextResponse.json({
      events: { exists: !eventsError, error: eventsError?.message },
      calendars: { exists: !calendarsError, error: calendarsError?.message },
      message: 'Calendar tables test completed'
    });
    
  } catch (error) {
    logger.error('Test calendar error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
