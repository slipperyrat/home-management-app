import { createClient } from '@supabase/supabase-js'

// You may want to use environment variables for these
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

const supabase = createClient(supabaseUrl, supabaseKey)

export async function getUserRole(userId: string) {
  if (!userId) return null

  // Check if environment variables are set
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase environment variables not configured')
    return null
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('clerk_id', userId)
      .single()

    if (error) {
      // Log the full error details for debugging
      console.log('Supabase error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // If user doesn't exist in database yet, return default role
      if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
        console.log('User not found in database yet, returning default role')
        return 'member' // Default role for new users
      }
      
      // For any other error, just return default role without logging the error
      return 'member' // Default to member role if there's an error
    }

    return data?.role || 'member' // Default to member role if no role is set
  } catch (err) {
    console.error('Exception in getUserRole:', err)
    return 'member' // Default to member role on exception
  }
} 