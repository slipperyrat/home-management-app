import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const { suggestionId, correctionType, correctionData, userNotes } = await request.json();

    // Validate required fields
    if (!suggestionId || !correctionType || !userNotes) {
      return NextResponse.json({ 
        error: 'Missing required fields: suggestionId, correctionType, userNotes' 
      }, { status: 400 });
    }

    // Validate correction type
    const validTypes = ['correct', 'mark_done', 'ignore', 'custom'];
    if (!validTypes.includes(correctionType)) {
      return NextResponse.json({ 
        error: 'Invalid correction type' 
      }, { status: 400 });
    }

    // Get the suggestion to validate it exists and get household info
    const { data: suggestion, error: suggestionError } = await supabase
      .from('ai_suggestions')
      .select(`
        id,
        household_id,
        ai_reasoning,
        suggestion_data,
        parsed_item:ai_parsed_items(
          confidence_score,
          ai_model_used
        )
      `)
      .eq('id', suggestionId)
      .single();

    if (suggestionError || !suggestion) {
      return NextResponse.json({ 
        error: 'Suggestion not found' 
      }, { status: 404 });
    }

    // Check if user has access to this household
    const { data: householdMember, error: memberError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .eq('household_id', suggestion.household_id)
      .single();

    if (memberError || !householdMember) {
      return NextResponse.json({ 
        error: 'Access denied to this household' 
      }, { status: 403 });
    }

    // Prepare correction data
    const correctionRecord = {
      household_id: suggestion.household_id,
      suggestion_id: suggestionId,
      correction_type: correctionType,
      correction_data: correctionData || null,
      user_notes: userNotes,
      ai_model_version: suggestion.parsed_item?.ai_model_used || 'unknown',
      confidence_score_before: suggestion.parsed_item?.confidence_score || null
    };

    // Insert the correction
    const { data: correction, error: insertError } = await supabase
      .from('ai_corrections')
      .insert(correctionRecord)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert correction:', insertError);
      return NextResponse.json({ 
        error: 'Failed to save correction' 
      }, { status: 500 });
    }

    // Update the suggestion's user_feedback status
    const feedbackStatus = correctionType === 'mark_done' ? 'completed' : 
                          correctionType === 'ignore' ? 'ignored' : 'corrected';

    const { error: updateError } = await supabase
      .from('ai_suggestions')
      .update({ user_feedback: feedbackStatus })
      .eq('id', suggestionId);

    if (updateError) {
      console.warn('Failed to update suggestion feedback status:', updateError);
      // Don't fail the whole request if this update fails
    }

    return NextResponse.json({ 
      success: true, 
      correction: {
        id: correction.id,
        correction_type: correction.correction_type,
        user_notes: correction.user_notes,
        corrected_at: correction.corrected_at
      }
    });

  } catch (error) {
    console.error('Error saving correction:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get household ID from query params
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('household_id');

    if (!householdId) {
      return NextResponse.json({ 
        error: 'household_id is required' 
      }, { status: 400 });
    }

    // Check if user has access to this household
    const { data: householdMember, error: memberError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .eq('household_id', householdId)
      .single();

    if (memberError || !householdMember) {
      return NextResponse.json({ 
        error: 'Access denied to this household' 
      }, { status: 403 });
    }

    // Get corrections for the household
    const { data: corrections, error: fetchError } = await supabase
      .from('ai_corrections')
      .select(`
        id,
        correction_type,
        correction_data,
        user_notes,
        corrected_at,
        ai_model_version,
        confidence_score_before,
        suggestion:ai_suggestions(
          suggestion_type,
          ai_reasoning
        )
      `)
      .eq('household_id', householdId)
      .order('corrected_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error('Failed to fetch corrections:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch corrections' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      corrections: corrections || [] 
    });

  } catch (error) {
    console.error('Error fetching corrections:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
