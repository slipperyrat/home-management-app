import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface ChoreAssignmentData {
  choreId: string;
  assignedTo: string;
  strategy: string;
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
  name: string;
  description: string;
  algorithm: (chore: any, users: UserWorkload[]) => ChoreAssignmentData;
}

// Round Robin Algorithm
const roundRobinAssignment: AssignmentStrategy = {
  name: 'round_robin',
  description: 'Assigns chores in a rotating order to ensure equal distribution',
  algorithm: (chore: any, users: UserWorkload[]): ChoreAssignmentData => {
    if (users.length === 0) {
      throw new Error('No users available for assignment');
    }

    // Find the user who was assigned the most recent chore
    const lastAssignedUser = users.reduce((prev, current) => {
      if (!prev.lastAssigned) return current;
      if (!current.lastAssigned) return prev;
      return prev.lastAssigned > current.lastAssigned ? prev : current;
    });

    // Get the next user in rotation
    const currentIndex = users.findIndex(u => u.userId === lastAssignedUser.userId);
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
      workloadImpact: nextUser.totalChores + 1
    };
  }
};

// Fairness-based Algorithm
const fairnessBasedAssignment: AssignmentStrategy = {
  name: 'fairness',
  description: 'Assigns chores to balance workload across all users',
  algorithm: (chore: any, users: UserWorkload[]): ChoreAssignmentData => {
    if (users.length === 0) {
      throw new Error('No users available for assignment');
    }

    // Calculate workload scores (lower is better)
    const workloadScores = users.map(user => ({
      user,
      score: (user.totalChores * 2) + (user.pendingChores * 3) + (user.averageDifficulty / 20)
    }));

    // Sort by workload score (ascending)
    workloadScores.sort((a, b) => a.score - b.score);

    // Get the user with the lowest workload
    const bestUser = workloadScores[0].user;

    return {
      choreId: chore.id,
      assignedTo: bestUser.userId,
      strategy: 'fairness',
      confidence: 90,
      reasoning: `${bestUser.firstName} has the lowest current workload (${bestUser.totalChores} total, ${bestUser.pendingChores} pending)`,
      workloadImpact: bestUser.totalChores + 1
    };
  }
};

// Preference-based Algorithm
const preferenceBasedAssignment: AssignmentStrategy = {
  name: 'preference',
  description: 'Assigns chores based on user preferences and category affinity',
  algorithm: (chore: any, users: UserWorkload[]): ChoreAssignmentData => {
    if (users.length === 0) {
      throw new Error('No users available for assignment');
    }

    // Score users based on preferences and workload
    const userScores = users.map(user => {
      let score = 0;
      
      // Category preference bonus
      if (user.preferredCategories.includes(chore.category)) {
        score += 50;
      }
      
      // Workload penalty (fewer chores = better score)
      score -= (user.totalChores * 10);
      score -= (user.pendingChores * 15);
      
      // Energy level matching
      if (chore.ai_energy_level === user.energyLevel) {
        score += 30;
      }
      
      // Difficulty preference
      const difficultyDiff = Math.abs(chore.ai_difficulty_rating - user.averageDifficulty);
      score -= difficultyDiff / 2;
      
      return { user, score };
    });

    // Sort by score (descending)
    userScores.sort((a, b) => b.score - a.score);
    const bestUser = userScores[0].user;

    return {
      choreId: chore.id,
      assignedTo: bestUser.userId,
      strategy: 'preference',
      confidence: 80,
      reasoning: `${bestUser.firstName} has high preference for ${chore.category} tasks and suitable energy level`,
      workloadImpact: bestUser.totalChores + 1
    };
  }
};

// AI-powered Hybrid Algorithm
const aiHybridAssignment: AssignmentStrategy = {
  name: 'ai_hybrid',
  description: 'Combines multiple factors for optimal assignment using machine learning principles',
  algorithm: (chore: any, users: UserWorkload[]): ChoreAssignmentData => {
    if (users.length === 0) {
      throw new Error('No users available for assignment');
    }

    // Multi-factor scoring system
    const userScores = users.map(user => {
      let score = 0;
      
      // 1. Workload Balance (40% weight)
      const workloadScore = Math.max(0, 100 - (user.totalChores * 15) - (user.pendingChores * 20));
      score += workloadScore * 0.4;
      
      // 2. Category Preference (25% weight)
      const categoryScore = user.preferredCategories.includes(chore.category) ? 100 : 0;
      score += categoryScore * 0.25;
      
      // 3. Energy Level Match (20% weight)
      const energyScore = chore.ai_energy_level === user.energyLevel ? 100 : 
                         (chore.ai_energy_level === 'medium' ? 70 : 40);
      score += energyScore * 0.2;
      
      // 4. Difficulty Compatibility (15% weight)
      const difficultyScore = Math.max(0, 100 - Math.abs(chore.ai_difficulty_rating - user.averageDifficulty));
      score += difficultyScore * 0.15;
      
      // 5. Recent Activity Bonus (penalty for being idle)
      if (user.lastAssigned) {
        const hoursSinceLastAssignment = (Date.now() - user.lastAssigned.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastAssignment > 24) {
          score += 20; // Bonus for users who haven't been assigned recently
        }
      }
      
      return { user, score };
    });

    // Sort by score (descending)
    userScores.sort((a, b) => b.score - a.score);
    const bestUser = userScores[0].user;
    const confidence = Math.min(95, Math.max(60, userScores[0].score));

    return {
      choreId: chore.id,
      assignedTo: bestUser.userId,
      strategy: 'ai_hybrid',
      confidence: Math.round(confidence),
      reasoning: `AI hybrid analysis: ${bestUser.firstName} scored highest (${Math.round(userScores[0].score)}) based on workload balance, preferences, and compatibility`,
      workloadImpact: bestUser.totalChores + 1
    };
  }
};

