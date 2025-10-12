import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getUserAndHousehold } from '@/lib/server/supabaseAdmin'
import { withAPISecurity } from '@/lib/security/apiProtection'
import { sanitizeDeep, sanitizeText } from '@/lib/security/sanitize'
import { logger } from '@/lib/logging/logger'
import { createSuccessResponse, createValidationErrorResponse, handleApiError } from '@/lib/api/errors'
import { plannerCreateSchema, plannerUpdateSchema } from '@/lib/validation/schemas'
import { getDatabaseClient } from '@/lib/api/database'

const plannerQuerySchema = z.object({
  category: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  priority: z.string().max(20).optional()
})

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
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
      return handleApiError(error, { route: '/api/planner', method: 'GET', userId: user?.id })
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  })
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { userId, householdId } = await getUserAndHousehold()

      const body = await req.json()
      const sanitizedBody = sanitizeDeep(body, { description: 'rich' })
      const validation = plannerCreateSchema.safeParse({ ...sanitizedBody, household_id: householdId })

      if (!validation.success) {
        return createValidationErrorResponse(validation.error.errors)
      }

      const payload = validation.data
      const supabase = getDatabaseClient()

      const { data, error } = await supabase
        .from('planner_items')
        .insert([{ ...payload, created_by: userId }])
        .select('*')
        .single()

      if (error) {
        throw error
      }

      await logger.info('Planner item created', {
        userId,
        householdId,
        plannerItemId: data.id,
        securityEvent: false
      })

      return createSuccessResponse({ item: data }, 'Planner item created', 201)
    } catch (error) {
      return handleApiError(error, { route: '/api/planner', method: 'POST', userId: user?.id })
    }
  })
}

export async function PUT(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { householdId } = await getUserAndHousehold()
      const body = await req.json()
      const sanitizedBody = sanitizeDeep(body, { description: 'rich' })

      const validation = plannerUpdateSchema.safeParse(sanitizedBody)
      if (!validation.success) {
        return createValidationErrorResponse(validation.error.errors)
      }

      const { id, ...updates } = validation.data

      const supabase = getDatabaseClient()
      const { data, error } = await supabase
        .from('planner_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('household_id', householdId)
        .select('*')
        .single()

      if (error) {
        throw error
      }

      return createSuccessResponse({ item: data }, 'Planner item updated')
    } catch (error) {
      return handleApiError(error, { route: '/api/planner', method: 'PUT', userId: user?.id })
    }
  })
}

export async function DELETE(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { householdId } = await getUserAndHousehold()
      const url = new URL(req.url)
      const id = url.searchParams.get('id')

      if (!id) {
        return createValidationErrorResponse([
          {
            path: ['id'],
            message: 'id is required',
            code: 'custom'
          }
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
      return handleApiError(error, { route: '/api/planner', method: 'DELETE', userId: user?.id })
    }
  }, {
    requireCSRF: true
  })
}
