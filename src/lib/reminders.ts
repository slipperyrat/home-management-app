import { supabase } from './supabaseClient'

export async function getReminders(household_id: string) {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('household_id', household_id)
    .order('remind_at', { ascending: true })

  if (error) throw error
  return data
}

export async function addReminder(reminder: {
  title: string
  related_type: 'chore' | 'calendar_event'
  related_id: string
  remind_at: string
  created_by: string
  household_id: string
}) {
  const { data, error } = await supabase
    .from('reminders')
    .insert(reminder)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteReminder(id: string) {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)

  if (error) throw error
  return { success: true }
} 