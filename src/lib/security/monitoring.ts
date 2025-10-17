// Security Monitoring and Event Logging
// Provides comprehensive security event tracking and monitoring

import { logger } from '@/lib/logging/logger';

export interface SecurityEvent {
  type: 'rate_limit_exceeded' | 'csrf_failure' | 'unauthorized_access' | 'suspicious_activity' | 'authentication_failure';
  userId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  details?: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private eventQueue: SecurityEvent[] = [];
  private readonly maxQueueSize = 1000;

  private constructor() {}

  public static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  /**
   * Log a security event
   */
  public logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    if (!event.ip) {
      logger.warn('Security event missing IP address', { event });
      return;
    }
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    };

    // Add to queue
    this.eventQueue.push(securityEvent);
    
    // Maintain queue size
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue = this.eventQueue.slice(-this.maxQueueSize);
    }

    // Log based on severity
    switch (securityEvent.severity) {
      case 'critical':
        logger.error('Critical security event', new Error(securityEvent.type), { ...securityEvent, severity: 'high' });
        break;
      case 'high':
      case 'medium':
        logger.warn('Security event', { ...securityEvent });
        break;
      case 'low':
        logger.info('Security event', { ...securityEvent });
        break;
    }

    // Pattern analysis disabled to avoid recursive logging
  }

  /**
   * Log rate limit exceeded event
   */
  public logRateLimitExceeded(
    userId: string, 
    endpoint: string, 
    ip: string, 
    userAgent?: string
  ): void {
    if (!ip) {
      logger.warn('Rate limit exceeded event missing IP address', { userId, endpoint });
      return;
    }

    this.logEvent({
      type: 'rate_limit_exceeded',
      userId,
      ip,
      userAgent: userAgent ?? '',
      endpoint,
      severity: 'medium',
      details: { action: 'rate_limit_exceeded' }
    });
  }

  /**
   * Log CSRF failure event
   */
  public logCSRFFailure(
    userId: string, 
    endpoint: string, 
    ip: string, 
    userAgent?: string
  ): void {
    if (!ip) {
      logger.warn('CSRF failure event missing IP address', { userId, endpoint });
      return;
    }

    this.logEvent({
      type: 'csrf_failure',
      userId,
      ip,
      userAgent: userAgent ?? '',
      endpoint,
      severity: 'high',
      details: { action: 'csrf_validation_failed' }
    });
  }

  /**
   * Log unauthorized access attempt
   */
  public logUnauthorizedAccess(
    endpoint: string, 
    ip: string, 
    userAgent?: string,
    details?: Record<string, unknown>
  ): void {
    if (!ip) {
      logger.warn('Unauthorized access event missing IP address', { endpoint });
      return;
    }

    this.logEvent({
      type: 'unauthorized_access',
      ip,
      userAgent: userAgent ?? '',
      endpoint,
      severity: 'high',
      details: { action: 'unauthorized_access', ...details }
    });
  }

  /**
   * Log suspicious activity
   */
  public logSuspiciousActivity(
    userId: string, 
    activity: string, 
    ip: string, 
    userAgent?: string,
    details?: Record<string, unknown>
  ): void {
    if (!ip) {
      logger.warn('Suspicious activity event missing IP address', { userId, activity });
      return;
    }

    this.logEvent({
      type: 'suspicious_activity',
      userId,
      ip,
      userAgent: userAgent ?? '',
      severity: 'medium',
      details: { activity, ...details }
    });
  }

  /**
   * Log authentication failure
   */
  public logAuthenticationFailure(
    endpoint: string, 
    ip: string, 
    userAgent?: string,
    details?: Record<string, unknown>
  ): void {
    if (!ip) {
      logger.warn('Authentication failure event missing IP address', { endpoint });
      return;
    }

    this.logEvent({
      type: 'authentication_failure',
      ip,
      userAgent: userAgent ?? '',
      endpoint,
      severity: 'medium',
      details: { action: 'authentication_failed', ...details }
    });
  }

  /**
   * Get recent security events
   */
  public getRecentEvents(limit: number = 50): SecurityEvent[] {
    return this.eventQueue
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get events by type
   */
  public getEventsByType(type: SecurityEvent['type'], limit: number = 50): SecurityEvent[] {
    return this.eventQueue
      .filter(event => event.type === type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get events by severity
   */
  public getEventsBySeverity(severity: SecurityEvent['severity'], limit: number = 50): SecurityEvent[] {
    return this.eventQueue
      .filter(event => event.severity === severity)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get security metrics
   */
  public getSecurityMetrics(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    recentActivity: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    const recentEvents = this.eventQueue.filter(
      event => event.timestamp.getTime() > oneHourAgo
    );

    const eventsByType = this.eventQueue.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsBySeverity = this.eventQueue.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents: this.eventQueue.length,
      eventsByType,
      eventsBySeverity,
      recentActivity: recentEvents.length
    };
  }
}

// Export singleton instance
export const securityMonitor = SecurityMonitor.getInstance();

// Convenience functions
export const logRateLimitExceeded = (userId: string, endpoint: string, ip: string, userAgent?: string) => 
  securityMonitor.logRateLimitExceeded(userId, endpoint, ip, userAgent);

export const logCSRFFailure = (userId: string, endpoint: string, ip: string, userAgent?: string) => 
  securityMonitor.logCSRFFailure(userId, endpoint, ip, userAgent);

export const logUnauthorizedAccess = (endpoint: string, ip: string, userAgent?: string, details?: Record<string, unknown>) => 
  securityMonitor.logUnauthorizedAccess(endpoint, ip, userAgent, details);

export const logSuspiciousActivity = (userId: string, activity: string, ip: string, userAgent?: string, details?: Record<string, unknown>) => 
  securityMonitor.logSuspiciousActivity(userId, activity, ip, userAgent, details);

export const logAuthenticationFailure = (endpoint: string, ip: string, userAgent?: string, details?: Record<string, unknown>) => 
  securityMonitor.logAuthenticationFailure(endpoint, ip, userAgent, details);
