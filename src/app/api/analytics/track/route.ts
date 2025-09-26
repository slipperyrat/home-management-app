import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { createClient } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const event = await req.json();

      // Validate event structure
      if (!event.event || !event.timestamp) {
        return NextResponse.json({ error: 'Invalid event structure' }, { status: 400 });
      }

      const supabase = createClient();

      // Store analytics event in database
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          event_type: event.event,
          properties: event.properties || {},
          user_id: user.id,
          household_id: event.householdId,
          timestamp: event.timestamp,
          metadata: event.metadata || {},
        });

      if (error) {
        console.error('Error storing analytics event:', error);
        return NextResponse.json({ error: 'Failed to store event' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error processing analytics event:', error);
      return NextResponse.json({ error: 'Failed to process event' }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: false, // Analytics events don't need CSRF
    rateLimitConfig: 'analytics'
  });
}
