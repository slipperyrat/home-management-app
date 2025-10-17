import { NextRequest } from 'next/server'
import { z } from 'zod'

import type { Database } from '@/types/supabase.generated'
import { getUserAndHousehold } from '@/lib/server/supabaseAdmin'
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection'
import { sanitizeDeep, sanitizeText } from '@/lib/security/sanitize'
import { logger } from '@/lib/logging/logger'
import { createSuccessResponse, createValidationErrorResponse, handleApiError } from '@/lib/api/errors'
import { plannerCreateSchema, plannerUpdateSchema } from '@/lib/validation/schemas'
import { getDatabaseClient } from '@/lib/api/database'

const plannerQuerySchema = z.object({
  category: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  priority: z.string().max(20).optional(),
})

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createValidationErrorResponse([{ path: ['user'], message: 'User not authenticated', code: 'custom' }])
      }
      const { householdId } = await getUserAndHousehold()

      const url = new URL(req.url)
      const queryValidation = plannerQuerySchema.safeParse(Object.fromEntries(url.searchParams))
      if (!queryValidation.success) {
        return createValidationErrorResponse(queryValidation.error.errors)
      }

      const { category, priority, status } = queryValidation.data
      const supabase = getDatabaseClient()

      let query = supabase
        .from('planner_items')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })

      if (category) query = query.eq('category', sanitizeText(category))
      if (status) query = query.eq('status', sanitizeText(status))
      if (priority) query = query.eq('priority', sanitizeText(priority))

      const { data, error } = await query
      if (error) {
        throw error
      }

      return createSuccessResponse({ items: data ?? [] }, 'Planner items fetched successfully')
    } catch (error) {
      return handleApiError(error, { route: '/api/planner', method: 'GET', userId: user?.id ?? '' })
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
  })
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createValidationErrorResponse([{ path: ['user'], message: 'User not authenticated', code: 'custom' }])
      }

      const { userId, householdId } = await getUserAndHousehold()

      const body = await req.json()
      const sanitizedBody = sanitizeDeep(body, { description: 'rich' })
      const validation = plannerCreateSchema.safeParse({ ...sanitizedBody, household_id: householdId })

      if (!validation.success) {
        return createValidationErrorResponse(validation.error.errors)
      }

      const payload = validation.data
      const supabase = getDatabaseClient()

      const insertPayload = {
        title: payload.title,
        category: payload.category ?? 'general',
        status: payload.status ?? 'pending',
        priority: payload.priority ?? 'medium',
        household_id: householdId,
        created_by: userId,
        description: payload.description ?? null,
        due_date: payload.due_date ?? null,
      } satisfies Database['public']['Tables']['planner_items']['Insert'];

      const { data, error } = await supabase
        .from('planner_items')
        .insert(insertPayload)
        .select('*')
        .maybeSingle()

      if (error || !data) {
        throw error ?? new Error('Failed to create planner item')
      }

      await logger.info('Planner item created', {
        userId,
        householdId,
        plannerItemId: data.id,
        securityEvent: false,
      })

      return createSuccessResponse({ item: data }, 'Planner item created', 201)
    } catch (error) {
      return handleApiError(error, { route: '/api/planner', method: 'POST', userId: user?.id ?? '' })
    }
  })
}

export async function PUT(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createValidationErrorResponse([{ path: ['user'], message: 'User not authenticated', code: 'custom' }])
      }

      const { householdId } = await getUserAndHousehold()
      const body = await req.json()
      const sanitizedBody = sanitizeDeep(body, { description: 'rich' })

      const validation = plannerUpdateSchema.safeParse(sanitizedBody)
      if (!validation.success) {
        return createValidationErrorResponse(validation.error.errors)
      }

      const { id, ...updates } = validation.data

      const supabase = getDatabaseClient()
      const updatePayload: Record<string, unknown> = {}
      if (updates.title !== undefined) updatePayload.title = updates.title
      if (updates.description !== undefined) updatePayload.description = updates.description ?? null
      if (updates.category !== undefined) updatePayload.category = updates.category ?? 'general'
      if (updates.due_date !== undefined) updatePayload.due_date = updates.due_date ?? null;
      if (updates.status !== undefined) updatePayload.status = updates.status ?? 'pending'
      if (updates.priority !== undefined) updatePayload.priority = updates.priority ?? 'medium'

      const { data, error } = await supabase
        .from('planner_items')
        .update(updatePayload)
        .eq('id', id)
        .eq('household_id', householdId)
        .select('*')
        .maybeSingle()

      if (error || !data) {
        throw error ?? new Error('Failed to update planner item')
      }

      return createSuccessResponse({ item: data }, 'Planner item updated')
    } catch (error) {
      return handleApiError(error, { route: '/api/planner', method: 'PUT', userId: user?.id ?? '' })
    }
  })
}

export async function DELETE(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createValidationErrorResponse([{ path: ['user'], message: 'User not authenticated', code: 'custom' }])
      }

      const { householdId } = await getUserAndHousehold()
      const url = new URL(req.url)
      const id = url.searchParams.get('id')

      if (!id) {
        return createValidationErrorResponse([
          {
            path: ['id'],
            message: 'id is required',
            code: 'custom',
          },
        ])
      }

      const supabase = getDatabaseClient()
      const { error } = await supabase
        .from('planner_items')
        .delete()
        .eq('id', id)
        .eq('household_id', householdId)

      if (error) {
        throw error
      }

      return createSuccessResponse({ id }, 'Planner item deleted')
    } catch (error) {
      return handleApiError(error, { route: '/api/planner', method: 'DELETE', userId: user?.id ?? '' })
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  })
}
