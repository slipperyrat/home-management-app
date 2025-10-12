import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAuth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { canAccessFeatureFromEntitlements } from '@/lib/server/canAccessFeature';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient<Database> = createClient(supabaseUrl, supabaseKey);

const GetTemplatesSchema = z.object({
  household_id: z.string().uuid().optional(),
  template_type: z.enum(['school_term', 'sports_training', 'custom']).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { household_id, template_type } = GetTemplatesSchema.parse({
      household_id: searchParams.get('household_id'),
      template_type: searchParams.get('template_type'),
    });

    // Get user and verify household access
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If household_id is provided, verify access and check entitlements
    if (household_id) {
      // Verify user has access to this household
      const { data: membership, error: membershipError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('household_id', household_id)
        .eq('user_id', userId)
        .single();
      
      if (membershipError || !membership) {
        return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 });
      }

      // Get entitlements to check Pro access
      const { data: entitlements, error: entitlementsError } = await supabase
        .from('entitlements')
        .select('*')
        .eq('household_id', household_id)
        .single();

      if (entitlementsError || !entitlements) {
        return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
      }

      // Check if user can access calendar templates (Pro feature)
      if (!canAccessFeatureFromEntitlements(entitlements, 'calendar_templates')) {
        return NextResponse.json({ 
          error: 'Calendar templates require Pro plan',
          code: 'UPGRADE_REQUIRED'
        }, { status: 403 });
      }
    }

    // Build query
    let query = supabase
      .from('calendar_templates')
      .select('*')
      .eq('is_active', true);

    // Filter by household (NULL for global templates, specific ID for household templates)
    if (household_id) {
      query = query.or(`household_id.is.null,household_id.eq.${household_id}`);
    } else {
      // If no household_id provided, only show global templates
      query = query.is('household_id', null);
    }

    // Filter by template type if specified
    if (template_type) {
      query = query.eq('template_type', template_type);
    }

    const { data: templates, error } = await query.order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching calendar templates', error, { userId, householdId: household_id });
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    return NextResponse.json(templates || []);
  } catch (error) {
    logger.error('Error in GET /api/calendar-templates', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const CreateTemplateSchema = z.object({
  household_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  template_type: z.enum(['school_term', 'sports_training', 'custom']),
  rrule: z.string().min(1),
  events: z.array(z.object({
    title: z.string(),
    start: z.string(),
    end: z.string(),
    color: z.string().optional(),
    recurring: z.boolean().optional(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    logger.info('Creating calendar template');
    const body = await request.json();
    const { household_id, name, description, template_type, rrule, events } = CreateTemplateSchema.parse(body);

    // Get user and verify household access
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id, role')
      .eq('household_id', household_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 });
    }

    // All household members can create templates (Pro feature gated)
    // Role check removed - Pro access is verified through entitlements

    // Get entitlements to check Pro access
    const { data: entitlements, error: entitlementsError } = await supabase
      .from('entitlements')
      .select('*')
      .eq('household_id', household_id)
      .single();

    if (entitlementsError || !entitlements) {
      return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
    }

    // Check if user can access calendar templates (Pro feature)
    if (!canAccessFeatureFromEntitlements(entitlements, 'calendar_templates')) {
      return NextResponse.json({ 
        error: 'Calendar templates require Pro plan',
        code: 'UPGRADE_REQUIRED'
      }, { status: 403 });
    }

    // Create the template
    const { data: template, error: createError } = await supabase
      .from('calendar_templates')
      .insert({
        household_id,
        name,
        description,
        template_type,
        rrule,
        events,
      })
      .select()
      .single();

    if (createError) {
      logger.error('Error creating calendar template', createError, { userId, householdId: household_id });
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    // Log the creation for audit
    await supabase
      .from('audit_log')
      .insert({
        actor_id: userId,
        household_id,
        action: 'template.create',
        target_table: 'calendar_templates',
        target_id: template.id,
        meta: {
          template_name: name,
          template_type,
        }
      });

    return NextResponse.json(template);
  } catch (error) {
    logger.error('Error in POST /api/calendar-templates', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
