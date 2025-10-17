// Real-time AI Test Component
// This can be easily removed if the real-time processing doesn't work

'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Clock, Zap, Brain, ShoppingCart, Utensils } from 'lucide-react';

export function RealTimeAITest() {
  const {
    isConnected,
    isConnecting,
    error,
    processingRequests,
    completedRequests,
    requestAIProcessing,
    clearCompletedRequest,
    clearAllCompletedRequests
  } = useWebSocket();

  const [testResults, setTestResults] = useState<any[]>([]);

  const handleTestShoppingSuggestions = () => {
    try {
      const requestId = requestAIProcessing('shopping_suggestions', {
        dietaryRestrictions: ['vegetarian'],
        budget: 100,
        specialOccasions: ['weeknight']
      });
      console.log('Started shopping suggestions test:', requestId);
    } catch (error: any) {
      console.error('Failed to start shopping suggestions test:', error);
    }
  };

  const handleTestMealPlanning = () => {
    try {
      const requestId = requestAIProcessing('meal_planning', {
        mealType: 'dinner',
        dietaryRestrictions: ['vegetarian'],
        maxPrepTime: 30,
        servings: 4,
        cuisine: 'Italian'
      });
      console.log('Started meal planning test:', requestId);
    } catch (error: any) {
      console.error('Failed to start meal planning test:', error);
    }
  };

  const handleTestChoreAssignment = () => {
    try {
      const requestId = requestAIProcessing('chore_assignment', {
        householdId: 'test-household',
        availableUsers: ['user1', 'user2'],
        choreTypes: ['cleaning', 'cooking']
      });
      console.log('Started chore assignment test:', requestId);
    } catch (error: any) {
      console.error('Failed to start chore assignment test:', error);
    }
  };

  const handleTestEmailProcessing = () => {
    try {
      const requestId = requestAIProcessing('email_processing', {
        emailCount: 5,
        processingType: 'bills_and_receipts'
      });
      console.log('Started email processing test:', requestId);
    } catch (error: any) {
      console.error('Failed to start email processing test:', error);
    }
  };

  // Update test results when completed requests change
  useEffect(() => {
    const newResults = Array.from(completedRequests.entries()).map(([requestId, result]) => ({
      requestId,
      ...result,
      timestamp: new Date().toISOString()
    }));
    setTestResults(newResults);
  }, [completedRequests]);

  const getRequestTypeIcon = (requestId: string) => {
    if (requestId.includes('shopping')) return <ShoppingCart className="h-4 w-4" />;
    if (requestId.includes('meal')) return <Utensils className="h-4 w-4" />;
    if (requestId.includes('chore')) return <Clock className="h-4 w-4" />;
    if (requestId.includes('email')) return <Brain className="h-4 w-4" />;
    return <Zap className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Real-time AI Processing Test
          </CardTitle>
          <CardDescription>
            Test real-time AI processing with WebSocket connections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium">
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {error && (
              <Badge variant="destructive" className="ml-2">
                Error: {error}
              </Badge>
            )}
          </div>

          {/* Test Buttons */}
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

          {/* Clear Results Button */}
          {completedRequests.size > 0 && (
            <Button
              onClick={clearAllCompletedRequests}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Clear All Results
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Processing Requests */}
      {processingRequests.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Requests ({processingRequests.size})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(processingRequests.entries()).map(([requestId, progress]) => (
                <div key={requestId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getRequestTypeIcon(requestId)}
                      <span className="text-sm font-medium">{progress.step}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{progress.progress}%</span>
                  </div>
                  <Progress value={progress.progress} className="h-2" />
                  <p className="text-sm text-muted-foreground">{progress.message}</p>
                  {progress.estimatedTimeRemaining && (
                    <p className="text-xs text-muted-foreground">
                      Est. time remaining: {progress.estimatedTimeRemaining}s
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Requests */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Test Results ({testResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result) => (
                <div key={result.requestId} className="border rounded-lg p-4">
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
                      onClick={() => clearCompletedRequest(result.requestId)}
                      variant="ghost"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="text-sm text-muted-foreground mb-2">
                    Request ID: {result.requestId}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
