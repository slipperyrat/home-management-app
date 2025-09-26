// Performance Monitoring Page
// This can be easily removed if the performance monitoring doesn't work

'use client';

import React from 'react';
import { PerformanceDashboard } from '@/components/monitoring/PerformanceDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart3, Info, Zap, Activity } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <BarChart3 className="h-8 w-8" />
          Performance Monitoring
        </h1>
        <p className="text-muted-foreground">
          Monitor AI system performance, WebSocket connections, and system metrics
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This performance monitoring system tracks AI processing metrics, WebSocket connections, 
          and system performance. All monitoring can be easily disabled via configuration if needed.
        </AlertDescription>
      </Alert>

      {/* Main Dashboard */}
      <PerformanceDashboard />

      {/* Footer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Performance Monitoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This performance monitoring system provides:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Real-time AI processing metrics and success rates</li>
            <li>• WebSocket connection monitoring and stability tracking</li>
            <li>• System resource usage and performance metrics</li>
            <li>• Detailed raw metrics and logging</li>
            <li>• Easy enable/disable via configuration</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4">
            Performance monitoring helps identify bottlenecks, track system health, 
            and optimize AI processing performance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
