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

const TemplateIdSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = TemplateIdSchema.parse({ id: (await params).id });

    // Get user
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from('calendar_templates')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // If it's a household template, verify access
    if (template.household_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('household_id', template.household_id)
        .eq('user_id', userId)
        .single();
      
      if (membershipError || !membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Check entitlements for household templates
      const { data: entitlements, error: entitlementsError } = await supabase
        .from('entitlements')
        .select('*')
        .eq('household_id', template.household_id)
        .single();

      if (entitlementsError || !entitlements) {
        return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
      }

      if (!canAccessFeatureFromEntitlements(entitlements, 'calendar_templates')) {
        return NextResponse.json({ 
          error: 'Calendar templates require Pro plan',
          code: 'UPGRADE_REQUIRED'
        }, { status: 403 });
      }
    }

    return NextResponse.json(template);
  } catch (error) {
    logger.error('Error in GET /api/calendar-templates/[id]', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  template_type: z.enum(['school_term', 'sports_training', 'custom']).optional(),
  rrule: z.string().min(1).optional(),
  events: z.array(z.object({
    title: z.string(),
    start: z.string(),
    end: z.string(),
    color: z.string().optional(),
    recurring: z.boolean().optional(),
  })).optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = TemplateIdSchema.parse({ id: (await params).id });
    const body = await request.json();
    let updateData = UpdateTemplateSchema.parse(body);

    // Get user
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from('calendar_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // If it's a household template, verify access and permissions
    if (template.household_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('household_members')
        .select('household_id, role')
        .eq('household_id', template.household_id)
        .eq('user_id', userId)
        .single();
      
      if (membershipError || !membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // All household members can update templates (Pro feature gated)
      // Role check removed - Pro access is verified through entitlements

      // Check entitlements
      const { data: entitlements, error: entitlementsError } = await supabase
        .from('entitlements')
        .select('*')
        .eq('household_id', template.household_id)
        .single();

      if (entitlementsError || !entitlements) {
        return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
      }

      if (!canAccessFeatureFromEntitlements(entitlements, 'calendar_templates')) {
        return NextResponse.json({ 
          error: 'Calendar templates require Pro plan',
          code: 'UPGRADE_REQUIRED'
        }, { status: 403 });
      }
    } else {
      // Global templates - only allow updates to is_active for now
      if (Object.prototype.hasOwnProperty.call(updateData, 'is_active')) {
        updateData = { is_active: updateData.is_active };
      } else {
        updateData = {};
      }
    }

    // Update the template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from('calendar_templates')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating calendar template', updateError, { templateId: id, userId });
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    // Log the update for audit
    await supabase
      .from('audit_log')
      .insert({
        actor_id: userId,
        household_id: template.household_id,
        action: 'template.update',
        target_table: 'calendar_templates',
        target_id: id,
        meta: {
          updated_fields: Object.keys(updateData),
        }
      });

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    logger.error('Error in PUT /api/calendar-templates/[id]', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = TemplateIdSchema.parse({ id: (await params).id });

    // Get user
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from('calendar_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // If it's a household template, verify access and permissions
    if (template.household_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('household_members')
        .select('household_id, role')
        .eq('household_id', template.household_id)
        .eq('user_id', userId)
        .single();
      
      if (membershipError || !membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

    // All household members can delete templates (Pro feature gated)
    // Role check removed - Pro access is verified through entitlements

      // Check entitlements
      const { data: entitlements, error: entitlementsError } = await supabase
        .from('entitlements')
        .select('*')
        .eq('household_id', template.household_id)
        .single();

      if (entitlementsError || !entitlements) {
        return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
      }

      if (!canAccessFeatureFromEntitlements(entitlements, 'calendar_templates')) {
        return NextResponse.json({ 
          error: 'Calendar templates require Pro plan',
          code: 'UPGRADE_REQUIRED'
        }, { status: 403 });
      }
    } else {
      // Global templates cannot be deleted
      return NextResponse.json({ error: 'Cannot delete global templates' }, { status: 403 });
    }

    // Soft delete the template
    const { error: deleteError } = await supabase
      .from('calendar_templates')
      .update({ is_active: false })
      .eq('id', id);

    if (deleteError) {
      logger.error('Error deleting calendar template', deleteError, { templateId: id, userId });
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    // Log the deletion for audit
    await supabase
      .from('audit_log')
      .insert({
        actor_id: userId,
        household_id: template.household_id,
        action: 'template.delete',
        target_table: 'calendar_templates',
        target_id: id,
        meta: {
          template_name: template.name,
        }
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/calendar-templates/[id]', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
