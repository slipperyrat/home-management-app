import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizeDeep, sanitizeText } from '@/lib/security/sanitize';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');

    if (!householdId) {
      return NextResponse.json({ error: 'householdId is required' }, { status: 400 });
    }

    console.log('Fetching calendar events for household:', householdId);

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('household_id', householdId)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching calendar events:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Successfully fetched calendar events:', data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Exception in calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Sanitize input data
    const clean = sanitizeDeep(body, { description: 'rich' });
    const { title, description, start_time, end_time, created_by, household_id } = clean;

    if (!title || !start_time || !end_time || !created_by || !household_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('Adding calendar event:', { title: sanitizeText(title), description, start_time, end_time });

    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        title: sanitizeText(title),
        description,
        start_time,
        end_time,
        created_by,
        household_id
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding calendar event:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Successfully added calendar event:', data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Exception in calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 