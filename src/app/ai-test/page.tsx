// Real-time AI Test Page
// This can be easily removed if the real-time processing doesn't work

'use client';

import React from 'react';
import { RealTimeAIDashboard } from '@/components/ai/RealTimeAIDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, Info } from 'lucide-react';

export default function AITestPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Zap className="h-8 w-8" />
          AI Testing Dashboard
        </h1>
        <p className="text-muted-foreground">
          Test and monitor real-time AI processing capabilities
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This is a testing interface for the real-time AI processing system. 
          You can test different AI services, monitor processing queues, and view results.
          All AI features can be easily disabled via environment variables if needed.
        </AlertDescription>
      </Alert>

      {/* Main Dashboard */}
      <RealTimeAIDashboard />

      {/* Footer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About This System</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This real-time AI processing system provides:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Real-time WebSocket connections for live updates</li>
            <li>• AI service integration with fallback mechanisms</li>
            <li>• Processing queue management and monitoring</li>
            <li>• Easy enable/disable via configuration</li>
            <li>• Comprehensive error handling and recovery</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4">
            If any AI feature doesn't work as expected, you can simply disable it 
            and the application will continue working with mock responses.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
