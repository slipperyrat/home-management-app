// Performance Monitoring Service for AI System
// This can be easily removed if the performance monitoring doesn't work

import { logger } from '@/lib/logging/logger';

export interface PerformanceMetric {
  id: string;
  type: 'ai_processing' | 'websocket_connection' | 'api_request' | 'database_query' | 'user_action';
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes' | 'percentage';
  timestamp: Date;
  metadata?: Record<string, unknown>;
  userId?: string;
  householdId?: string;
  requestId?: string;
}

export interface AIPerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  p95ProcessingTime: number;
  p99ProcessingTime: number;
  fallbackUsageRate: number;
  providerDistribution: Record<string, number>;
  errorRate: number;
  throughputPerMinute: number;
}

export interface WebSocketMetrics {
  totalConnections: number;
  activeConnections: number;
  averageConnectionDuration: number;
  messagesPerSecond: number;
  reconnectionRate: number;
  errorRate: number;
}

export interface SystemMetrics {
  memoryUsage: number | null;
  cpuUsage: number | null;
  responseTime: number;
  errorRate: number;
  uptime: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 10000; // Keep last 10k metrics
  private isEnabled: boolean = true;
  private startTime: Date = new Date();

  constructor() {
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    logger.info('Performance Monitor initialized');
    this.startSystemMetricsCollection();
  }

  public recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    if (!this.isEnabled) return;

    const fullMetric: PerformanceMetric = {
      ...metric,
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.metrics.push(fullMetric);

    // Keep only the last maxMetrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log high-value metrics
    if (metric.value > 5000) {
      logger.warn('High-value performance metric detected', {
        metric: metric.name,
        value: metric.value,
        unit: metric.unit,
      });
    }
  }

  public recordAIProcessing(
    type: string,
    processingTime: number,
    success: boolean,
    provider: string,
    fallbackUsed: boolean,
    userId?: string,
    householdId?: string,
    requestId?: string
  ): void {
    const context = {
      ...(userId ? { userId } : {}),
      ...(householdId ? { householdId } : {}),
      ...(requestId ? { requestId } : {}),
    } satisfies Partial<Pick<PerformanceMetric, 'userId' | 'householdId' | 'requestId'>>;

    this.recordMetric({
      type: 'ai_processing',
      name: `ai_${type}_processing_time`,
      value: processingTime,
      unit: 'ms',
      metadata: {
        aiType: type,
        success,
        provider,
        fallbackUsed
      },
      ...context,
    });

    this.recordMetric({
      type: 'ai_processing',
      name: `ai_${type}_success`,
      value: success ? 1 : 0,
      unit: 'count',
      metadata: {
        aiType: type,
        provider,
        fallbackUsed
      },
      ...context,
    });
  }

  public recordWebSocketConnection(
    action: 'connect' | 'disconnect' | 'reconnect',
    duration?: number,
    userId?: string
  ): void {
    this.recordMetric({
      type: 'websocket_connection',
      name: `websocket_${action}`,
      value: duration || 1,
      unit: action === 'disconnect' && duration ? 'ms' : 'count',
      metadata: { action },
      ...(userId ? { userId } : {}),
    });
  }

  public recordAPIRequest(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    userId?: string
  ): void {
    this.recordMetric({
      type: 'api_request',
      name: `api_${method.toLowerCase()}_${endpoint.replace(/\//g, '_')}`,
      value: responseTime,
      unit: 'ms',
      metadata: {
        endpoint,
        method,
        statusCode
      },
      ...(userId ? { userId } : {}),
    });
  }

  public recordDatabaseQuery(
    query: string,
    executionTime: number,
    success: boolean,
    userId?: string
  ): void {
    this.recordMetric({
      type: 'database_query',
      name: 'database_query_execution',
      value: executionTime,
      unit: 'ms',
      metadata: {
        query: query.substring(0, 100), // Truncate long queries
        success
      },
      ...(userId ? { userId } : {}),
    });
  }

  public recordUserAction(
    action: string,
    duration: number,
    userId: string,
    householdId?: string
  ): void {
    this.recordMetric({
      type: 'user_action',
      name: `user_${action}`,
      value: duration,
      unit: 'ms',
      metadata: { action },
      userId,
      ...(householdId ? { householdId } : {}),
    });
  }

