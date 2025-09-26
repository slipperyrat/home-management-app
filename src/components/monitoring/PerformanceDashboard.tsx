// Performance Monitoring Dashboard Component
// This can be easily removed if the performance monitoring doesn't work

'use client';

import React, { useState, useEffect } from 'react';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  Activity, 
  Zap, 
  Server, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Play,
  Pause,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';

export function PerformanceDashboard() {
  const {
    overview,
    aiMetrics,
    websocketMetrics,
    systemMetrics,
    rawMetrics,
    isLoading,
    error,
    isEnabled,
    fetchOverview,
    fetchAIMetrics,
    fetchWebSocketMetrics,
    fetchSystemMetrics,
    fetchRawMetrics,
    clearMetrics,
    enableMonitoring,
    disableMonitoring,
    recordCustomMetric,
    startAutoRefresh,
    stopAutoRefresh
  } = usePerformanceMonitoring();

  const [timeWindow, setTimeWindow] = useState(3600000); // 1 hour
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchOverview(timeWindow);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTimeWindowChange = (newTimeWindow: number) => {
    setTimeWindow(newTimeWindow);
    fetchOverview(newTimeWindow);
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

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const getStatusColor = (value: number, threshold: number) => {
    if (value <= threshold * 0.5) return 'text-green-500';
    if (value <= threshold) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusIcon = (value: number, threshold: number) => {
    if (value <= threshold * 0.5) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (value <= threshold) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Monitoring Dashboard
              </CardTitle>
              <CardDescription>
                Monitor AI system performance, WebSocket connections, and system metrics
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isEnabled ? 'default' : 'secondary'}>
                {isEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
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
              <Button
                onClick={isEnabled ? disableMonitoring : enableMonitoring}
                variant={isEnabled ? 'destructive' : 'default'}
                size="sm"
              >
                {isEnabled ? 'Disable' : 'Enable'} Monitoring
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Time Window Selector */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-medium">Time Window:</span>
            <div className="flex gap-2">
              {[
                { label: '1H', value: 3600000 },
                { label: '6H', value: 21600000 },
                { label: '24H', value: 86400000 },
                { label: '7D', value: 604800000 }
              ].map(({ label, value }) => (
                <Button
                  key={value}
                  onClick={() => handleTimeWindowChange(value)}
                  variant={timeWindow === value ? 'default' : 'outline'}
                  size="sm"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">AI Requests</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(overview.aiMetrics.totalRequests)}</p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(overview.aiMetrics.successfulRequests)} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">WebSocket Connections</span>
              </div>
              <p className="text-2xl font-bold">{overview.websocketMetrics.activeConnections}</p>
              <p className="text-xs text-muted-foreground">
                {overview.websocketMetrics.totalConnections} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Server className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Memory Usage</span>
              </div>
              <p className="text-2xl font-bold">{formatBytes(overview.systemMetrics.memoryUsage * 1024 * 1024)}</p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(overview.systemMetrics.cpuUsage)}% CPU
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Total Metrics</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(overview.totalMetrics)}</p>
              <p className="text-xs text-muted-foreground">
                Collected metrics
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ai">AI Performance</TabsTrigger>
          <TabsTrigger value="websocket">WebSocket</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="raw">Raw Data</TabsTrigger>
        </TabsList>

        {/* AI Performance Tab */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI Performance Metrics</CardTitle>
              <CardDescription>
                AI processing performance and success rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiMetrics ? (
                <div className="space-y-6">
                  {/* Success Rate */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Success Rate</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(aiMetrics.errorRate, 0.1)}
                        <span className={`text-sm font-bold ${getStatusColor(aiMetrics.errorRate, 0.1)}`}>
                          {formatNumber((1 - aiMetrics.errorRate) * 100, 1)}%
                        </span>
                      </div>
                    </div>
                    <Progress value={(1 - aiMetrics.errorRate) * 100} className="h-2" />
                  </div>

                  {/* Processing Times */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{formatNumber(aiMetrics.averageProcessingTime)}ms</p>
                      <p className="text-sm text-muted-foreground">Average</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{formatNumber(aiMetrics.p95ProcessingTime)}ms</p>
                      <p className="text-sm text-muted-foreground">P95</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{formatNumber(aiMetrics.p99ProcessingTime)}ms</p>
                      <p className="text-sm text-muted-foreground">P99</p>
                    </div>
                  </div>

                  {/* Provider Distribution */}
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Provider Distribution</span>
                    <div className="space-y-1">
                      {Object.entries(aiMetrics.providerDistribution).map(([provider, count]) => (
                        <div key={provider} className="flex items-center justify-between">
                          <span className="text-sm">{provider}</span>
                          <span className="text-sm font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fallback Usage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Fallback Usage Rate</span>
                      <span className="text-sm font-bold">{formatNumber(aiMetrics.fallbackUsageRate * 100, 1)}%</span>
                    </div>
                    <Progress value={aiMetrics.fallbackUsageRate * 100} className="h-2" />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No AI metrics available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WebSocket Tab */}
        <TabsContent value="websocket">
          <Card>
            <CardHeader>
              <CardTitle>WebSocket Metrics</CardTitle>
              <CardDescription>
                Real-time connection performance and stability
              </CardDescription>
            </CardHeader>
            <CardContent>
              {websocketMetrics ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{websocketMetrics.activeConnections}</p>
                      <p className="text-sm text-muted-foreground">Active Connections</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{formatNumber(websocketMetrics.messagesPerSecond, 1)}</p>
                      <p className="text-sm text-muted-foreground">Messages/sec</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Average Connection Duration</span>
                      <span className="text-sm font-bold">{formatDuration(websocketMetrics.averageConnectionDuration)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Reconnection Rate</span>
                      <span className="text-sm font-bold">{formatNumber(websocketMetrics.reconnectionRate * 100, 1)}%</span>
                    </div>
                    <Progress value={websocketMetrics.reconnectionRate * 100} className="h-2" />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No WebSocket metrics available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Metrics</CardTitle>
              <CardDescription>
                Server performance and resource usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {systemMetrics ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{formatBytes(systemMetrics.memoryUsage * 1024 * 1024)}</p>
                      <p className="text-sm text-muted-foreground">Memory Usage</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{formatNumber(systemMetrics.cpuUsage, 1)}%</p>
                      <p className="text-sm text-muted-foreground">CPU Usage</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Average Response Time</span>
                      <span className="text-sm font-bold">{formatNumber(systemMetrics.responseTime)}ms</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Error Rate</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(systemMetrics.errorRate, 0.05)}
                        <span className={`text-sm font-bold ${getStatusColor(systemMetrics.errorRate, 0.05)}`}>
                          {formatNumber(systemMetrics.errorRate * 100, 2)}%
                        </span>
                      </div>
                    </div>
                    <Progress value={systemMetrics.errorRate * 100} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Uptime</span>
                      <span className="text-sm font-bold">{formatDuration(systemMetrics.uptime)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No system metrics available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raw Data Tab */}
        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Raw Metrics Data</CardTitle>
                  <CardDescription>
                    Detailed performance metrics and logs
                  </CardDescription>
                </div>
                <Button
                  onClick={clearMetrics}
                  variant="destructive"
                  size="sm"
                  disabled={rawMetrics.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Metrics
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rawMetrics.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {rawMetrics.slice(-100).map((metric) => (
                    <div key={metric.id} className="border rounded p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{metric.name}</span>
                        <span className="text-muted-foreground">
                          {metric.value}{metric.unit}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {metric.timestamp.toLocaleString()} • {metric.type}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No raw metrics available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
