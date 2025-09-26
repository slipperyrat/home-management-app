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
  RotateCcw,
  CheckCircle,
  X,
  BarChart3,
  TrendingUp
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
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const [choreForm, setChoreForm] = useState({
    title: '',
    description: '',
    category: 'general',
    due_at: '',
    priority: 'medium',
    ai_estimated_duration: 30,
    recurrence_type: 'none',
    recurrence_day: 1,
    recurrence_interval: 1,
    custom_rrule: '',
    assignment_strategy: 'auto',
    assigned_to: ''
  });

  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentRecommendations, setAssignmentRecommendations] = useState<any[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Get household ID from user data
  useEffect(() => {
    const getUserData = async () => {
      if (userId) {
        try {
          const response = await fetch('/api/user-data');
          if (response.ok) {
            const userData = await response.json();
            if (userData.data && userData.data.household_id) {
              setHouseholdId(userData.data.household_id);
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };

    getUserData();
  }, [userId]);

  const fetchChores = async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch('/api/chores');
      if (response.ok) {
        const data = await response.json();
        setChores(data.data?.chores || []);
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

  // Chore completion and management functions
  const completeChore = async (choreId: string) => {
    try {
      const response = await fetch(`/api/chores/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: choreId,
          completed_by: userId,
          completion_notes: ''
        })
      });

      if (response.ok) {
        // Update local state
        setChores(chores.map(chore => 
          chore.id === choreId 
            ? { ...chore, status: 'completed' as const }
            : chore
        ));
        // Refresh chores to get updated data
        fetchChores();
      }
    } catch (error) {
      console.error('Error completing chore:', error);
    }
  };

  const updateChoreStatus = async (choreId: string, newStatus: Chore['status']) => {
    try {
      const response = await fetch(`/api/chores/${choreId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setChores(chores.map(chore => 
          chore.id === choreId 
            ? { ...chore, status: newStatus }
            : chore
        ));
      }
    } catch (error) {
      console.error('Error updating chore status:', error);
    }
  };

  const deleteChore = async (choreId: string) => {
    if (!confirm('Are you sure you want to delete this chore?')) return;
    
    try {
      const response = await fetch(`/api/chores/${choreId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setChores(chores.filter(chore => chore.id !== choreId));
      }
    } catch (error) {
      console.error('Error deleting chore:', error);
    }
  };

  // AI Assignment Functions
  const getAssignmentRecommendations = async () => {
    if (!choreForm.title || !choreForm.category) {
      alert('Please fill in chore title and category first');
      return;
    }

    setAssignmentLoading(true);
    try {
      // Create a mock chore object for recommendations
      const mockChore = {
        id: 'temp',
        title: choreForm.title,
        category: choreForm.category,
        ai_difficulty_rating: 50,
        ai_energy_level: 'medium',
        priority: choreForm.priority
      };

      const response = await fetch(`/api/ai/chore-assignment?choreId=temp&householdId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setAssignmentRecommendations(data.recommendations || []);
        setShowRecommendations(true);
      }
    } catch (error) {
      console.error('Error getting assignment recommendations:', error);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const executeAIAssignment = async (strategy: string) => {
    try {
      const mockChore = {
        id: 'temp',
        title: choreForm.title,
        category: choreForm.category,
        ai_difficulty_rating: 50,
        ai_energy_level: 'medium',
        priority: choreForm.priority
      };

      const response = await fetch('/api/ai/chore-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chore: mockChore,
          strategy,
          householdId: userId
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Update the form with the AI assignment
        setChoreForm(prev => ({
          ...prev,
          assignment_strategy: strategy as any,
          assigned_to: data.assignment.assignedTo
        }));
        
        // Show success message
        alert(`AI assigned chore using ${strategy} strategy!`);
        setShowRecommendations(false);
      }
    } catch (error) {
      console.error('Error executing AI assignment:', error);
    }
  };

  // Calculate chore statistics
  const choreStats = {
    total: chores.length,
    pending: chores.filter(c => c.status === 'pending').length,
    inProgress: chores.filter(c => c.status === 'in_progress').length,
    completed: chores.filter(c => c.status === 'completed').length,
    overdue: chores.filter(c => c.due_at && new Date(c.due_at) < new Date() && c.status !== 'completed').length,
    highPriority: chores.filter(c => c.priority === 'high' || c.priority === 'urgent').length
  };


  // Calculate completion rate
  const completionRate = chores.length > 0 ? Math.round((choreStats.completed / chores.length) * 100) : 0;

  // Calculate average difficulty
  const avgDifficulty = chores.length > 0 
    ? Math.round(chores.reduce((sum, c) => sum + (c.ai_difficulty_rating || 50), 0) / chores.length)
    : 50;

  // Calculate total estimated time
  const totalEstimatedTime = chores
    .filter(c => c.status !== 'completed')
    .reduce((sum, c) => sum + (c.ai_estimated_duration || 30), 0);

  // Generate RRULE based on recurrence settings
  const generateRRULE = () => {
    if (choreForm.recurrence_type === 'none') return null;
    if (choreForm.recurrence_type === 'custom') return choreForm.custom_rrule;
    
    let rrule = '';
    
    switch (choreForm.recurrence_type) {
      case 'daily':
        rrule = `FREQ=DAILY;INTERVAL=${choreForm.recurrence_interval}`;
        break;
      case 'weekly':
        rrule = `FREQ=WEEKLY;INTERVAL=${choreForm.recurrence_interval};BYDAY=${choreForm.recurrence_day}`;
        break;
      case 'monthly':
        rrule = `FREQ=MONTHLY;INTERVAL=${choreForm.recurrence_interval};BYMONTHDAY=${choreForm.recurrence_day}`;
        break;
    }
    
    return rrule;
  };

  // Handle chore creation
  const handleCreateChore = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const rrule = generateRRULE();
      const choreData = {
        title: choreForm.title,
        description: choreForm.description,
        category: choreForm.category,
        due_at: choreForm.due_at || null,
        priority: choreForm.priority,
        ai_estimated_duration: choreForm.ai_estimated_duration,
        rrule: rrule,
        dtstart: choreForm.due_at ? new Date(choreForm.due_at).toISOString() : null,
        assignment_strategy: choreForm.assignment_strategy,
        assigned_to: choreForm.assignment_strategy === 'manual' ? choreForm.assigned_to : null
      };

      const response = await fetch('/api/chores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(choreData),
      });

      if (response.ok) {
                 // Reset form and refresh chores
         setChoreForm({
           title: '',
           description: '',
           category: 'general',
           due_at: '',
           priority: 'medium',
           ai_estimated_duration: 30,
           recurrence_type: 'none',
           recurrence_day: 1,
           recurrence_interval: 1,
           custom_rrule: '',
           assignment_strategy: 'auto',
           assigned_to: ''
         });
        setActiveTab('overview');
        fetchChores();
      } else {
        console.error('Failed to create chore');
      }
    } catch (error) {
      console.error('Error creating chore:', error);
    }
  };

  useEffect(() => {
    if (userId && householdId) {
      fetchChores();
      fetchAIInsights();
    } else if (userId && !householdId) {
      // User authenticated but householdId not loaded yet, keep loading
      setLoading(true);
    } else {
      // User not authenticated, stop loading
      setLoading(false);
    }
  }, [userId, householdId]);

  // Redirect unauthenticated users
  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Target className="h-12 w-12 mx-auto mb-4 text-blue-500" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please sign in to access the Smart Chores system.</p>
          <Button onClick={() => window.location.href = '/sign-in'}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  

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

        {/* All Chores Tab */}
        <TabsContent value="chores" className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">All Chores</h2>
            <Button 
              onClick={() => setActiveTab('create')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chore
            </Button>
          </div>

          {chores.length > 0 ? (
            <div className="space-y-4">
              {chores.map((chore) => (
                <Card key={chore.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-lg">{chore.title}</h4>
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
                        
                        {chore.description && (
                          <p className="text-gray-600 mb-3">{chore.description}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                          <span className={getDifficultyColor(chore.ai_difficulty_rating)}>
                            Difficulty: {chore.ai_difficulty_rating}%
                          </span>
                          <span>{chore.ai_estimated_duration} min</span>
                          <span className={getEnergyColor(chore.ai_energy_level)}>
                            {chore.ai_energy_level} energy
                          </span>
                          <span>Category: {chore.category}</span>
                        </div>
                        
                        {chore.due_at && (
                          <div className="text-sm text-gray-600 mb-4">
                            <Clock className="h-4 w-4 inline mr-1" />
                            Due: {new Date(chore.due_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 ml-4">
                        {chore.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => completeChore(chore.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateChoreStatus(chore.id, 'in_progress')}
                          disabled={chore.status === 'completed'}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Start
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteChore(chore.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No chores yet</h3>
                <p className="text-gray-600 mb-4">
                  Create your first chore to start managing household tasks
                </p>
                <Button 
                  onClick={() => setActiveTab('create')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Chore
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-6">
          {aiInsights ? (
            <>
              {/* AI Learning Progress */}
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

              {/* Workload Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-500" />
                    Workload Distribution
                  </CardTitle>
                  <CardDescription>
                    How chores are distributed among household members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(aiInsights.user_workload_distribution).map(([user, count]) => (
                      <div key={user} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{user}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${(count / Math.max(...Object.values(aiInsights.user_workload_distribution))) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    Category Breakdown
                  </CardTitle>
                  <CardDescription>
                    Distribution of chores by category
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(aiInsights.category_breakdown).map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{category}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${(count / Math.max(...Object.values(aiInsights.category_breakdown))) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Energy Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Energy Level Distribution
                  </CardTitle>
                  <CardDescription>
                    Distribution of chores by energy requirement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{aiInsights.energy_distribution.low}</div>
                      <div className="text-sm text-gray-600">Low Energy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{aiInsights.energy_distribution.medium}</div>
                      <div className="text-sm text-gray-600">Medium Energy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{aiInsights.energy_distribution.high}</div>
                      <div className="text-sm text-gray-600">High Energy</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Completion Efficiency */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Completion Efficiency
                  </CardTitle>
                  <CardDescription>
                    How efficiently chores are being completed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>Efficiency Score</span>
                      <span>{aiInsights.completion_efficiency}%</span>
                    </div>
                    <Progress value={aiInsights.completion_efficiency} />
                    <p className="text-sm text-gray-600">
                      Higher scores indicate better chore completion patterns
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">AI Insights Loading</h3>
                <p className="text-gray-600">
                  Creating your first chore to generate AI insights
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Smart Suggestions
              </CardTitle>
              <CardDescription>
                AI-powered recommendations to improve your chore management
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiInsights?.suggested_improvements && aiInsights.suggested_improvements.length > 0 ? (
                <div className="space-y-4">
                  {aiInsights.suggested_improvements.map((suggestion, index) => (
                    <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-800">{suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Lightbulb className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions yet</h3>
                  <p className="text-gray-600">
                    Create more chores to get personalized AI recommendations
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Optimal Scheduling */}
          {aiInsights?.optimal_scheduling && aiInsights.optimal_scheduling.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-500" />
                  Optimal Scheduling
                </CardTitle>
                <CardDescription>
                  AI-recommended times for different types of chores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiInsights.optimal_scheduling.map((schedule, index) => (
                    <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-800">{schedule}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skill Gaps */}
          {aiInsights?.skill_gaps && aiInsights.skill_gaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-500" />
                  Skill Gaps
                </CardTitle>
                <CardDescription>
                  Areas where household members could improve their skills
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiInsights.skill_gaps.map((skill, index) => (
                    <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-sm text-orange-800">{skill}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Household Patterns */}
          {aiInsights?.household_patterns && aiInsights.household_patterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  Household Patterns
                </CardTitle>
                <CardDescription>
                  Patterns the AI has identified in your household's chore habits
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiInsights.household_patterns.map((pattern, index) => (
                    <div key={index} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-800">{pattern}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-500" />
                Create New Chore
              </CardTitle>
              <CardDescription>
                Create a new chore with smart scheduling and assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateChore} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chore Title *
                    </label>
                    <input
                      type="text"
                      value={choreForm.title}
                      onChange={(e) => setChoreForm({...choreForm, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Clean Kitchen"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={choreForm.category}
                      onChange={(e) => setChoreForm({...choreForm, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="general">General</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="bathroom">Bathroom</option>
                      <option value="laundry">Laundry</option>
                      <option value="cleaning">Cleaning</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="garden">Garden</option>
                      <option value="shopping">Shopping</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={choreForm.description}
                    onChange={(e) => setChoreForm({...choreForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Describe what needs to be done..."
                  />
                </div>

                {/* Scheduling */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="datetime-local"
                      value={choreForm.due_at}
                      onChange={(e) => setChoreForm({...choreForm, due_at: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={choreForm.priority}
                      onChange={(e) => setChoreForm({...choreForm, priority: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Duration (min)
                    </label>
                    <input
                      type="number"
                      value={choreForm.ai_estimated_duration}
                      onChange={(e) => setChoreForm({...choreForm, ai_estimated_duration: parseInt(e.target.value) || 30})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="5"
                      max="480"
                    />
                  </div>
                </div>

                {/* Recurrence Settings */}
                <div className="border-t pt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Recurrence Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Recurrence Type
                      </label>
                      <select
                        value={choreForm.recurrence_type}
                        onChange={(e) => setChoreForm({...choreForm, recurrence_type: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">No Recurrence</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom RRULE</option>
                      </select>
                    </div>
                    
                    {choreForm.recurrence_type === 'weekly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Day of Week
                        </label>
                        <select
                          value={choreForm.recurrence_day}
                          onChange={(e) => setChoreForm({...choreForm, recurrence_day: parseInt(e.target.value) || 1})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                          <option value="0">Sunday</option>
                        </select>
                      </div>
                    )}
                    
                    {choreForm.recurrence_type === 'monthly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Day of Month
                        </label>
                        <input
                          type="number"
                          value={choreForm.recurrence_day}
                          onChange={(e) => setChoreForm({...choreForm, recurrence_day: parseInt(e.target.value) || 1})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="1"
                          max="31"
                        />
                      </div>
                    )}
                    
                    {choreForm.recurrence_type !== 'none' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Interval
                        </label>
                        <input
                          type="number"
                          value={choreForm.recurrence_interval}
                          onChange={(e) => setChoreForm({...choreForm, recurrence_interval: parseInt(e.target.value) || 1})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="1"
                          max="52"
                          placeholder="Every X days/weeks/months"
                        />
                      </div>
                    )}
                  </div>
                  
                  {choreForm.recurrence_type === 'custom' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom RRULE
                      </label>
                      <input
                        type="text"
                        value={choreForm.custom_rrule}
                        onChange={(e) => setChoreForm({...choreForm, custom_rrule: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use iCalendar RRULE format (e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR for every Monday, Wednesday, Friday)
                      </p>
                    </div>
                  )}
                </div>

                {/* Smart Assignment */}
                <div className="border-t pt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Smart Assignment</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assignment Strategy
                      </label>
                      <select
                        value={choreForm.assignment_strategy}
                        onChange={(e) => setChoreForm({...choreForm, assignment_strategy: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="auto">Auto-assign (AI-powered)</option>
                        <option value="round_robin">Round Robin</option>
                        <option value="fairness">Fairness-based</option>
                        <option value="preference">Preference-based</option>
                        <option value="ai_hybrid">AI Hybrid</option>
                        <option value="manual">Manual Assignment</option>
                      </select>
                    </div>
                    
                    {choreForm.assignment_strategy === 'manual' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Assign To
                        </label>
                        <select
                          value={choreForm.assigned_to}
                          onChange={(e) => setChoreForm({...choreForm, assigned_to: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select household member</option>
                          <option value="user1">User 1</option>
                          <option value="user2">User 2</option>
                        </select>
                      </div>
                    )}
                  </div>
                  
                  {/* AI Assignment Recommendations */}
                  {choreForm.assignment_strategy !== 'manual' && (
                    <div className="mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={getAssignmentRecommendations}
                        disabled={assignmentLoading}
                        className="w-full"
                      >
                        {assignmentLoading ? (
                          <>
                            <Brain className="h-4 w-4 mr-2 animate-spin" />
                            Getting AI Recommendations...
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4 mr-2" />
                            Get AI Assignment Recommendations
                          </>
                        )}
                      </Button>
                      
                      {showRecommendations && assignmentRecommendations.length > 0 && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <h5 className="font-medium text-gray-900 mb-3">AI Recommendations</h5>
                          <div className="space-y-3">
                            {assignmentRecommendations.map((rec, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                      {rec.strategy}
                                    </Badge>
                                    <span className="text-sm font-medium">
                                      Confidence: {rec.confidence}%
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600">{rec.reasoning}</p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => executeAIAssignment(rec.strategy)}
                                  className="ml-3"
                                >
                                  Use This
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab('overview')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!choreForm.title.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Chore
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 