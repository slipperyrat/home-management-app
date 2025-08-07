export async function getLeaderboard(householdId: string) {
  try {
    console.log('Fetching leaderboard for household:', householdId);
    const response = await fetch(`/api/leaderboard?householdId=${householdId}`);
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Error fetching leaderboard:', result.error);
      throw new Error(result.error || 'Failed to fetch leaderboard');
    }
    
    console.log('Successfully fetched leaderboard:', result.data);
    return result.data;
  } catch (err) {
    console.error('Exception in getLeaderboard:', err);
    throw err;
  }
} 