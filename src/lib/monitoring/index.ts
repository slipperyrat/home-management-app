// Comprehensive monitoring system for performance, user behavior, and AI accuracy
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  context: Record<string, any> | undefined;
}

export interface UserBehaviorEvent {
  action: string;
  userId: string;
  householdId: string | undefined;
  context: Record<string, any>;
  timestamp: number;
  sessionId: string;
}

export interface AIMetric {
  prediction: any;
  actual: any;
  confidence: number;
  processingTime: number;
  model: string;
  timestamp: number;
  context: Record<string, any> | undefined;
}

export interface ErrorEvent {
  error: string;
  stack: string | undefined;
  userId: string | undefined;
  context: Record<string, any>;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: PerformanceMetric[] = [];
  private userEvents: UserBehaviorEvent[] = [];
  private aiMetrics: AIMetric[] = [];
  private errors: ErrorEvent[] = [];
  private readonly maxMetrics = 1000;
  private readonly maxEvents = 1000;
  private readonly maxErrors = 500;

  private constructor() {
    this.setupPeriodicFlush();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // Performance monitoring
  trackAPIPerformance(endpoint: string, duration: number, context?: Record<string, any>): void {
    this.addMetric({
      name: `api.${endpoint}.duration`,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      context: { endpoint, ...context }
    });
  }

  trackPageLoad(page: string, loadTime: number, context?: Record<string, any>): void {
    this.addMetric({
      name: `page.${page}.load_time`,
      value: loadTime,
      unit: 'ms',
      timestamp: Date.now(),
      context: { page, ...context }
    });
  }

  trackDatabaseQuery(query: string, duration: number, context?: Record<string, any>): void {
    this.addMetric({
      name: 'database.query.duration',
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      context: { query, ...context }
    });
  }

  trackCachePerformance(operation: 'hit' | 'miss', duration: number, context?: Record<string, any>): void {
    this.addMetric({
      name: `cache.${operation}.duration`,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      context: context || {}
    });
  }

  // User behavior tracking
  trackUserBehavior(
    action: string, 
    userId: string, 
    context: Record<string, any> = {},
    householdId?: string
  ): void {
    const event: UserBehaviorEvent = {
      action,
      userId,
      householdId,
      context,
      timestamp: Date.now(),
      sessionId: this.getSessionId()
    };

    this.addUserEvent(event);
  }

  trackFeatureUsage(feature: string, userId: string, context?: Record<string, any>): void {
    this.trackUserBehavior(`feature.${feature}.used`, userId, context);
  }

  trackOnboardingStep(step: string, userId: string, completed: boolean, context?: Record<string, any>): void {
    this.trackUserBehavior(`onboarding.${step}.${completed ? 'completed' : 'started'}`, userId, context);
  }

  // AI performance monitoring
  trackAIPrediction(
    prediction: any,
    actual: any,
    confidence: number,
    processingTime: number,
    model: string,
    context?: Record<string, any>
  ): void {
    const metric: AIMetric = {
      prediction,
      actual,
      confidence,
      processingTime,
      model,
      timestamp: Date.now(),
      context
    };

    this.addAIMetric(metric);
  }

  trackAIAccuracy(prediction: any, actual: any, context?: Record<string, any>): void {
    const accuracy = this.calculateAccuracy(prediction, actual);
    this.addMetric({
      name: 'ai.accuracy',
      value: accuracy,
      unit: 'percentage',
      timestamp: Date.now(),
      context
    });
  }

  // Error tracking
  trackError(
    error: string,
    stack?: string,
    userId?: string,
    context: Record<string, any> = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    const errorEvent: ErrorEvent = {
      error,
      stack,
      userId,
      context,
      timestamp: Date.now(),
      severity
    };

    this.addError(errorEvent);
  }

  // Analytics and insights
  getPerformanceInsights(): {
    averageAPIDuration: number;
    slowestEndpoints: Array<{ endpoint: string; avgDuration: number }>;
    pageLoadPerformance: Array<{ page: string; avgLoadTime: number }>;
    databasePerformance: { avgQueryTime: number; totalQueries: number };
    cachePerformance: { hitRate: number; avgHitTime: number; avgMissTime: number };
  } {
    const apiMetrics = this.metrics.filter(m => m.name.startsWith('api.'));
    const pageMetrics = this.metrics.filter(m => m.name.startsWith('page.'));
    const dbMetrics = this.metrics.filter(m => m.name === 'database.query.duration');
    const cacheHitMetrics = this.metrics.filter(m => m.name === 'cache.hit.duration');
    const cacheMissMetrics = this.metrics.filter(m => m.name === 'cache.miss.duration');

    // Calculate API performance
    const endpointGroups = this.groupMetricsByEndpoint(apiMetrics);
    const slowestEndpoints = Object.entries(endpointGroups)
      .map(([endpoint, metrics]) => ({
        endpoint,
        avgDuration: metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);

    // Calculate page performance
    const pageGroups = this.groupMetricsByPage(pageMetrics);
    const pageLoadPerformance = Object.entries(pageGroups)
      .map(([page, metrics]) => ({
        page,
        avgLoadTime: metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
      }))
      .sort((a, b) => b.avgLoadTime - a.avgLoadTime);

    // Calculate database performance
    const avgQueryTime = dbMetrics.length > 0 
      ? dbMetrics.reduce((sum, m) => sum + m.value, 0) / dbMetrics.length 
      : 0;

    // Calculate cache performance
    const hitRate = cacheHitMetrics.length / (cacheHitMetrics.length + cacheMissMetrics.length);
    const avgHitTime = cacheHitMetrics.length > 0 
      ? cacheHitMetrics.reduce((sum, m) => sum + m.value, 0) / cacheHitMetrics.length 
      : 0;
    const avgMissTime = cacheMissMetrics.length > 0 
      ? cacheMissMetrics.reduce((sum, m) => sum + m.value, 0) / cacheMissMetrics.length 
      : 0;

    return {
      averageAPIDuration: apiMetrics.length > 0 
        ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length 
        : 0,
      slowestEndpoints,
      pageLoadPerformance,
      databasePerformance: {
        avgQueryTime,
        totalQueries: dbMetrics.length
      },
      cachePerformance: {
        hitRate,
        avgHitTime,
        avgMissTime
      }
    };
  }

  getUserBehaviorInsights(): {
    mostUsedFeatures: Array<{ feature: string; usageCount: number }>;
    userEngagement: { totalActions: number; uniqueUsers: number; avgActionsPerUser: number };
    onboardingCompletion: { started: number; completed: number; completionRate: number };
  } {
    const featureEvents = this.userEvents.filter(e => e.action.startsWith('feature.'));
    const onboardingEvents = this.userEvents.filter(e => e.action.startsWith('onboarding.'));

    // Feature usage analysis
    const featureUsage = new Map<string, number>();
    featureEvents.forEach(event => {
      const feature = event.action.split('.')[1];
      if (feature) {
        featureUsage.set(feature, (featureUsage.get(feature) || 0) + 1);
      }
    });

    const mostUsedFeatures = Array.from(featureUsage.entries())
      .map(([feature, count]) => ({ feature, usageCount: count }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    // User engagement analysis
    const uniqueUsers = new Set(this.userEvents.map(e => e.userId));
    const totalActions = this.userEvents.length;
    const avgActionsPerUser = totalActions / uniqueUsers.size;

    // Onboarding analysis
    const onboardingStarted = onboardingEvents.filter(e => e.action.includes('.started')).length;
    const onboardingCompleted = onboardingEvents.filter(e => e.action.includes('.completed')).length;
    const completionRate = onboardingStarted > 0 ? onboardingCompleted / onboardingStarted : 0;

    return {
      mostUsedFeatures,
      userEngagement: {
        totalActions,
        uniqueUsers: uniqueUsers.size,
        avgActionsPerUser
      },
      onboardingCompletion: {
        started: onboardingStarted,
        completed: onboardingCompleted,
        completionRate
      }
    };
  }

  getAIInsights(): {
    averageConfidence: number;
    averageProcessingTime: number;
    accuracyTrend: Array<{ date: string; accuracy: number }>;
    modelPerformance: Array<{ model: string; avgConfidence: number; avgProcessingTime: number }>;
  } {
    if (this.aiMetrics.length === 0) {
      return {
        averageConfidence: 0,
        averageProcessingTime: 0,
        accuracyTrend: [],
        modelPerformance: []
      };
    }

    const avgConfidence = this.aiMetrics.reduce((sum, m) => sum + m.confidence, 0) / this.aiMetrics.length;
    const avgProcessingTime = this.aiMetrics.reduce((sum, m) => sum + m.processingTime, 0) / this.aiMetrics.length;

    // Accuracy trend (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentMetrics = this.aiMetrics.filter(m => m.timestamp > thirtyDaysAgo);
    
    const accuracyTrend = this.calculateAccuracyTrend(recentMetrics);

    // Model performance
    const modelGroups = this.groupAIMetricsByModel(this.aiMetrics);
    const modelPerformance = Object.entries(modelGroups).map(([model, metrics]) => ({
      model,
      avgConfidence: metrics.reduce((sum, m) => sum + m.confidence, 0) / metrics.length,
      avgProcessingTime: metrics.reduce((sum, m) => sum + m.processingTime, 0) / metrics.length
    }));

    return {
      averageConfidence: avgConfidence,
      averageProcessingTime: avgProcessingTime,
      accuracyTrend,
      modelPerformance
    };
  }

  // Export data for external monitoring systems
  exportMetrics(): {
    performance: PerformanceMetric[];
    userBehavior: UserBehaviorEvent[];
    aiMetrics: AIMetric[];
    errors: ErrorEvent[];
  } {
    return {
      performance: [...this.metrics],
      userBehavior: [...this.userEvents],
      aiMetrics: [...this.aiMetrics],
      errors: [...this.errors]
    };
  }

  // Clear old data
  clearOldData(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    this.userEvents = this.userEvents.filter(e => e.timestamp > cutoff);
    this.aiMetrics = this.aiMetrics.filter(m => m.timestamp > cutoff);
    this.errors = this.errors.filter(e => e.timestamp > cutoff);
  }

  // Private helper methods
  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  private addUserEvent(event: UserBehaviorEvent): void {
    this.userEvents.push(event);
    if (this.userEvents.length > this.maxEvents) {
      this.userEvents = this.userEvents.slice(-this.maxEvents);
    }
  }

  private addAIMetric(metric: AIMetric): void {
    this.aiMetrics.push(metric);
    if (this.aiMetrics.length > this.maxMetrics) {
      this.aiMetrics = this.aiMetrics.slice(-this.maxMetrics);
    }
  }

  private addError(error: ErrorEvent): void {
    this.errors.push(error);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }

  private groupMetricsByEndpoint(metrics: PerformanceMetric[]): Record<string, PerformanceMetric[]> {
    const groups: Record<string, PerformanceMetric[]> = {};
    metrics.forEach(metric => {
      const endpoint = metric.context?.endpoint || 'unknown';
      if (!groups[endpoint]) groups[endpoint] = [];
      groups[endpoint].push(metric);
    });
    return groups;
  }

  private groupMetricsByPage(metrics: PerformanceMetric[]): Record<string, PerformanceMetric[]> {
    const groups: Record<string, PerformanceMetric[]> = {};
    metrics.forEach(metric => {
      const page = metric.context?.page || 'unknown';
      if (!groups[page]) groups[page] = [];
      groups[page].push(metric);
    });
    return groups;
  }

  private groupAIMetricsByModel(metrics: AIMetric[]): Record<string, AIMetric[]> {
    const groups: Record<string, AIMetric[]> = {};
    metrics.forEach(metric => {
      const model = metric.model || 'unknown';
      if (!groups[model]) groups[model] = [];
      groups[model].push(metric);
    });
    return groups;
  }

  private calculateAccuracy(prediction: any, actual: any): number {
    // Simple accuracy calculation - can be enhanced based on data types
    if (typeof prediction === 'boolean' && typeof actual === 'boolean') {
      return prediction === actual ? 100 : 0;
    }
    
    if (typeof prediction === 'number' && typeof actual === 'number') {
      const error = Math.abs(prediction - actual);
      const maxValue = Math.max(Math.abs(prediction), Math.abs(actual));
      return maxValue > 0 ? Math.max(0, 100 - (error / maxValue) * 100) : 100;
    }
    
    if (typeof prediction === 'string' && typeof actual === 'string') {
      return prediction.toLowerCase() === actual.toLowerCase() ? 100 : 0;
    }
    
    return 0;
  }

  private calculateAccuracyTrend(metrics: AIMetric[]): Array<{ date: string; accuracy: number }> {
    // Group metrics by day and calculate daily accuracy
    const dailyGroups: Record<string, AIMetric[]> = {};
    
    metrics.forEach(metric => {
      const date = new Date(metric.timestamp).toISOString().split('T')[0];
      if (!dailyGroups[date]) dailyGroups[date] = [];
      dailyGroups[date].push(metric);
    });

    return Object.entries(dailyGroups)
      .map(([date, dayMetrics]) => {
        const totalAccuracy = dayMetrics.reduce((sum, m) => {
          return sum + this.calculateAccuracy(m.prediction, m.actual);
        }, 0);
        return {
          date,
          accuracy: dayMetrics.length > 0 ? totalAccuracy / dayMetrics.length : 0
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private getSessionId(): string {
    // Generate or retrieve session ID
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('monitoring_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('monitoring_session_id', sessionId);
      }
      return sessionId;
    }
    return `server_${Date.now()}`;
  }

  private setupPeriodicFlush(): void {
    // Flush data every 5 minutes
    setInterval(() => {
      this.flushToExternalService();
    }, 5 * 60 * 1000);
  }

  private async flushToExternalService(): Promise<void> {
    try {
      // Here you would send data to your monitoring service (Sentry, DataDog, etc.)
      const data = this.exportMetrics();
      
      // Example: Send to external service
      // await fetch('/api/monitoring/flush', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });
      
      console.log('Monitoring data flushed:', {
        metrics: data.performance.length,
        events: data.userBehavior.length,
        aiMetrics: data.aiMetrics.length,
        errors: data.errors.length
      });
    } catch (error) {
      console.error('Failed to flush monitoring data:', error);
    }
  }
}

// Create singleton instance
export const monitoringService = MonitoringService.getInstance();

// Convenience functions for easy usage
export const trackAPIPerformance = (endpoint: string, duration: number, context?: Record<string, any>) => {
  monitoringService.trackAPIPerformance(endpoint, duration, context);
};

export const trackUserBehavior = (action: string, userId: string, context?: Record<string, any>, householdId?: string) => {
  monitoringService.trackUserBehavior(action, userId, context, householdId);
};

export const trackAIAccuracy = (prediction: any, actual: any, context?: Record<string, any>) => {
  monitoringService.trackAIAccuracy(prediction, actual, context);
};

export const trackError = (error: string, stack?: string, userId?: string, context?: Record<string, any>, severity?: 'low' | 'medium' | 'high' | 'critical') => {
  monitoringService.trackError(error, stack, userId, context, severity);
};
