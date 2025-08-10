import { NextResponse } from 'next/server'
import { sb, getUserAndHousehold } from '@/lib/server/supabaseAdmin'
import { sanitizeDeep, sanitizeText } from '@/lib/security/sanitize'

export async function GET(req: Request) {
  try {
    const { householdId } = await getUserAndHousehold()
    const url = new URL(req.url)
    // Sanitize query parameters to prevent injection
    const category = url.searchParams.get('category') ? sanitizeText(url.searchParams.get('category')!) : undefined
    const status = url.searchParams.get('status') ? sanitizeText(url.searchParams.get('status')!) : undefined
    const priority = url.searchParams.get('priority') ? sanitizeText(url.searchParams.get('priority')!) : undefined

    const supabase = sb()
    let q = supabase.from('planner_items').select('*').eq('household_id', householdId).order('created_at', { ascending: false })
    if (category) q = q.eq('category', category)
    if (status) q = q.eq('status', status)
    if (priority) q = q.eq('priority', priority)

    const { data, error } = await q
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}

export async function POST(req: Request) {
  try {
    console.log('🔍 POST /api/planner - Starting request');
    const { userId, householdId } = await getUserAndHousehold()
    console.log('✅ Got user data:', { userId, householdId });
    
    const body = await req.json()
    console.log('📝 Request body:', body);
    
    // Sanitize input data
    const clean = sanitizeDeep(body, { description: 'rich' });
    
    const { 
      category: rawCategory, 
      title, 
      description = null, 
      status: rawStatus = 'planning', 
      priority: rawPriority = 'medium', 
      due_date = null 
    } = clean || {}
    
    if (!rawCategory || !title) return NextResponse.json({ error: 'category and title required' }, { status: 400 })

    // Sanitize enum-like fields to prevent injection
    const category = sanitizeText(rawCategory);
    const status = sanitizeText(rawStatus);
    const priority = sanitizeText(rawPriority);

    const insertData = { household_id: householdId, category, title, description, status, priority, due_date, created_by: userId };
    console.log('📊 Insert data:', insertData);

    const supabase = sb()
    const { data, error } = await supabase
      .from('planner_items')
      .insert([insertData])
      .select('*').single()
    
    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }
    
    console.log('✅ Created planner item:', data);
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    console.error('❌ POST /api/planner error:', e);
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const { householdId } = await getUserAndHousehold()
    const body = await req.json()
    
    // Sanitize input data
    const clean = sanitizeDeep(body, { description: 'rich' });
    
    const { id, ...rawUpdates } = clean || {}
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    
    // Process and sanitize updates
    const updates: any = {};
    Object.keys(rawUpdates).forEach(key => {
      if (key === 'household_id') {
        // Never allow changing household_id
        return;
      } else if (key === 'description') {
        // Description is already sanitized as rich text by sanitizeDeep
        updates[key] = rawUpdates[key];
      } else if (['category', 'status', 'priority', 'title'].includes(key)) {
        // Sanitize string fields that should be plain text
        updates[key] = sanitizeText(rawUpdates[key]);
      } else {
        // For other fields (like due_date, created_at, etc.), pass through as-is
        updates[key] = rawUpdates[key];
      }
    });

    const supabase = sb()
    const { data, error } = await supabase
      .from('planner_items')
      .update(updates)
      .eq('id', id)
      .eq('household_id', householdId)
      .select('*').single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { householdId } = await getUserAndHousehold()
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = sb()
    const { error } = await supabase.from('planner_items').delete().eq('id', id).eq('household_id', householdId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}
