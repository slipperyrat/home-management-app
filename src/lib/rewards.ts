export async function getRewards(householdId: string) {
  try {
    const response = await fetch(`/api/rewards?householdId=${householdId}`);
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching rewards:', result.error);
      throw new Error(result.error || 'Failed to fetch rewards');
    }

    return result.data;
  } catch (err) {
    console.error('Exception in getRewards:', err);
    throw err;
  }
}

export async function addReward(reward: {
  title: string
  cost_xp: number
  household_id: string
  created_by: string
}) {
  try {
    console.log('Adding reward:', reward);
    
    const response = await fetch('/api/rewards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reward),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error adding reward:', result.error);
      throw new Error(result.error || 'Failed to add reward');
    }

    console.log('Successfully added reward:', result.data);
    return result.data;
  } catch (err) {
    console.error('Exception in addReward:', err);
    throw err;
  }
}

export async function redeemReward({
  rewardId,
  userId,
  cost
}: {
  rewardId: string
  userId: string
  cost: number
}) {
  try {
    console.log('Redeeming reward:', { rewardId, userId, cost });
    
    const response = await fetch('/api/rewards/redemptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rewardId, userId, cost }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error redeeming reward:', result.error);
      throw new Error(result.error || 'Failed to redeem reward');
    }

    console.log('Successfully redeemed reward:', result.data);
    return result.data;
  } catch (err) {
    console.error('Exception in redeemReward:', err);
    throw err;
  }
}

export async function getRedemptions(householdId: string) {
  try {
    const response = await fetch(`/api/rewards/redemptions?householdId=${householdId}`);
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching redemptions:', result.error);
      throw new Error(result.error || 'Failed to fetch redemptions');
    }

    console.log('Fetched redemptions:', result.data);
    return result.data;
  } catch (err) {
    console.error('Exception in getRedemptions:', err);
    throw err;
  }
} 