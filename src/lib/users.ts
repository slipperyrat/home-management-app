import { logger } from '@/lib/logging/logger';

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  xp: number;
  rank: number;
}

interface LeaderboardResponse {
  data?: LeaderboardEntry[];
  error?: string;
}

export async function getLeaderboard(householdId: string): Promise<LeaderboardEntry[]> {
  try {
    logger.info('Fetching leaderboard for household', { householdId });
    const response = await fetch(`/api/leaderboard?householdId=${householdId}`);
    const result = (await response.json()) as LeaderboardResponse;

    if (!response.ok) {
      const errorMessage = result.error || 'Failed to fetch leaderboard';
      logger.error('Error fetching leaderboard', new Error(errorMessage), { householdId });
      throw new Error(errorMessage);
    }

    const leaderboard = result.data ?? [];
    logger.info('Successfully fetched leaderboard', { householdId, entries: leaderboard.length });
    return leaderboard;
  } catch (err) {
    logger.error('Exception in getLeaderboard', err as Error, { householdId });
    throw err;
  }
}