export async function getChores(householdId: string) {
  try {
    const response = await fetch(`/api/chores?householdId=${householdId}`);
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching chores:', result.error);
      throw new Error(result.error || 'Failed to fetch chores');
    }

    return result.data;
  } catch (err) {
    console.error('Exception in getChores:', err);
    throw err;
  }
}

export async function addChore(chore: {
  title: string
  description?: string
  assigned_to?: string
  due_at?: string
  recurrence?: string
  created_by: string
  household_id: string
}) {
  try {
    console.log('Adding chore:', chore);
    
    const response = await fetch('/api/chores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chore),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error adding chore:', result.error);
      throw new Error(result.error || 'Failed to add chore');
    }

    console.log('Successfully added chore:', result.data);
    return result.data;
  } catch (err) {
    console.error('Exception in addChore:', err);
    throw err;
  }
}

export async function completeChore({
  choreId,
  userId,
  xp = 10
}: {
  choreId: string
  userId: string
  xp?: number
}) {
  try {
    console.log('Completing chore:', { choreId, userId, xp });
    
    const response = await fetch('/api/chores/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ choreId, userId, xp }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error completing chore:', result.error);
      throw new Error(result.error || 'Failed to complete chore');
    }

    console.log('Successfully completed chore:', result.data);
    return result.data;
  } catch (err) {
    console.error('Exception in completeChore:', err);
    throw err;
  }
}

export async function getChoreCompletions(householdId: string) {
  try {
    const response = await fetch(`/api/chores/completions?householdId=${householdId}`);
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching chore completions:', result.error);
      throw new Error(result.error || 'Failed to fetch chore completions');
    }

    console.log('Fetched chore completions:', result.data);
    return result.data;
  } catch (err) {
    console.error('Exception in getChoreCompletions:', err);
    throw err;
  }
} 