import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logging/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    logger.info('Deleting calendar event', { eventId: id });

    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting calendar event', error, { eventId: id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.info('Successfully deleted calendar event', { eventId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Exception in calendar delete API', error instanceof Error ? error : new Error(String(error)), { eventId: (await params).id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 