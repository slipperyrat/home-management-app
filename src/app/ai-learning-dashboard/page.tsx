'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserData } from '@/hooks/useUserData';
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Lightbulb, 
  BarChart3, 
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';

interface LearningInsights {
  total_corrections: number;
  patterns_identified: number;
  accuracy_trend: number;
  top_learning_areas: string[];
  suggested_improvements: string[];
  confidence_threshold: number;
  learning_goals: string[];
  last_updated: string;
}

export default function AILearningDashboard() {
  const { userData, isLoading: userDataLoading } = useUserData();
  const [insights, setInsights] = useState<LearningInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userData?.household_id) {
      fetchLearningInsights();
    }
  }, [userData?.household_id]);

  const fetchLearningInsights = async () => {
    if (!userData?.household_id) {
      setError('No household ID found. Please complete onboarding first.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/ai/learning-insights?household_id=${userData.household_id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch learning insights');
      }
      
      const data = await response.json();
      setInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (userDataLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Brain className="h-12 w-12 animate-pulse mx-auto mb-4 text-blue-500" />
          <p className="text-lg text-gray-600">
            {userDataLoading ? 'Loading user data...' : 'Loading AI Learning Insights...'}
          </p>
        </div>
      </div>
    );
  }

  if (!userData?.household_id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-lg text-yellow-600 mb-4">Household Setup Required</p>
          <p className="text-gray-600 mb-4">
            You need to complete onboarding and join a household to view AI Learning Insights.
          </p>
          <Button onClick={() => window.location.href = '/onboarding'} variant="outline">
            Go to Onboarding
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg text-red-600 mb-4">Error loading insights</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchLearningInsights} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-600">No learning insights available yet</p>
          <p className="text-gray-500">Start making corrections to see AI learning progress</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-900">AI Learning Dashboard</h1>
        </div>
        <p className="text-gray-600 text-lg">
          See how your AI assistant is learning and improving from your feedback
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Corrections</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.total_corrections}</div>
            <p className="text-xs text-gray-500">User feedback provided</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Patterns Identified</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.patterns_identified}</div>
            <p className="text-xs text-gray-500">AI learning patterns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuracy Trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.accuracy_trend}%</div>
            <p className="text-xs text-gray-500">Improvement over time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confidence Threshold</CardTitle>
            <BarChart3 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.confidence_threshold}%</div>
            <p className="text-xs text-gray-500">AI confidence level</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="learning">Learning Areas</TabsTrigger>
          <TabsTrigger value="improvements">Improvements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Learning Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Learning Progress
              </CardTitle>
              <CardDescription>
                How much the AI has learned from your feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Pattern Recognition</span>
                  <span>{Math.min(100, (insights.patterns_identified / Math.max(insights.total_corrections, 1)) * 100)}%</span>
                </div>
                <Progress value={Math.min(100, (insights.patterns_identified / Math.max(insights.total_corrections, 1)) * 100)} />
                
                <div className="flex justify-between text-sm">
                  <span>Accuracy Improvement</span>
                  <span>{insights.accuracy_trend}%</span>
                </div>
                <Progress value={insights.accuracy_trend} />
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Learning Activity
              </CardTitle>
              <CardDescription>
                Last updated: {new Date(insights.last_updated).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                The AI system is actively learning from your corrections and improving its suggestions.
                {insights.total_corrections > 0 && (
                  <p className="mt-2">
                    Based on {insights.total_corrections} feedback items, the system has identified 
                    {insights.patterns_identified} learning patterns.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="space-y-6">
          {/* Top Learning Areas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Top Learning Areas
              </CardTitle>
              <CardDescription>
                What the AI is getting better at understanding
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.top_learning_areas.length > 0 ? (
                <div className="space-y-3">
                  {insights.top_learning_areas.map((area, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Badge variant="secondary" className="w-20 justify-center">
                        #{index + 1}
                      </Badge>
                      <span className="text-sm">{area}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Learning areas will appear as you provide more feedback
                </p>
              )}
            </CardContent>
          </Card>

          {/* Learning Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Next Learning Goals
              </CardTitle>
              <CardDescription>
                What the AI is working on improving next
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.learning_goals.length > 0 ? (
                <div className="space-y-3">
                  {insights.learning_goals.map((goal, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-sm">{goal}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Learning goals will be generated based on your feedback patterns
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="improvements" className="space-y-6">
          {/* Suggested Improvements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Suggested Improvements
              </CardTitle>
              <CardDescription>
                Actionable insights to help the AI work better for you
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.suggested_improvements.length > 0 ? (
                <div className="space-y-4">
                  {insights.suggested_improvements.map((improvement, index) => (
                    <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-800">{improvement}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Improvement suggestions will appear as the AI learns more about your preferences
                </p>
              )}
            </CardContent>
          </Card>

          {/* Action Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                How to Help the AI Learn
              </CardTitle>
              <CardDescription>
                Simple actions you can take to improve AI suggestions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Always provide feedback when AI suggestions are incorrect</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Use the "Correct" button to explain what should have been suggested</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Add notes to corrections to help the AI understand your preferences</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Mark suggestions as "Done" when they're correct to reinforce good patterns</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Refresh Button */}
      <div className="mt-8 text-center">
        <Button onClick={fetchLearningInsights} variant="outline">
          Refresh Insights
        </Button>
      </div>
    </div>
  );
}
