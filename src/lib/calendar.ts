export async function getCalendarEvents(household_id: string) {
  try {
    console.log('Fetching calendar events for household:', household_id);
    const response = await fetch(`/api/calendar?householdId=${household_id}`);
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Error fetching calendar events:', result.error);
      throw new Error(result.error || 'Failed to fetch calendar events');
    }
    
    console.log('Successfully fetched calendar events:', result.data);
    return result.data;
  } catch (err) {
    console.error('Exception in getCalendarEvents:', err);
    throw err;
  }
}

export async function addCalendarEvent(event: {
  title: string
  description?: string
  start_time: string
  end_time: string
  created_by: string
  household_id: string
}) {
  try {
    console.log('Adding calendar event:', event);
    const response = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Error adding calendar event:', result.error);
      throw new Error(result.error || 'Failed to add calendar event');
    }
    
    console.log('Successfully added calendar event:', result.data);
    return result.data;
  } catch (err) {
    console.error('Exception in addCalendarEvent:', err);
    throw err;
  }
}

export async function deleteCalendarEvent(id: string) {
  try {
    console.log('Deleting calendar event:', id);
    const response = await fetch(`/api/calendar/${id}`, {
      method: 'DELETE',
    });
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Error deleting calendar event:', result.error);
      throw new Error(result.error || 'Failed to delete calendar event');
    }
    
    console.log('Successfully deleted calendar event:', id);
    return result;
  } catch (err) {
    console.error('Exception in deleteCalendarEvent:', err);
    throw err;
  }
} 