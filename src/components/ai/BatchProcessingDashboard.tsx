// Batch Processing Dashboard Component
// This can be easily removed if the batch processing doesn't work

'use client';

import React, { useState, useEffect } from 'react';
import { useBatchProcessing } from '@/hooks/useBatchProcessing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Package, 
  Play, 
  Pause, 
  X, 
  RefreshCw, 
  Settings, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Plus,
  BarChart3,
  Activity
} from 'lucide-react';

export function BatchProcessingDashboard() {
  const {
    overview,
    jobs,
    queue,
    config,
    isLoading,
    error,
    createBatchJob,
    processBatchJob,
    cancelBatchJob,
    updateConfig,
    fetchOverview,
    fetchJobs,
    fetchQueue,
    fetchConfig,
    startAutoRefresh,
    stopAutoRefresh
  } = useBatchProcessing();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [newJobDescription, setNewJobDescription] = useState('');
  const [newJobRequests, setNewJobRequests] = useState('');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchOverview(), fetchJobs(), fetchQueue()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAutoRefreshToggle = () => {
    if (autoRefreshEnabled) {
      stopAutoRefresh();
      setAutoRefreshEnabled(false);
    } else {
      startAutoRefresh(30000); // 30 seconds
      setAutoRefreshEnabled(true);
    }
  };

  const handleCreateJob = async () => {
    if (!newJobName || !newJobDescription || !newJobRequests) {
      alert('Please fill in all fields');
      return;
    }

    try {
      // Parse requests from JSON string
      const requests = JSON.parse(newJobRequests);
      
      await createBatchJob(newJobName, newJobDescription, requests);
      
      // Reset form
      setNewJobName('');
      setNewJobDescription('');
      setNewJobRequests('');
      setShowCreateJob(false);
      
      alert('Batch job created successfully!');
    } catch (error: any) {
      alert(`Failed to create batch job: ${error.message}`);
    }
  };

  const handleProcessJob = async (jobId: string) => {
    try {
      await processBatchJob(jobId);
      alert('Batch job processing started!');
    } catch (error: any) {
      alert(`Failed to process batch job: ${error.message}`);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelBatchJob(jobId);
      alert('Batch job cancelled!');
    } catch (error: any) {
      alert(`Failed to cancel batch job: ${error.message}`);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'processing': return 'text-blue-500';
      case 'pending': return 'text-yellow-500';
      case 'failed': return 'text-red-500';
      case 'cancelled': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing': return <Activity className="h-4 w-4 text-blue-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled': return <X className="h-4 w-4 text-gray-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-500" />;
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
                <Package className="h-5 w-5" />
                Batch Processing Dashboard
              </CardTitle>
              <CardDescription>
                Manage and monitor batch AI processing jobs
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowCreateJob(!showCreateJob)}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Create Job
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={handleAutoRefreshToggle}
                variant={autoRefreshEnabled ? 'default' : 'outline'}
                size="sm"
              >
                {autoRefreshEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                Auto Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Error Display */}
          {error && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Create Job Form */}
      {showCreateJob && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Batch Job</CardTitle>
            <CardDescription>
              Create a new batch processing job with multiple AI requests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="jobName">Job Name</Label>
              <Input
                id="jobName"
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                placeholder="Enter job name"
              />
            </div>
            <div>
              <Label htmlFor="jobDescription">Description</Label>
              <Textarea
                id="jobDescription"
                value={newJobDescription}
                onChange={(e) => setNewJobDescription(e.target.value)}
                placeholder="Enter job description"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="jobRequests">Requests (JSON)</Label>
              <Textarea
                id="jobRequests"
                value={newJobRequests}
                onChange={(e) => setNewJobRequests(e.target.value)}
                placeholder='[{"type": "shopping_suggestions", "context": {"dietaryRestrictions": ["vegetarian"]}, "priority": "medium"}]'
                rows={6}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateJob} disabled={isLoading}>
                Create Job
              </Button>
              <Button onClick={() => setShowCreateJob(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Total Jobs</span>
              </div>
              <p className="text-2xl font-bold">{overview.totalJobs}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Active Jobs</span>
              </div>
              <p className="text-2xl font-bold">{overview.activeJobs}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Pending Jobs</span>
              </div>
              <p className="text-2xl font-bold">{overview.pendingJobs}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Queue Size</span>
              </div>
              <p className="text-2xl font-bold">{overview.queueSize}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Jobs Tab */}
        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle>Batch Jobs</CardTitle>
              <CardDescription>
                Manage and monitor batch processing jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length > 0 ? (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <div key={job.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <span className="font-medium">{job.name}</span>
                          <Badge variant="outline">{job.status}</Badge>
                        </div>
                        <div className="flex gap-2">
                          {job.status === 'pending' && (
                            <Button
                              onClick={() => handleProcessJob(job.id)}
                              size="sm"
                              variant="outline"
                            >
                              <Play className="h-4 w-4" />
                              Process
                            </Button>
                          )}
                          {(job.status === 'pending' || job.status === 'processing') && (
                            <Button
                              onClick={() => handleCancelJob(job.id)}
                              size="sm"
                              variant="destructive"
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">{job.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total Requests:</span>
                          <span className="ml-2 font-medium">{job.totalRequests}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Successful:</span>
                          <span className="ml-2 font-medium text-green-600">{job.successfulRequests}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Failed:</span>
                          <span className="ml-2 font-medium text-red-600">{job.failedRequests}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Time:</span>
                          <span className="ml-2 font-medium">{formatDuration(job.averageProcessingTime)}</span>
                        </div>
                      </div>

                      {job.status === 'processing' && (
                        <div className="mt-2">
                          <Progress value={(job.successfulRequests + job.failedRequests) / job.totalRequests * 100} className="h-2" />
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground mt-2">
                        Created: {job.createdAt.toLocaleString()}
                        {job.completedAt && (
                          <span> • Completed: {job.completedAt.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No batch jobs found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Tab */}
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle>Processing Queue</CardTitle>
              <CardDescription>
                Current requests in the processing queue
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queue.length > 0 ? (
                <div className="space-y-2">
                  {queue.map((request) => (
                    <div key={request.id} className="border rounded p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{request.type}</Badge>
                          <Badge variant="secondary">{request.priority}</Badge>
                        </div>
                        <span className="text-muted-foreground">
                          Retry: {request.retryCount}/{request.maxRetries}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created: {request.createdAt.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No requests in queue</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Batch Processing Configuration</CardTitle>
              <CardDescription>
                Configure batch processing settings and limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              {config ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Max Concurrent Requests</Label>
                      <Input
                        type="number"
                        value={config.maxConcurrentRequests}
                        onChange={(e) => updateConfig({ maxConcurrentRequests: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Batch Size</Label>
                      <Input
                        type="number"
                        value={config.batchSize}
                        onChange={(e) => updateConfig({ batchSize: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Retry Delay (ms)</Label>
                      <Input
                        type="number"
                        value={config.retryDelay}
                        onChange={(e) => updateConfig({ retryDelay: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Max Retries</Label>
                      <Input
                        type="number"
                        value={config.maxRetries}
                        onChange={(e) => updateConfig({ maxRetries: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Timeout (ms)</Label>
                      <Input
                        type="number"
                        value={config.timeout}
                        onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="parallelProcessing"
                        checked={config.enableParallelProcessing}
                        onChange={(e) => updateConfig({ enableParallelProcessing: e.target.checked })}
                      />
                      <Label htmlFor="parallelProcessing">Enable Parallel Processing</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enableRetry"
                        checked={config.enableRetry}
                        onChange={(e) => updateConfig({ enableRetry: e.target.checked })}
                      />
                      <Label htmlFor="enableRetry">Enable Retry</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enableFallback"
                        checked={config.enableFallback}
                        onChange={(e) => updateConfig({ enableFallback: e.target.checked })}
                      />
                      <Label htmlFor="enableFallback">Enable Fallback</Label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No configuration available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
