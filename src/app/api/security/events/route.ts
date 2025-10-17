import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { logger, createRequestLogger } from '@/lib/logging/logger';

export async function GET(req: NextRequest) {
  const requestId = logger.generateRequestId();
  const log = createRequestLogger(requestId);
  
  try {
    log.apiCall('GET', '/api/security/events');
    
    // Get authenticated user
    const clerkUser = await currentUser();
    if (!clerkUser) {
      log.apiError('GET', '/api/security/events', new Error('Unauthorized'), { status: 401 });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Supabase client
    const supabase = createServerComponentClient({ cookies });
    
    // Check if user is admin (you can customize this logic)
    const { data: userRole } = await supabase
      .from('users')
      .select('role')
      .eq('id', clerkUser.id)
      .single();

    if (userRole?.role !== 'admin') {
      log.apiError('GET', '/api/security/events', new Error('Forbidden'), { status: 403 });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const eventType = searchParams.get('type');
    const severity = searchParams.get('severity');

    // Build query
    let query = supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100)); // Cap at 100 for security

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data: events, error } = await query;

    if (error) {
      log.error('Failed to fetch security events', error, { userId: clerkUser.id });
      return NextResponse.json({ error: 'Failed to fetch security events' }, { status: 500 });
    }

    log.apiSuccess('GET', '/api/security/events', { 
      userId: clerkUser.id, 
      eventsCount: events?.length || 0,
      filters: { eventType, severity, limit }
    });
    
    return NextResponse.json(events || []);
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    log.apiError('GET', '/api/security/events', err);
 
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