  public getAIPerformanceMetrics(timeWindow: number = 3600000): AIPerformanceMetrics {
    const cutoffTime = new Date(Date.now() - timeWindow);
    const aiMetrics = this.metrics.filter(
      m => m.type === 'ai_processing' && m.timestamp >= cutoffTime
    );

    const processingTimes = aiMetrics
      .filter(m => m.name.includes('processing_time'))
      .map(m => m.value);

    const successCounts = aiMetrics
      .filter(m => m.name.includes('success'))
      .map(m => m.value);

    const totalRequests = aiMetrics.length / 2; // Each AI request creates 2 metrics
    const successfulRequests = successCounts.reduce((sum, val) => sum + val, 0);
    const failedRequests = aiMetrics.filter(m => {
      const statusCode = m.metadata?.statusCode;
      return typeof statusCode === 'number' && statusCode >= 400;
    }).length;

    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, val) => sum + val, 0) / processingTimes.length 
      : 0;

    const sortedTimes = processingTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    const p95ProcessingTime = sortedTimes[p95Index] || 0;
    const p99ProcessingTime = sortedTimes[p99Index] || 0;

    const fallbackMetrics = aiMetrics.filter(m => m.metadata?.fallbackUsed);
    const fallbackUsageRate = totalRequests > 0 ? fallbackMetrics.length / totalRequests : 0;

    const providerCounts: Record<string, number> = {};
    aiMetrics.forEach(m => {
      const provider = typeof m.metadata?.provider === 'string' ? m.metadata.provider : undefined;
      if (provider) {
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      }
    });

    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;
    const throughputPerMinute = (totalRequests / timeWindow) * 60000;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageProcessingTime,
      p95ProcessingTime,
      p99ProcessingTime,
      fallbackUsageRate,
      providerDistribution: providerCounts,
      errorRate,
      throughputPerMinute
    };
  }

  public getWebSocketMetrics(timeWindow: number = 3600000): WebSocketMetrics {
    const cutoffTime = new Date(Date.now() - timeWindow);
    const wsMetrics = this.metrics.filter(
      m => m.type === 'websocket_connection' && m.timestamp >= cutoffTime
    );

    const connections = wsMetrics.filter(m => m.name.includes('connect'));
    const disconnections = wsMetrics.filter(m => m.name.includes('disconnect'));
    const reconnections = wsMetrics.filter(m => m.name.includes('reconnect'));

    const totalConnections = connections.length;
    const activeConnections = totalConnections - disconnections.length;

    const connectionDurations = disconnections
      .filter(m => m.unit === 'ms')
      .map(m => m.value);

    const averageConnectionDuration = connectionDurations.length > 0
      ? connectionDurations.reduce((sum, val) => sum + val, 0) / connectionDurations.length
      : 0;

    const messagesPerSecond = wsMetrics.length / (timeWindow / 1000);
    const reconnectionRate = totalConnections > 0 ? reconnections.length / totalConnections : 0;
    const errorRate = 0; // Would need error tracking for WebSocket

    return {
      totalConnections,
      activeConnections,
      averageConnectionDuration,
      messagesPerSecond,
      reconnectionRate,
      errorRate
    };
  }

  public getSystemMetrics(): SystemMetrics {
    const totalRequests = this.metrics.length;
    const errorMetrics = this.metrics.filter(m => m.name.includes('error'));
    const avgResponseTimeMetrics = this.metrics.filter(m => m.type === 'api_request');

    const nodeProcess = typeof globalThis !== 'undefined' && (globalThis as { process?: NodeJS.Process }).process
    const memoryUsage = nodeProcess && typeof nodeProcess.memoryUsage === 'function'
      ? nodeProcess.memoryUsage().heapUsed / 1024 / 1024
      : null
    const cpuUsage = nodeProcess && typeof nodeProcess.cpuUsage === 'function'
      ? nodeProcess.cpuUsage().user / 1000
      : null

    const avgResponseTime = avgResponseTimeMetrics.length > 0
      ? avgResponseTimeMetrics.reduce((sum, metric) => sum + metric.value, 0) / avgResponseTimeMetrics.length
      : 0;

    const errorRate = totalRequests > 0
      ? errorMetrics.length / totalRequests
      : 0;

    const uptime = (Date.now() - this.startTime.getTime()) / (1000 * 60 * 60); // hours

    return {
      memoryUsage,
      cpuUsage,
      responseTime: avgResponseTime,
      errorRate,
      uptime,
    };
  }

  // Removed unused helper methods for average response time and error rate

  private startSystemMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      if (this.isEnabled) {
        const systemMetrics = this.getSystemMetrics();
        
        if (typeof systemMetrics.memoryUsage === 'number') {
          this.recordMetric({
            type: 'api_request',
            name: 'system_memory_usage',
            value: systemMetrics.memoryUsage ?? 0,
            unit: 'bytes',
            metadata: { metricType: 'system' }
          });
        }

        this.recordMetric({
          type: 'api_request',
          name: 'system_cpu_usage',
          value: systemMetrics.cpuUsage ?? 0,
          unit: 'percentage',
          metadata: { metricType: 'system' }
        });
      }
    }, 30000);
  }

  public getMetrics(timeWindow?: number): PerformanceMetric[] {
    if (!timeWindow) return this.metrics;

    const cutoffTime = new Date(Date.now() - timeWindow);
    return this.metrics.filter(m => m.timestamp >= cutoffTime);
  }

  public clearMetrics(): void {
    this.metrics = [];
    logger.info('Performance metrics cleared');
  }

  public enable(): void {
    this.isEnabled = true;
    logger.info('Performance monitoring enabled');
  }

  public disable(): void {
    this.isEnabled = false;
    logger.info('Performance monitoring disabled');
  }

  public isMonitoringEnabled(): boolean {
    return this.isEnabled;
  }

  public getMetricsCount(): number {
    return this.metrics.length;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();
