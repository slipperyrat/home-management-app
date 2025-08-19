'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { 
  Plus, 
  Clock, 
  Brain, 
  Lightbulb, 
  Target, 
  Users,
  Zap,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface Chore {
  id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  due_at?: string;
  recurrence?: string;
  created_by: string;
  household_id: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'skipped';
  ai_difficulty_rating: number;
  ai_estimated_duration: number;
  ai_preferred_time: string;
  ai_energy_level: 'low' | 'medium' | 'high';
  ai_skill_requirements: string[];
  ai_confidence: number;
  ai_suggested: boolean;
  created_at: string;
  updated_at: string;
}

interface AIChoreInsights {
  total_chores: number;
  pending_chores: number;
  completed_chores: number;
  ai_suggested_chores: number;
  average_difficulty: number;
  average_duration: number;
  fairness_score: number;
  household_patterns: string[];
  suggested_improvements: string[];
  ai_learning_progress: number;
  optimal_scheduling: string[];
  skill_gaps: string[];
  energy_distribution: {
    low: number;
    medium: number;
    high: number;
  };
  category_breakdown: Record<string, number>;
  user_workload_distribution: Record<string, number>;
  completion_efficiency: number;
}



export default function ChoresPage() {
  const { userId } = useAuth();
  const [chores, setChores] = useState<Chore[]>([]);
  const [aiInsights, setAiInsights] = useState<AIChoreInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (userId) {
      fetchChores();
      fetchAIInsights();
    }
  }, [userId, fetchChores, fetchAIInsights]);

  const fetchChores = async () => {
    try {
      const response = await fetch(`/api/chores?householdId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setChores(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching chores:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsights = async () => {
    try {
      const response = await fetch('/api/ai/chore-insights');
      if (response.ok) {
        const data = await response.json();
        setAiInsights(data.insights);
      }
    } catch (error) {
      console.error('Error fetching AI insights:', error);
    }
  };

  

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'assigned': return 'bg-purple-100 text-purple-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty >= 80) return 'text-red-600';
    if (difficulty >= 60) return 'text-orange-600';
    if (difficulty >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getEnergyColor = (energy: string) => {
    switch (energy) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Target className="h-12 w-12 animate-pulse mx-auto mb-4 text-blue-500" />
          <p className="text-lg text-gray-600">Loading Smart Chores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Target className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-900">Smart Chore Management</h1>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            <Brain className="h-4 w-4 mr-1" />
            AI-Powered
          </Badge>
        </div>
        <p className="text-gray-600 text-lg">
          Intelligent chore assignment with AI fairness optimization and smart scheduling
        </p>
      </div>

      {/* AI Insights Summary */}
      {aiInsights && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Chores</CardTitle>
              <Target className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.total_chores}</div>
              <p className="text-xs text-gray-500">Chores created</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.pending_chores}</div>
              <p className="text-xs text-gray-500">Awaiting completion</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fairness Score</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.fairness_score}%</div>
              <p className="text-xs text-gray-500">Workload balance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Learning</CardTitle>
              <Brain className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.ai_learning_progress}%</div>
              <p className="text-xs text-gray-500">Pattern recognition</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chores">All Chores</TabsTrigger>
          <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
          <TabsTrigger value="suggestions">Smart Suggestions</TabsTrigger>
          <TabsTrigger value="create">Create Chore</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Manage your chores with AI-powered assistance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => setActiveTab('create')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Chore
                </Button>
                <Button 
                  variant="outline" 
                  className="border-purple-200 text-purple-700 hover:bg-purple-50"
                  onClick={() => setActiveTab('suggestions')}
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  AI Suggestions
                </Button>
                <Button 
                  variant="outline" 
                  className="border-green-200 text-green-700 hover:bg-green-50"
                  onClick={() => setActiveTab('ai-insights')}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  AI Insights
                </Button>
                <Button 
                  variant="outline" 
                  className="border-orange-200 text-orange-700 hover:bg-orange-50"
                  onClick={() => setActiveTab('chores')}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Manage Chores
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Chores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Chores
              </CardTitle>
              <CardDescription>
                Your latest chore activities and assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chores.slice(0, 5).length > 0 ? (
                <div className="space-y-4">
                  {chores.slice(0, 5).map((chore) => (
                    <div key={chore.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{chore.title}</h4>
                          {chore.ai_suggested && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI Suggested
                            </Badge>
                          )}
                          <Badge className={getPriorityColor(chore.priority)}>
                            {chore.priority}
                          </Badge>
                          <Badge variant="outline" className={getStatusColor(chore.status)}>
                            {chore.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className={getDifficultyColor(chore.ai_difficulty_rating)}>
                            Difficulty: {chore.ai_difficulty_rating}%
                          </span>
                          <span>{chore.ai_estimated_duration} min</span>
                          <span className={getEnergyColor(chore.ai_energy_level)}>
                            {chore.ai_energy_level} energy
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600 mb-1">Category</div>
                        <Badge variant="outline">{chore.category}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No chores yet. Create your first chore to get started!
                </p>
              )}
            </CardContent>
          </Card>

          {/* AI Learning Progress */}
          {aiInsights && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  AI Learning Progress
                </CardTitle>
                <CardDescription>
                  How well the AI understands your household patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Pattern Recognition</span>
                    <span>{aiInsights.ai_learning_progress}%</span>
                  </div>
                  <Progress value={aiInsights.ai_learning_progress} />
                  <p className="text-sm text-gray-600">
                    The AI is learning from your chore patterns to provide better assignments and suggestions
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Placeholder for other tabs */}
        <TabsContent value="chores" className="space-y-6">
          <Card>
            <CardContent className="text-center py-12">
              <Target className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">All Chores</h3>
              <p className="text-gray-500">Chore management interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-6">
          <Card>
            <CardContent className="text-center py-12">
              <Brain className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">AI Insights</h3>
              <p className="text-gray-500">AI insights interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-6">
          <Card>
            <CardContent className="text-center py-12">
              <Lightbulb className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Smart Suggestions</h3>
              <p className="text-gray-500">AI suggestions interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardContent className="text-center py-12">
              <Plus className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Create Chore</h3>
              <p className="text-gray-500">Chore creation interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 