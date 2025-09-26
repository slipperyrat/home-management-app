// Real-time AI Dashboard Component
// This can be easily removed if the real-time processing doesn't work

'use client';

import React, { useState, useEffect } from 'react';
import { useRealTimeAI } from '@/hooks/useRealTimeAI';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap, 
  Brain, 
  ShoppingCart, 
  Utensils,
  Users,
  Activity,
  BarChart3,
  RefreshCw
} from 'lucide-react';

export function RealTimeAIDashboard() {
  const {
    isConnected,
    isConnecting,
    error,
    status,
    processingRequests,
    completedRequests,
    processRequest,
    getStatus,
    clearQueue,
    clearCompletedRequest,
    clearAllCompletedRequests,
    connect,
    disconnect
  } = useRealTimeAI();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await getStatus();
      setLastRefresh(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTestShoppingSuggestions = async () => {
    try {
      await processRequest({
        type: 'shopping_suggestions',
        context: {
          dietaryRestrictions: ['vegetarian'],
          budget: 100,
          specialOccasions: ['weeknight']
        },
        priority: 'medium'
      });
    } catch (error: any) {
      console.error('Failed to test shopping suggestions:', error);
    }
  };

  const handleTestMealPlanning = async () => {
    try {
      await processRequest({
        type: 'meal_planning',
        context: {
          mealType: 'dinner',
          dietaryRestrictions: ['vegetarian'],
          maxPrepTime: 30,
          servings: 4,
          cuisine: 'Italian'
        },
        priority: 'medium'
      });
    } catch (error: any) {
      console.error('Failed to test meal planning:', error);
    }
  };

  const handleTestChoreAssignment = async () => {
    try {
      await processRequest({
        type: 'chore_assignment',
        context: {
          householdId: 'test-household',
          availableUsers: ['user1', 'user2'],
          choreTypes: ['cleaning', 'cooking']
        },
        priority: 'high'
      });
    } catch (error: any) {
      console.error('Failed to test chore assignment:', error);
    }
  };

  const handleTestEmailProcessing = async () => {
    try {
      await processRequest({
        type: 'email_processing',
        context: {
          emailCount: 5,
          processingType: 'bills_and_receipts'
        },
        priority: 'low'
      });
    } catch (error: any) {
      console.error('Failed to test email processing:', error);
    }
  };

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected) {
        getStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, getStatus]);

  const getRequestTypeIcon = (requestId: string) => {
    if (requestId.includes('shopping')) return <ShoppingCart className="h-4 w-4" />;
    if (requestId.includes('meal')) return <Utensils className="h-4 w-4" />;
    if (requestId.includes('chore')) return <Clock className="h-4 w-4" />;
    if (requestId.includes('email')) return <Brain className="h-4 w-4" />;
    return <Zap className="h-4 w-4" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Real-time AI Processing Dashboard
              </CardTitle>
              <CardDescription>
                Monitor and test real-time AI processing capabilities
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {isConnected ? (
                <Button onClick={disconnect} variant="destructive" size="sm">
                  Disconnect
                </Button>
              ) : (
                <Button onClick={connect} disabled={isConnecting} size="sm">
                  {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Connection Status */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {error && (
              <Badge variant="destructive">
                Error: {error}
              </Badge>
            )}
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Status Cards */}
          {status && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Connected Users</span>
                  </div>
                  <p className="text-2xl font-bold">{status.connectedUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Household Rooms</span>
                  </div>
                  <p className="text-2xl font-bold">{status.householdRooms}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Processing Queue</span>
                  </div>
                  <p className="text-2xl font-bold">{status.processingQueue}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                  <p className="text-2xl font-bold">{completedRequests.size}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="testing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="testing">AI Testing</TabsTrigger>
          <TabsTrigger value="processing">Processing Queue</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {/* AI Testing Tab */}
        <TabsContent value="testing">
          <Card>
            <CardHeader>
              <CardTitle>AI Service Testing</CardTitle>
              <CardDescription>
                Test different AI services with real-time processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={handleTestShoppingSuggestions}
                  disabled={!isConnected || processingRequests.size > 0}
                  className="flex items-center gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Test Shopping AI
                </Button>
                <Button
                  onClick={handleTestMealPlanning}
                  disabled={!isConnected || processingRequests.size > 0}
                  className="flex items-center gap-2"
                >
                  <Utensils className="h-4 w-4" />
                  Test Meal Planning AI
                </Button>
                <Button
                  onClick={handleTestChoreAssignment}
                  disabled={!isConnected || processingRequests.size > 0}
                  className="flex items-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Test Chore Assignment
                </Button>
                <Button
                  onClick={handleTestEmailProcessing}
                  disabled={!isConnected || processingRequests.size > 0}
                  className="flex items-center gap-2"
                >
                  <Brain className="h-4 w-4" />
                  Test Email Processing
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processing Queue Tab */}
        <TabsContent value="processing">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Processing Queue</CardTitle>
                  <CardDescription>
                    Current AI processing requests and their status
                  </CardDescription>
                </div>
                <Button
                  onClick={clearQueue}
                  variant="outline"
                  size="sm"
                  disabled={status?.processingQueue === 0}
                >
                  Clear Queue
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {processingRequests.size > 0 ? (
                <div className="space-y-4">
                  {Array.from(processingRequests.entries()).map(([requestId, progress]) => (
                    <div key={requestId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getRequestTypeIcon(requestId)}
                          <span className="font-medium">{progress.step}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{progress.progress}%</span>
                      </div>
                      <Progress value={progress.progress} className="h-2 mb-2" />
                      <p className="text-sm text-muted-foreground">{progress.message}</p>
                      {progress.estimatedTimeRemaining && (
                        <p className="text-xs text-muted-foreground">
                          Est. time remaining: {progress.estimatedTimeRemaining}s
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No processing requests in queue</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Processing Results</CardTitle>
                  <CardDescription>
                    Completed AI processing requests and their results
                  </CardDescription>
                </div>
                <Button
                  onClick={clearAllCompletedRequests}
                  variant="outline"
                  size="sm"
                  disabled={completedRequests.size === 0}
                >
                  Clear All Results
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {completedRequests.size > 0 ? (
                <div className="space-y-4">
                  {Array.from(completedRequests.entries()).map(([requestId, result]) => (
                    <div key={requestId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium">
                            {result.success ? 'Success' : 'Failed'}
                          </span>
                          <Badge variant="outline">{result.provider}</Badge>
                          {result.fallbackUsed && (
                            <Badge variant="secondary">Fallback</Badge>
                          )}
                        </div>
                        <Button
                          onClick={() => clearCompletedRequest(requestId)}
                          variant="ghost"
                          size="sm"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-2">
                        Request ID: {requestId}
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-2">
                        Processing Time: {result.processingTime}ms
                      </div>
                      
                      {result.error && (
                        <Alert className="mt-2">
                          <AlertDescription>{result.error}</AlertDescription>
                        </Alert>
                      )}
                      
                      {result.data && (
                        <div className="mt-2">
                          <details className="text-sm">
                            <summary className="cursor-pointer font-medium">View Results</summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed requests to display</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
