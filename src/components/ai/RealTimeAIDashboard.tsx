// Real-time AI Dashboard Component
// This can be easily removed if the real-time processing doesn't work

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logging/logger';
import { useRealtimeDashboard } from '@/components/ai/hooks/useRealtimeDashboard';
import type {
  ShoppingSuggestionsContext,
  MealPlanningContext,
  ChoreAssignmentContext,
  EmailProcessingContext,
  ProgressUpdate,
  CompletedResult,
  RealtimeStatus,
} from '@/components/ai/types/dashboard';
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
    sendRequest,
    buildRequest,
    getStatus,
    clearQueue,
    clearCompletedRequest,
    clearAllCompletedRequests,
    connect,
    disconnect
  } = useRealtimeDashboard();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await getStatus();
      setLastRefresh(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [getStatus]);

  const handleRequestError = useCallback((message: string, error: unknown) => {
    logger.error(message, error instanceof Error ? error : new Error(String(error)));
    toast.error(message);
  }, []);

  const handleTestShoppingSuggestions = useCallback(async () => {
    try {
      const payload = buildRequest<ShoppingSuggestionsContext>(
        'shopping_suggestions',
        {
          dietaryRestrictions: ['vegetarian'],
          budget: 100,
          specialOccasions: ['weeknight'],
        },
        'medium',
      );
      await sendRequest(payload);
      toast.success('Shopping suggestions request queued');
    } catch (error) {
      handleRequestError('Failed to test shopping suggestions', error);
    }
  }, [buildRequest, handleRequestError, sendRequest]);

  const handleTestMealPlanning = useCallback(async () => {
    try {
      const payload = buildRequest<MealPlanningContext>(
        'meal_planning',
        {
          mealType: 'dinner',
          dietaryRestrictions: ['vegetarian'],
          maxPrepTime: 30,
          servings: 4,
          cuisine: 'Italian',
        },
        'medium',
      );
      await sendRequest(payload);
      toast.success('Meal planning request queued');
    } catch (error) {
      handleRequestError('Failed to test meal planning', error);
    }
  }, [buildRequest, handleRequestError, sendRequest]);

  const handleTestChoreAssignment = useCallback(async () => {
    try {
      const payload = buildRequest<ChoreAssignmentContext>(
        'chore_assignment',
        {
          householdId: 'test-household',
          availableUsers: ['user1', 'user2'],
          choreTypes: ['cleaning', 'cooking'],
        },
        'high',
      );
      await sendRequest(payload);
      toast.success('Chore assignment request queued');
    } catch (error) {
      handleRequestError('Failed to test chore assignment', error);
    }
  }, [buildRequest, handleRequestError, sendRequest]);

  const handleTestEmailProcessing = useCallback(async () => {
    try {
      const payload = buildRequest<EmailProcessingContext>(
        'email_processing',
        {
          emailCount: 5,
          processingType: 'bills_and_receipts',
        },
        'low',
      );
      await sendRequest(payload);
      toast.success('Email processing request queued');
    } catch (error) {
      handleRequestError('Failed to test email processing', error);
    }
  }, [buildRequest, handleRequestError, sendRequest]);

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected) {
        void getStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, getStatus]);

  const getRequestTypeIcon = useCallback((requestId: string) => {
    if (requestId.includes('shopping')) return <ShoppingCart className="h-4 w-4" />;
    if (requestId.includes('meal')) return <Utensils className="h-4 w-4" />;
    if (requestId.includes('chore')) return <Clock className="h-4 w-4" />;
    if (requestId.includes('email')) return <Brain className="h-4 w-4" />;
    return <Zap className="h-4 w-4" />;
  }, []);

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
            {error ? (
              <Badge variant="destructive">
                Error: {error}
              </Badge>
            ) : null}
            {lastRefresh ? (
              <span className="text-xs text-muted-foreground">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </span>
            ) : null}
          </div>

          {/* Status Cards */}
          {status ? (
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
                  <p className="text-2xl font-bold">{completedRequests.length}</p>
                </CardContent>
              </Card>
            </div>
          ) : null}
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
                  disabled={!isConnected || processingRequests.length > 0}
                  className="flex items-center gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Test Shopping AI
                </Button>
                <Button
                  onClick={handleTestMealPlanning}
                  disabled={!isConnected || processingRequests.length > 0}
                  className="flex items-center gap-2"
                >
                  <Utensils className="h-4 w-4" />
                  Test Meal Planning AI
                </Button>
                <Button
                  onClick={handleTestChoreAssignment}
                  disabled={!isConnected || processingRequests.length > 0}
                  className="flex items-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Test Chore Assignment
                </Button>
                <Button
                  onClick={handleTestEmailProcessing}
                  disabled={!isConnected || processingRequests.length > 0}
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
                  onClick={() => {
                    clearQueue();
                    toast.success('Processing queue cleared');
                  }}
                  variant="outline"
                  size="sm"
                  disabled={(status as RealtimeStatus | null)?.processingQueue === 0}
                >
                  Clear Queue
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {processingRequests.length > 0 ? (
                <div className="space-y-4">
                  {processingRequests.map(([requestId, progress]) => (
                    <ProcessingRequestCard
                      key={requestId}
                      requestId={requestId}
                      progress={progress}
                      getRequestTypeIcon={getRequestTypeIcon}
                    />
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
                  onClick={() => {
                    clearAllCompletedRequests();
                    toast.success('All results cleared');
                  }}
                  variant="outline"
                  size="sm"
                  disabled={completedRequests.length === 0}
                >
                  Clear All Results
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {completedRequests.length > 0 ? (
                <div className="space-y-4">
                  {completedRequests.map(([requestId, result]) => (
                    <CompletedResultCard
                      key={requestId}
                      requestId={requestId}
                      result={result}
                      onClear={() => {
                        clearCompletedRequest(requestId);
                        toast.success('Result removed');
                      }}
                    />
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

interface ProcessingRequestCardProps {
  requestId: string;
  progress: ProgressUpdate;
  getRequestTypeIcon: (requestId: string) => JSX.Element;
}

function ProcessingRequestCard({ requestId, progress, getRequestTypeIcon }: ProcessingRequestCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getRequestTypeIcon(requestId)}
          <span className="font-medium">{progress.step}</span>
        </div>
        <span className="text-sm text-muted-foreground">{progress.progress}%</span>
      </div>
      <Progress value={progress.progress} className="h-2 mb-2" />
      <p className="text-sm text-muted-foreground">{progress.message}</p>
      {progress.estimatedTimeRemaining ? (
        <p className="text-xs text-muted-foreground">
          Est. time remaining: {progress.estimatedTimeRemaining}s
        </p>
      ) : null}
    </div>
  );
}

interface CompletedResultCardProps {
  requestId: string;
  result: CompletedResult;
  onClear: () => void;
}

function CompletedResultCard({ requestId, result, onClear }: CompletedResultCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {result.success ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="font-medium">{result.success ? 'Success' : 'Failed'}</span>
          <Badge variant="outline">{result.provider}</Badge>
          {result.fallbackUsed ? <Badge variant="secondary">Fallback</Badge> : null}
        </div>
        <Button onClick={onClear} variant="ghost" size="sm">
          <XCircle className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-sm text-muted-foreground mb-2">Request ID: {requestId}</div>
      <div className="text-sm text-muted-foreground mb-2">Processing Time: {result.processingTime}ms</div>
      {result.error ? (
        <Alert className="mt-2">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : null}
      {result.data ? (
        <div className="mt-2">
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">View Results</summary>
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
