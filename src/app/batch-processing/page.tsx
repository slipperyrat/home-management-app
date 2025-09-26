// Batch Processing Page
// This can be easily removed if the batch processing doesn't work

'use client';

import React from 'react';
import { BatchProcessingDashboard } from '@/components/ai/BatchProcessingDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, Info, Zap, Activity } from 'lucide-react';

export default function BatchProcessingPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Package className="h-8 w-8" />
          Batch Processing
        </h1>
        <p className="text-muted-foreground">
          Efficiently process multiple AI requests in batches
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This batch processing system allows you to efficiently process multiple AI requests 
          in parallel or sequentially. All batch processing can be easily disabled via 
          configuration if needed.
        </AlertDescription>
      </Alert>

      {/* Main Dashboard */}
      <BatchProcessingDashboard />

      {/* Footer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Batch Processing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This batch processing system provides:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Parallel and sequential processing modes</li>
            <li>• Configurable concurrency limits and batch sizes</li>
            <li>• Automatic retry logic with exponential backoff</li>
            <li>• Real-time job monitoring and progress tracking</li>
            <li>• Easy enable/disable via configuration</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4">
            Batch processing is ideal for handling large volumes of AI requests efficiently, 
            reducing API costs and improving overall system performance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
