import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import type { ChoreRow } from '@/types/database';
import { logger } from '@/lib/logging/logger';
import type { Json } from '@/types/supabase.generated';

const supabase = createSupabaseAdminClient();

type ChoreAssignmentStrategyName = 'round_robin' | 'fairness' | 'preference' | 'ai_hybrid';

export interface ChoreInput extends ChoreRow {
  ai_difficulty_rating: number;
  ai_energy_level: 'low' | 'medium' | 'high';
  category: string;
}

export interface ChoreAssignmentData {
  choreId: string;
  assignedTo: string;
  strategy: ChoreAssignmentStrategyName;
  confidence: number;
  reasoning: string;
  workloadImpact: number;
}

export interface UserWorkload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  totalChores: number;
  pendingChores: number;
  completedToday: number;
  averageDifficulty: number;
  preferredCategories: string[];
  energyLevel: 'low' | 'medium' | 'high';
  lastAssigned: Date | null;
}

export interface AssignmentStrategy {
  name: ChoreAssignmentStrategyName;
  description: string;
  algorithm: (chore: ChoreInput, users: UserWorkload[]) => ChoreAssignmentData;
}

const roundRobinAssignment: AssignmentStrategy = {
  name: 'round_robin',
  description: 'Assigns chores in a rotating order to ensure equal distribution',
  algorithm: (chore, users) => {
    if (users.length === 0) {
      throw new Error('No users available for assignment');
    }

    const lastAssignedUser = users.reduce((prev, current) => {
      if (!prev.lastAssigned) return current;
      if (!current.lastAssigned) return prev;
      return prev.lastAssigned > current.lastAssigned ? prev : current;
    });

    const currentIndex = users.findIndex((u) => u.userId === lastAssignedUser.userId);
    const nextIndex = (currentIndex + 1) % users.length;
    const nextUser = users[nextIndex];

    if (!nextUser) {
      throw new Error('No user found for assignment');
    }

    return {
      choreId: chore.id,
      assignedTo: nextUser.userId,
      strategy: 'round_robin',
      confidence: 85,
      reasoning: `Round-robin assignment: ${nextUser.firstName} is next in rotation`,
      workloadImpact: nextUser.totalChores + 1,
    };
  },
};

const fairnessBasedAssignment: AssignmentStrategy = {
  name: 'fairness',
  description: 'Assigns chores to balance workload across all users',
  algorithm: (chore, users) => {
    if (users.length === 0) {
      throw new Error('No users available for assignment');
    }

    const workloadScores = users.map((user) => ({
      user,
      score: (user.totalChores * 2) + (user.pendingChores * 3) + (user.averageDifficulty / 20),
    }));

    workloadScores.sort((a, b) => a.score - b.score);
    const bestEntry = workloadScores[0];
    if (!bestEntry) {
      throw new Error('No users available for workload balancing');
    }
    const bestUser = bestEntry.user;

    return {
      choreId: chore.id,
      assignedTo: bestUser.userId,
      strategy: 'fairness',
      confidence: 90,
      reasoning: `${bestUser.firstName} has the lowest current workload (${bestUser.totalChores} total, ${bestUser.pendingChores} pending)` ,
      workloadImpact: bestUser.totalChores + 1,
    };
  },
};

const preferenceBasedAssignment: AssignmentStrategy = {
  name: 'preference',
  description: 'Assigns chores based on user preferences and category affinity',
  algorithm: (chore, users) => {
    if (users.length === 0) {
      throw new Error('No users available for assignment');
    }

    const userScores = users.map((user) => {
      let score = 0;

      if (user.preferredCategories.includes(chore.category ?? '')) {
        score += 50;
      }

      score -= (user.totalChores * 10);
      score -= (user.pendingChores * 15);

      if (chore.ai_energy_level === user.energyLevel) {
        score += 30;
      }

      const difficultyDiff = Math.abs((chore.ai_difficulty_rating ?? 50) - user.averageDifficulty);
      score -= difficultyDiff / 2;

      return { user, score };
    });

    userScores.sort((a, b) => b.score - a.score);
    const topEntry = userScores[0];
    if (!topEntry) {
      throw new Error('No users scored for preference-based assignment');
    }
    const bestUser = topEntry.user;

    return {
      choreId: chore.id,
      assignedTo: bestUser.userId,
      strategy: 'preference',
      confidence: 80,
      reasoning: `${bestUser.firstName} has high preference for ${(chore.category ?? 'general')} tasks and suitable energy level`,
      workloadImpact: bestUser.totalChores + 1,
    };
  },
};

const aiHybridAssignment: AssignmentStrategy = {
  name: 'ai_hybrid',
  description: 'Combines multiple factors for optimal assignment using machine learning principles',
  algorithm: (chore, users) => {
    if (users.length === 0) {
      throw new Error('No users available for assignment');
    }

    const userScores = users.map((user) => {
      let score = 0;

      const workloadScore = Math.max(0, 100 - (user.totalChores * 15) - (user.pendingChores * 20));
      score += workloadScore * 0.4;

      const categoryScore = user.preferredCategories.includes(chore.category ?? '') ? 100 : 0;
      score += categoryScore * 0.25;

      const energyScore = chore.ai_energy_level === user.energyLevel ? 100 : (chore.ai_energy_level === 'medium' ? 70 : 40);
      score += energyScore * 0.2;

      const difficultyScore = Math.max(0, 100 - Math.abs((chore.ai_difficulty_rating ?? 50) - user.averageDifficulty));
      score += difficultyScore * 0.15;

      if (user.lastAssigned) {
        const hoursSinceLastAssignment = (Date.now() - user.lastAssigned.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastAssignment > 24) {
          score += 20;
        }
      }

      return { user, score };
    });

    userScores.sort((a, b) => b.score - a.score);
    const topEntry = userScores[0];
    if (!topEntry) {
      throw new Error('No users available for hybrid assignment');
    }
    const bestUser = topEntry.user;
    const confidence = Math.min(95, Math.max(60, topEntry.score));

    return {
      choreId: chore.id,
      assignedTo: bestUser.userId,
      strategy: 'ai_hybrid',
      confidence: Math.round(confidence),
      reasoning: `AI hybrid analysis: ${bestUser.firstName} scored highest (${Math.round(topEntry.score)}) based on workload balance, preferences, and compatibility`,
      workloadImpact: bestUser.totalChores + 1,
    };
  },
};

