// Unified Logging Service for Home Management App
// Replaces scattered console.log statements with structured, contextual logging

import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  householdId?: string;
  route?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  securityEvent?: boolean;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  data?: unknown;
}

class Logger {
  private readonly isDevelopment = process.env.NODE_ENV === 'development';
  private readonly isProduction = process.env.NODE_ENV === 'production';

  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private formatLog(level: LogLevel, message: string, context: LogContext = {}, error?: Error, data?: unknown): LogEntry {
    const baseContext: LogContext = {
      ...context,
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown',
    }

    const sanitizedContext = Object.fromEntries(
      Object.entries(baseContext).filter(([, value]) => value !== undefined),
    ) as LogContext

    const errorPayload = error
      ? {
          name: error.name,
          message: error.message,
          ...(this.isDevelopment && error.stack ? { stack: error.stack } : {}),
        }
      : undefined

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: sanitizedContext,
      ...(errorPayload ? { error: errorPayload } : {}),
      ...(data !== undefined ? { data } : {}),
    }
  }

  private output(level: LogLevel, message: string, context: LogContext = {}, error?: Error, data?: unknown): void {
    const entry = this.formatLog(level, message, context, error, data);

    if (this.isProduction) {
      this.forwardToSentry(level, message, context, error, data);
      // Also emit JSON for log aggregators
      const stdout = (globalThis as any)?.process?.stdout;
      if (stdout?.write) {
        stdout.write(`${JSON.stringify(entry)}\n`);
      }
      return;
    }

    const emoji: Record<LogLevel, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    };

    const contextStr = Object.keys(entry.context).length > 0
      ? ` [${Object.entries(entry.context)
          .map(([k, v]) => `${k}:${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join(', ')}]`
      : '';

    const line = `${emoji[entry.level]} ${entry.level.toUpperCase()}: ${entry.message}${contextStr}`;

    if (entry.level === 'error') {
      console.error(line);
      if (entry.error) {
        console.error(entry.error);
      }
    } else if (entry.level === 'warn') {
      console.warn(line);
    } else {
      (globalThis as any)?.process?.stdout?.write?.(`${line}\n`);
    }

    if (entry.data && entry.level !== 'error') {
      (globalThis as any)?.process?.stdout?.write?.(`📊 Data: ${JSON.stringify(entry.data)}\n`);
    }
  }

  private forwardToSentry(level: LogLevel, message: string, context: LogContext = {}, error?: Error, data?: unknown) {
    try {
      const { severity, ...contextWithoutSeverity } = context;
      const extra = { ...contextWithoutSeverity, severity, data };

      if (level === 'error') {
        if (error) {
          Sentry.captureException(error, { extra });
        } else {
          Sentry.captureMessage(message, { level: 'error', extra });
        }
        return;
      }

      if (level === 'warn') {
        Sentry.captureMessage(message, { level: 'warning', extra });
        return;
      }

      if (context.securityEvent) {
        const sentryLevel: Sentry.SeverityLevel = severity === 'high' ? 'error' : 'warning';
        Sentry.captureMessage(message, { level: sentryLevel, extra });
      }
    } catch (sentryError) {
      if (this.isDevelopment) {
        console.warn('Failed to forward log to Sentry:', sentryError);
      }
    }
  }

  debug(message: string, context: LogContext = {}, data?: unknown): void {
    if (this.isDevelopment) {
      this.output('debug', message, context, undefined, data);
    }
  }

  info(message: string, context: LogContext = {}, data?: unknown): void {
    this.output('info', message, context, undefined, data);
  }

  warn(message: string, context: LogContext = {}, data?: unknown): void {
    this.output('warn', message, context, undefined, data);
  }

  error(message: string, error?: Error, context: LogContext = {}, data?: unknown): void {
    this.output('error', message, context, error, data);
  }

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

  dbQuery(operation: string, table: string, context: LogContext = {}): void {
    this.debug(`🗄️ DB ${operation} on ${table}`, { ...context, operation, table });
  }

  dbError(operation: string, table: string, error: Error, context: LogContext = {}): void {
    this.error(`🗄️ DB ${operation} on ${table} failed`, error, { ...context, operation, table });
  }

  securityEvent(event: string, severity: 'low' | 'medium' | 'high', context: LogContext = {}): void {
    const emoji = { low: '🔒', medium: '⚠️', high: '🚨' }[severity];
    this.warn(`${emoji} Security: ${event}`, { ...context, event, severity, securityEvent: true });
  }

  aiEvent(event: string, model?: string, context: LogContext = {}): void {
    this.info(`🤖 AI: ${event}`, { ...context, event, model });
  }

  aiError(event: string, error: Error, model?: string, context: LogContext = {}): void {
    this.error(`🤖 AI ${event} failed`, error, { ...context, event, model });
  }
}

export const logger = new Logger();

export const { debug, info, warn, error, apiCall, apiSuccess, apiError, userAction, householdAction, performance, dbQuery, dbError, securityEvent, aiEvent, aiError } = logger;

export function createRequestLogger(requestId: string, userId?: string, householdId?: string) {
  const baseContext: LogContext = {
    requestId,
    ...(userId ? { userId } : {}),
    ...(householdId ? { householdId } : {}),
  };

  return {
    requestId,
    userId,
    householdId,
    debug: (message: string, data?: unknown) => logger.debug(message, baseContext, data),
    info: (message: string, data?: unknown) => logger.info(message, baseContext, data),
    warn: (message: string, data?: unknown) => logger.warn(message, baseContext, data),
    error: (message: string, err?: Error, data?: unknown) => logger.error(message, err, baseContext, data),
    apiCall: (method: string, route: string, data?: unknown) =>
      logger.apiCall(method, route, { ...baseContext, ...(data !== undefined ? { data } : {}) }),
    apiSuccess: (method: string, route: string, data?: unknown) =>
      logger.apiSuccess(method, route, { ...baseContext, ...(data !== undefined ? { data } : {}) }),
    apiError: (method: string, route: string, err: Error, data?: unknown) =>
      logger.apiError(method, route, err, { ...baseContext, ...(data !== undefined ? { data } : {}) }),
  };
}

export function useLogger(requestId?: string, userId?: string, householdId?: string) {
  return createRequestLogger(requestId || 'client', userId, householdId);
}
