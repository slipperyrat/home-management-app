// Unified Logging Service for Home Management App
// Replaces scattered console.log statements with structured, contextual logging

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  householdId?: string;
  route?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: Error;
  data?: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  // Generate unique request ID for tracking requests across logs
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Format log entry for consistent output
  private formatLog(level: LogLevel, message: string, context: LogContext = {}, error?: Error, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || 'unknown'
      },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined
      } : undefined,
      data
    };
  }

  // Output log to appropriate destination
  private output(entry: LogEntry): void {
    if (this.isDevelopment) {
      // Development: Pretty console output with emojis
      const emoji = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌'
      }[entry.level];

      const contextStr = Object.keys(entry.context).length > 0 
        ? ` [${Object.entries(entry.context).map(([k, v]) => `${k}:${v}`).join(', ')}]`
        : '';

      console.log(`${emoji} ${entry.level.toUpperCase()}: ${entry.message}${contextStr}`);
      
      if (entry.data) {
        console.log('📊 Data:', entry.data);
      }
      
      if (entry.error) {
        console.error('🚨 Error:', entry.error);
      }
    } else {
      // Production: Structured JSON for log aggregation
      console.log(JSON.stringify(entry));
    }

    // TODO: In production, also send to external logging service
    // if (this.isProduction && entry.level === 'error') {
    //   // Send to Sentry, LogRocket, etc.
    // }
  }

  // Main logging methods
  debug(message: string, context: LogContext = {}, data?: any): void {
    if (this.isDevelopment) {
      this.output(this.formatLog('debug', message, context, undefined, data));
    }
  }

  info(message: string, context: LogContext = {}, data?: any): void {
    this.output(this.formatLog('info', message, context, undefined, data));
  }

  warn(message: string, context: LogContext = {}, data?: any): void {
    this.output(this.formatLog('warn', message, context, undefined, data));
  }

  error(message: string, error?: Error, context: LogContext = {}, data?: any): void {
    this.output(this.formatLog('error', message, context, error, data));
  }

  // Convenience methods for common logging patterns
  apiCall(method: string, route: string, context: LogContext = {}): void {
    this.info(`API ${method} ${route}`, { ...context, method, route });
  }

  apiSuccess(method: string, route: string, context: LogContext = {}): void {
    this.info(`✅ API ${method} ${route} successful`, { ...context, method, route });
  }

  apiError(method: string, route: string, error: Error, context: LogContext = {}): void {
    this.error(`❌ API ${method} ${route} failed`, error, { ...context, method, route });
  }

  userAction(action: string, userId: string, context: LogContext = {}): void {
    this.info(`👤 User action: ${action}`, { ...context, userId, action });
  }

  householdAction(action: string, householdId: string, context: LogContext = {}): void {
    this.info(`🏠 Household action: ${action}`, { ...context, householdId, action });
  }

  performance(operation: string, duration: number, context: LogContext = {}): void {
    this.info(`⚡ Performance: ${operation} took ${duration}ms`, { ...context, operation, duration });
  }

  // Database operation logging
  dbQuery(operation: string, table: string, context: LogContext = {}): void {
    this.debug(`🗄️ DB ${operation} on ${table}`, { ...context, operation, table });
  }

  dbError(operation: string, table: string, error: Error, context: LogContext = {}): void {
    this.error(`🗄️ DB ${operation} on ${table} failed`, error, { ...context, operation, table });
  }

  // Security logging
  securityEvent(event: string, severity: 'low' | 'medium' | 'high', context: LogContext = {}): void {
    const emoji = { low: '🔒', medium: '⚠️', high: '🚨' }[severity];
    this.warn(`${emoji} Security: ${event}`, { ...context, event, severity });
  }

  // AI/ML logging
  aiEvent(event: string, model?: string, context: LogContext = {}): void {
    this.info(`🤖 AI: ${event}`, { ...context, event, model });
  }

  aiError(event: string, error: Error, model?: string, context: LogContext = {}): void {
    this.error(`🤖 AI ${event} failed`, error, { ...context, event, model });
  }
}

// Create singleton instance
export const logger = new Logger();

// Export convenience functions for direct use
export const { debug, info, warn, error, apiCall, apiSuccess, apiError, userAction, householdAction, performance, dbQuery, dbError, securityEvent, aiEvent, aiError } = logger;

// Middleware helper for Next.js API routes
export function createRequestLogger(requestId: string, userId?: string, householdId?: string) {
  return {
    requestId,
    userId,
    householdId,
    debug: (message: string, data?: any) => logger.debug(message, { requestId, userId, householdId }, data),
    info: (message: string, data?: any) => logger.info(message, { requestId, userId, householdId }, data),
    warn: (message: string, data?: any) => logger.warn(message, { requestId, userId, householdId }, data),
    error: (message: string, error?: Error, data?: any) => logger.error(message, error, { requestId, userId, householdId }, data),
    apiCall: (method: string, route: string, data?: any) => logger.apiCall(method, route, { requestId, userId, householdId }, data),
    apiSuccess: (method: string, route: string, data?: any) => logger.apiSuccess(method, route, { requestId, userId, householdId }, data),
    apiError: (method: string, route: string, error: Error, data?: any) => logger.apiError(method, route, error, { requestId, userId, householdId }, data),
  };
}

// Hook for React components
export function useLogger(requestId?: string, userId?: string, householdId?: string) {
  return createRequestLogger(requestId || 'client', userId, householdId);
}
