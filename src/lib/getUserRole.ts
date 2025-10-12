import { createClient } from '@supabase/supabase-js'

import { logger } from '@/lib/logging/logger'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let cachedClient: ReturnType<typeof createClient<Database>> | null = null

function getSupabaseClient(): ReturnType<typeof createClient<Database>> | null {
  if (!supabaseUrl || !supabaseKey) {
    logger.error('Supabase environment variables not configured for getUserRole')
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient<Database>(supabaseUrl, supabaseKey)
  }

  return cachedClient
}

export async function getUserRole(userId: string): Promise<string | null> {
  if (!userId) {
    return null
  }

  const supabase = getSupabaseClient()

  if (!supabase) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('clerk_id', userId)
      .single()

    if (error) {
      logger.error(
        'Supabase error fetching user role',
        new Error(error.message),
        {
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId
        }
      )

      if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
        logger.info('User not found in database yet, returning default role', { userId })
        return 'member'
      }

      return 'member'
    }

    return data?.role || 'member'
  } catch (err) {
    logger.error('Exception in getUserRole', err as Error, { userId })
    return 'member'
  }
}