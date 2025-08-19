import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { choreId } = body;

    if (!choreId) {
      return NextResponse.json({ error: 'Chore ID is required' }, { status: 400 });
    }

    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const householdId = userData.household_id;

    // Get the chore details
    const { data: chore, error: choreError } = await supabase
      .from('chores')
      .select('*')
      .eq('id', choreId)
      .eq('household_id', householdId)
      .single();

    if (choreError || !chore) {
      return NextResponse.json({ error: 'Chore not found' }, { status: 404 });
    }

    // Get household members
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('id, email')
      .eq('household_id', householdId);

    if (membersError) {
      console.error('Error fetching household members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
    }

    // Get chore preferences for all members
    const { data: preferences, error: preferencesError } = await supabase
      .from('chore_preferences')
      .select('*')
      .eq('household_id', householdId);

    if (preferencesError) {
      console.error('Error fetching preferences:', preferencesError);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Get completion patterns for workload analysis
    const { data: completions, error: completionsError } = await supabase
      .from('chore_completion_patterns')
      .select('*')
      .eq('household_id', householdId);

    if (completionsError) {
      console.error('Error fetching completions:', completionsError);
      return NextResponse.json({ error: 'Failed to fetch completions' }, { status: 500 });
    }

    // Generate smart assignment
      const assignment = generateSmartAssignment(
    chore,
    members || [],
    preferences || [],
    completions || []
  );

    // Create assignment record
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('chore_assignments')
      .insert({
        chore_id: choreId,
        assigned_to: assignment.assigned_to,
        assigned_by: userId,
        ai_suggested: true,
        ai_confidence: assignment.confidence,
        ai_reasoning: assignment.reasoning
      })
      .select()
      .single();

    if (assignmentError) {
      console.error('Error creating assignment:', assignmentError);
      return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
    }

    // Update the chore with the assignment
    const { error: updateError } = await supabase
      .from('chores')
      .update({
        assigned_to: assignment.assigned_to,
        status: 'assigned'
      })
      .eq('id', choreId);

    if (updateError) {
      console.error('Error updating chore:', updateError);
      return NextResponse.json({ error: 'Failed to update chore' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      assignment: assignmentData,
      ai_reasoning: assignment.reasoning
    });

  } catch (error) {
    console.error('Error in chore assignment API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateSmartAssignment(
  chore: any,
  members: any[],
  preferences: any[],
  completions: any[]
) {
  const memberScores: { [key: string]: number } = {};
  const memberReasons: { [key: string]: string[] } = {};

  // Initialize member scores and reasons
  members.forEach(member => {
    memberScores[member.id] = 0;
    memberReasons[member.id] = [];
  });

  // Calculate workload distribution
  const workloadDistribution = calculateWorkloadDistribution(completions, members);
  
  // Calculate preference scores
  const preferenceScores = calculatePreferenceScores(preferences, chore, members);
  
  // Calculate skill match scores
  const skillScores = calculateSkillMatchScores(chore, members);
  
  // Calculate energy level compatibility
  const energyScores = calculateEnergyCompatibility(chore, members);
  
  // Calculate fairness scores
  const fairnessScores = calculateFairnessScores(workloadDistribution, members);

  // Combine all scores based on assignment type
  members.forEach(member => {
    const memberId = member.id;
    
    // Base score starts at 50
    let totalScore = 50;
    
    // Workload balance (30% weight)
    const workloadScore = fairnessScores[memberId] || 0;
    totalScore += workloadScore * 0.3;
    memberReasons[memberId]?.push(`Workload balance: ${workloadScore.toFixed(1)}`);

    // Preference match (25% weight)
    const preferenceScore = preferenceScores[memberId] || 0;
    totalScore += preferenceScore * 0.25;
    memberReasons[memberId]?.push(`Preference match: ${preferenceScore.toFixed(1)}`);

    // Skill compatibility (20% weight)
    const skillScore = skillScores[memberId] || 0;
    totalScore += skillScore * 0.2;
    memberReasons[memberId]?.push(`Skill compatibility: ${skillScore.toFixed(1)}`);

    // Energy compatibility (15% weight)
    const energyScore = energyScores[memberId] || 0;
    totalScore += energyScore * 0.15;
    memberReasons[memberId]?.push(`Energy compatibility: ${energyScore.toFixed(1)}`);

    // Random factor for variety (10% weight)
    const randomFactor = Math.random() * 20 - 10;
    totalScore += randomFactor * 0.1;
    memberReasons[memberId]?.push(`Variety factor: ${randomFactor.toFixed(1)}`);

    memberScores[memberId] = Math.max(0, Math.min(100, totalScore));
  });

  // Find the best assignment
  let bestMember = members[0]?.id;
  let bestScore = -1;

  Object.entries(memberScores).forEach(([memberId, score]) => {
    if (score > bestScore) {
      bestScore = score;
      bestMember = memberId;
    }
  });

  // Generate reasoning
  const reasoning = `AI assigned this chore to ${members.find(m => m.id === bestMember)?.email} based on:
${(memberReasons[bestMember] || []).map(reason => `• ${reason}`).join('\n')}

Final score: ${bestScore.toFixed(1)}/100`;

  return {
    assigned_to: bestMember,
    confidence: Math.round(bestScore),
    reasoning: reasoning
  };
}

function calculateWorkloadDistribution(completions: any[], members: any[]) {
  const distribution: { [key: string]: number } = {};
  
  members.forEach(member => {
    const memberCompletions = completions.filter(c => c.user_id === member.id);
    distribution[member.id] = memberCompletions.length;
  });

  return distribution;
}

function calculatePreferenceScores(preferences: any[], chore: any, members: any[]) {
  const scores: { [key: string]: number } = {};
  
  members.forEach(member => {
    const memberPreferences = preferences.filter(p => p.user_id === member.id);
    const categoryPreference = memberPreferences.find(p => p.chore_category === chore.category);
    
    if (categoryPreference) {
      scores[member.id] = categoryPreference.preference_score;
    } else {
      scores[member.id] = 50; // Default neutral preference
    }
  });

  return scores;
}

function calculateSkillMatchScores(_chore: any, members: any[]) {
  const scores: { [key: string]: number } = {};
  
  // For now, assume all members have basic skills
  // In a real system, this would check actual skill levels
  members.forEach(member => {
    scores[member.id] = 75; // Default skill level
  });

  return scores;
}

function calculateEnergyCompatibility(_chore: any, members: any[]) {
  const scores: { [key: string]: number } = {};
  
  // For now, assume all members have medium energy
  // In a real system, this would check actual energy patterns
  members.forEach(member => {
    scores[member.id] = 70; // Default energy compatibility
  });

  return scores;
}

function calculateFairnessScores(workloadDistribution: { [key: string]: number }, members: any[]) {
  const scores: { [key: string]: number } = {};
  
  const workloads = Object.values(workloadDistribution);
  const averageWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
  
  members.forEach(member => {
    const currentWorkload = workloadDistribution[member.id] || 0;
    const difference = averageWorkload - currentWorkload;
    
    // Higher score for members with lower workload
    if (difference > 0) {
      scores[member.id] = Math.min(100, 50 + (difference * 10));
    } else {
      scores[member.id] = Math.max(0, 50 + (difference * 5));
    }
  });

  return scores;
}
