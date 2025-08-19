import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizeDeep, sanitizeText } from '@/lib/security/sanitize';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Create a Supabase client with service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('chores')
      .select('*')
      .eq('household_id', householdId)
      .order('due_at', { ascending: true });

    if (error) {
      console.error('Error fetching chores:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Exception in GET /api/chores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Sanitize input data
    const clean = sanitizeDeep(body, { description: 'rich' });
    const { 
      title, 
      description, 
      assigned_to, 
      due_at, 
      recurrence, 
      created_by, 
      household_id,
      category = 'general',
      priority = 'medium',
      ai_difficulty_rating,
      ai_estimated_duration,
      ai_preferred_time,
      ai_energy_level,
      ai_skill_requirements
    } = clean;

    if (!title || !created_by || !household_id) {
      return NextResponse.json({ error: 'Title, created_by, and household_id are required' }, { status: 400 });
    }

    const choreData = {
      title: sanitizeText(title),
      description: description || null, // Already sanitized as rich text
      assigned_to: assigned_to || null,
      due_at: due_at || null,
      recurrence: recurrence || null,
      category,
      priority,
      ai_difficulty_rating: ai_difficulty_rating || 50,
      ai_estimated_duration: ai_estimated_duration || 30,
      ai_preferred_time: ai_preferred_time || 'anytime',
      ai_energy_level: ai_energy_level || 'medium',
      ai_skill_requirements: ai_skill_requirements || [],
      ai_confidence: 75,
      ai_suggested: false,
      status: 'pending',
      created_by,
      household_id
    };

    console.log('Creating chore:', choreData);

    const { data, error } = await supabase
      .from('chores')
      .insert(choreData)
      .select()
      .single();

    if (error) {
      console.error('Error creating chore:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Successfully created chore:', data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Exception in POST /api/chores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 