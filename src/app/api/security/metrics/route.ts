import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { logger, createRequestLogger } from '@/lib/logging/logger';

export async function GET() {
  const requestId = logger.generateRequestId();
  const log = createRequestLogger(requestId);
  
  try {
    log.apiCall('GET', '/api/security/metrics');
    
    // Get authenticated user
    const clerkUser = await currentUser();
    if (!clerkUser) {
      log.apiError('GET', '/api/security/metrics', new Error('Unauthorized'), { status: 401 });
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
      log.apiError('GET', '/api/security/metrics', new Error('Forbidden'), { status: 403 });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch security metrics from the security_dashboard view
    const { data: metrics, error } = await supabase
      .from('security_dashboard')
      .select('*');

    if (error) {
      log.error('Failed to fetch security metrics', error, { userId: clerkUser.id });
      return NextResponse.json({ error: 'Failed to fetch security metrics' }, { status: 500 });
    }

    log.apiSuccess('GET', '/api/security/metrics', { userId: clerkUser.id, metricsCount: metrics?.length || 0 });
    
    return NextResponse.json(metrics || []);
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    log.apiError('GET', '/api/security/metrics', err);
    
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