// Strategy registry
export const assignmentStrategies: Record<string, AssignmentStrategy> = {
  'round_robin': roundRobinAssignment,
  'fairness': fairnessBasedAssignment,
  'preference': preferenceBasedAssignment,
  'ai_hybrid': aiHybridAssignment
};

// Main assignment function
export async function assignChore(
  chore: any, 
  strategy: string, 
  householdId: string
): Promise<ChoreAssignmentData> {
  try {
    // Get household users and their current workload
    const users = await getHouseholdUsersWithWorkload(householdId);
    
    if (users.length === 0) {
      throw new Error('No users found in household');
    }

    // Get the selected strategy
    const selectedStrategy = assignmentStrategies[strategy] || assignmentStrategies['ai_hybrid'];
    
    // Execute the assignment algorithm
    const assignment = selectedStrategy.algorithm(chore, users);
    
    // Log the assignment for AI learning
    await logAssignmentDecision(chore.id, assignment, users);
    
    return assignment;
    
  } catch (error) {
    console.error('Error in chore assignment:', error);
    throw error;
  }
}

// Get users with their current workload data
async function getHouseholdUsersWithWorkload(householdId: string): Promise<UserWorkload[]> {
  try {
    // Get household users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('household_id', householdId);

    if (usersError) throw usersError;

    // Get workload data for each user
    const usersWithWorkload = await Promise.all(
      users.map(async (user) => {
        // Get user's chores
        const { data: userChores, error: choresError } = await supabase
          .from('chores')
          .select('*')
          .eq('assigned_to', user.id);

        if (choresError) throw choresError;

        // Get user preferences
        const { data: preferences, error: prefError } = await supabase
          .from('chore_preferences')
          .select('*')
          .eq('user_id', user.id);

        if (prefError) throw prefError;

        // Calculate workload metrics
        const totalChores = userChores?.length || 0;
        const pendingChores = userChores?.filter(c => c.status === 'pending').length || 0;
        const completedToday = userChores?.filter(c => 
          c.status === 'completed' && 
          new Date(c.updated_at).toDateString() === new Date().toDateString()
        ).length || 0;

        const averageDifficulty = userChores?.length > 0 
          ? userChores.reduce((sum, c) => sum + (c.ai_difficulty_rating || 50), 0) / userChores.length
          : 50;

        const preferredCategories = preferences?.map(p => p.chore_category) || [];
        const energyLevel = preferences?.[0]?.energy_preference || 'medium';

        // Get last assignment time
        const lastAssigned = userChores?.length > 0 
          ? new Date(Math.max(...userChores.map(c => new Date(c.updated_at).getTime())))
          : null;

        return {
          userId: user.id,
          email: user.email,
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          totalChores,
          pendingChores,
          completedToday,
          averageDifficulty,
          preferredCategories,
          energyLevel,
          lastAssigned
        };
      })
    );

    return usersWithWorkload;
    
  } catch (error) {
    console.error('Error getting users with workload:', error);
    throw error;
  }
}

// Log assignment decisions for AI learning
async function logAssignmentDecision(
  choreId: string, 
  assignment: ChoreAssignmentData, 
  users: UserWorkload[]
): Promise<void> {
  try {
    const { error } = await supabase
      .from('chore_ai_insights')
      .insert({
        insight_type: 'assignment',
        insight_data: {
          chore_id: choreId,
          assignment,
          available_users: users.map(u => ({
            id: u.userId,
            workload: u.totalChores,
            preferences: u.preferredCategories
          })),
          timestamp: new Date().toISOString()
        },
        ai_confidence: assignment.confidence,
        generated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error logging assignment decision:', error);
    }
  } catch (error) {
    console.error('Error logging assignment decision:', error);
  }
}

// Get assignment recommendations for a chore
export async function getAssignmentRecommendations(
  chore: any, 
  householdId: string
): Promise<ChoreAssignmentData[]> {
  try {
    const recommendations = [];
    
    // Get recommendations for each strategy
    for (const [strategyName, strategy] of Object.entries(assignmentStrategies)) {
      try {
        const users = await getHouseholdUsersWithWorkload(householdId);
        const assignment = strategy.algorithm(chore, users);
        recommendations.push(assignment);
      } catch (error) {
        console.error(`Error getting recommendation for ${strategyName}:`, error);
      }
    }
    
    // Sort by confidence (descending)
    recommendations.sort((a, b) => b.confidence - a.confidence);
    
    return recommendations;
    
  } catch (error) {
    console.error('Error getting assignment recommendations:', error);
    throw error;
  }
}
