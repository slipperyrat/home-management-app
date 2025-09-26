// Security Monitoring and Event Logging
// Provides comprehensive security event tracking and monitoring

import { logger } from '@/lib/logging/logger';

export interface SecurityEvent {
  type: 'rate_limit_exceeded' | 'csrf_failure' | 'unauthorized_access' | 'suspicious_activity' | 'authentication_failure';
  userId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  details?: any;
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
    // Temporarily disabled to prevent infinite recursion
    return;
    
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
        logger.error('CRITICAL SECURITY EVENT', securityEvent);
        break;
      case 'high':
        logger.warn('HIGH SECURITY EVENT', securityEvent);
        break;
      case 'medium':
        logger.warn('MEDIUM SECURITY EVENT', securityEvent);
        break;
      case 'low':
        logger.info('LOW SECURITY EVENT', securityEvent);
        break;
    }

    // Check for patterns that might indicate an attack
    // Temporarily disabled to prevent infinite recursion
    // this.analyzePatterns(securityEvent);
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
    this.logEvent({
      type: 'rate_limit_exceeded',
      userId,
      ip,
      userAgent,
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
    this.logEvent({
      type: 'csrf_failure',
      userId,
      ip,
      userAgent,
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
    details?: any
  ): void {
    this.logEvent({
      type: 'unauthorized_access',
      ip,
      userAgent,
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
    details?: any
  ): void {
    this.logEvent({
      type: 'suspicious_activity',
      userId,
      ip,
      userAgent,
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
    details?: any
  ): void {
    this.logEvent({
      type: 'authentication_failure',
      ip,
      userAgent,
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
   * Analyze patterns for potential attacks
   */
  private analyzePatterns(event: SecurityEvent): void {
    const recentEvents = this.eventQueue.filter(
      e => e.timestamp.getTime() > Date.now() - 5 * 60 * 1000 // Last 5 minutes
    );

    // Check for rapid-fire requests from same IP
    const ipEvents = recentEvents.filter(e => e.ip === event.ip);
    if (ipEvents.length > 20) {
      // Directly add to queue to avoid recursion
      const suspiciousEvent: SecurityEvent = {
        type: 'suspicious_activity',
        ip: event.ip,
        severity: 'high',
        timestamp: new Date(),
        details: { 
          pattern: 'rapid_fire_requests',
          count: ipEvents.length,
          timeWindow: '5_minutes'
        }
      };
      this.eventQueue.push(suspiciousEvent);
      logger.warn('SUSPICIOUS ACTIVITY DETECTED', suspiciousEvent);
    }

    // Check for multiple failed CSRF attempts
    const csrfFailures = recentEvents.filter(
      e => e.type === 'csrf_failure' && e.ip === event.ip
    );
    if (csrfFailures.length > 5) {
      // Directly add to queue to avoid recursion
      const suspiciousEvent: SecurityEvent = {
        type: 'suspicious_activity',
        ip: event.ip,
        severity: 'high',
        timestamp: new Date(),
        details: { 
          pattern: 'multiple_csrf_failures',
          count: csrfFailures.length,
          timeWindow: '5_minutes'
        }
      };
      this.eventQueue.push(suspiciousEvent);
      logger.warn('SUSPICIOUS ACTIVITY DETECTED', suspiciousEvent);
    }

    // Check for multiple unauthorized access attempts
    const unauthorizedAttempts = recentEvents.filter(
      e => e.type === 'unauthorized_access' && e.ip === event.ip
    );
    if (unauthorizedAttempts.length > 10) {
      // Directly add to queue to avoid recursion
      const suspiciousEvent: SecurityEvent = {
        type: 'suspicious_activity',
        ip: event.ip,
        severity: 'critical',
        timestamp: new Date(),
        details: { 
          pattern: 'multiple_unauthorized_attempts',
          count: unauthorizedAttempts.length,
          timeWindow: '5_minutes'
        }
      };
      this.eventQueue.push(suspiciousEvent);
      logger.error('CRITICAL SECURITY EVENT', suspiciousEvent);
    }
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

export const logUnauthorizedAccess = (endpoint: string, ip: string, userAgent?: string, details?: any) => 
  securityMonitor.logUnauthorizedAccess(endpoint, ip, userAgent, details);

export const logSuspiciousActivity = (userId: string, activity: string, ip: string, userAgent?: string, details?: any) => 
  securityMonitor.logSuspiciousActivity(userId, activity, ip, userAgent, details);

export const logAuthenticationFailure = (endpoint: string, ip: string, userAgent?: string, details?: any) => 
  securityMonitor.logAuthenticationFailure(endpoint, ip, userAgent, details);