export const assignmentStrategies: Record<ChoreAssignmentStrategyName, AssignmentStrategy> = {
  round_robin: roundRobinAssignment,
  fairness: fairnessBasedAssignment,
  preference: preferenceBasedAssignment,
  ai_hybrid: aiHybridAssignment,
};

export async function assignChore(
  chore: ChoreInput,
  strategy: ChoreAssignmentStrategyName,
  householdId: string,
): Promise<ChoreAssignmentData> {
  try {
    const users = await getHouseholdUsersWithWorkload(householdId);

    if (users.length === 0) {
      throw new Error('No users found in household');
    }

    const selectedStrategy = assignmentStrategies[strategy] || assignmentStrategies.ai_hybrid;
    const assignment = selectedStrategy.algorithm(chore, users);

    await logAssignmentDecision(chore.id, assignment, users);

    return assignment;
  } catch (error) {
    logger.error('Error in chore assignment', error as Error, { householdId });
    throw error;
  }
}

async function getHouseholdUsersWithWorkload(householdId: string): Promise<UserWorkload[]> {
  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('household_id', householdId);

    if (usersError) throw usersError;

    const usersWithWorkload = await Promise.all(
      users.map(async (user) => {
        const { data: userChores, error: choresError } = await supabase
          .from('chores')
          .select('*')
          .eq('assigned_to', user.id);

        if (choresError) throw choresError;

        const { data: preferences, error: prefError } = await supabase
          .from('chore_preferences')
          .select('*')
          .eq('user_id', user.id);

        if (prefError) throw prefError;

        const totalChores = userChores?.length || 0;
        const pendingChores = userChores?.filter((c) => c.status === 'pending').length || 0;
        const completedToday = userChores?.filter((c) =>
          c.status === 'completed' &&
          new Date(c.updated_at ?? '').toDateString() === new Date().toDateString()
        ).length || 0;

        const averageDifficulty = userChores?.length || 0
          ? userChores.reduce((sum, c) => sum + (c.ai_difficulty_rating ?? 50), 0) / userChores.length
          : 50;

        const preferredCategories = preferences?.map((p) => p.chore_category) || [];
        const energyLevel = preferences?.[0]?.energy_preference ?? 'medium';

        const lastAssigned = userChores?.length
          ? new Date(Math.max(...userChores.map((c) => new Date(c.updated_at ?? '').getTime())))
          : null;

        return {
          userId: user.id,
          email: user.email ?? '',
          firstName: user.first_name ?? '',
          lastName: user.last_name ?? '',
          totalChores,
          pendingChores,
          completedToday,
          averageDifficulty,
          preferredCategories,
          energyLevel: energyLevel as 'low' | 'medium' | 'high',
          lastAssigned,
        };
      })
    );

    return usersWithWorkload;
  } catch (error) {
    logger.error('Error getting users with workload', error as Error, { householdId });
    throw error;
  }
}

async function logAssignmentDecision(
  choreId: string,
  assignment: ChoreAssignmentData,
  users: UserWorkload[],
): Promise<void> {
  try {
    const insightData = {
      chore_id: choreId,
      assignment: {
        choreId: assignment.choreId,
        assignedTo: assignment.assignedTo,
        strategy: assignment.strategy,
        confidence: assignment.confidence,
        reasoning: assignment.reasoning,
        workloadImpact: assignment.workloadImpact,
      },
      available_users: users.map((u) => ({
        id: u.userId,
        workload: u.totalChores,
        preferences: u.preferredCategories,
      })),
      timestamp: new Date().toISOString(),
    } satisfies Json;

    const { error } = await supabase
      .from('chore_ai_insights')
      .insert({
        insight_type: 'assignment',
        insight_data: insightData,
        ai_confidence: assignment.confidence,
        generated_at: new Date().toISOString(),
      });

    if (error) {
      logger.warn('Error logging assignment decision', {
        choreId,
        error: error.message,
        code: error.code,
      });
    }
  } catch (error) {
    logger.warn('Exception logging assignment decision', {
      choreId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function getAssignmentRecommendations(
  chore: ChoreInput,
  householdId: string,
): Promise<ChoreAssignmentData[]> {
  try {
    const recommendations: ChoreAssignmentData[] = [];

    for (const [strategyName, strategy] of Object.entries(assignmentStrategies)) {
      try {
        const users = await getHouseholdUsersWithWorkload(householdId);
        const assignment = strategy.algorithm(chore, users);
        recommendations.push(assignment);
      } catch (error) {
        logger.warn('Error getting assignment recommendation', {
          strategy: strategyName,
          householdId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    recommendations.sort((a, b) => b.confidence - a.confidence);

    return recommendations;
  } catch (error) {
    logger.error('Error getting assignment recommendations', error as Error, { householdId });
    throw error;
  }
}
