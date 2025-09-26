// Rate Limiting Service for API Protection
// Integrates with database-based rate limiting for scalability

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logging/logger';

export interface RateLimitConfig {
  maxRequests: number;
  windowMinutes: number;
  endpoint: string;
}

export class RateLimiter {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Check if a user has exceeded their rate limit for an endpoint
   */
  async checkRateLimit(
    userId: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    try {
      const windowStart = this.getWindowStart(config.windowMinutes);
      
      // Check current request count for this user/endpoint/window
      const { data: existingRecord, error: selectError } = await this.supabase
        .from('rate_limits')
        .select('request_count')
        .eq('user_id', userId)
        .eq('endpoint', config.endpoint)
        .eq('window_start', windowStart.toISOString())
        .maybeSingle();

      if (selectError) {
        logger.error('Rate limit select failed', selectError, { userId, endpoint: config.endpoint });
        // Fail open - allow request if rate limiting fails
        return { allowed: true, remaining: config.maxRequests, resetTime: new Date() };
      }

      const currentCount = existingRecord?.request_count || 0;
      
      if (currentCount >= config.maxRequests) {
        const resetTime = new Date(windowStart.getTime() + (config.windowMinutes * 60 * 1000));
        return { 
          allowed: false, 
          remaining: 0, 
          resetTime 
        };
      }

      // Increment request count
      const { error: upsertError } = await this.supabase
        .from('rate_limits')
        .upsert({
          user_id: userId,
          endpoint: config.endpoint,
          window_start: windowStart.toISOString(),
          request_count: currentCount + 1,
          created_at: new Date().toISOString()
        });

      if (upsertError) {
        logger.error('Rate limit upsert failed', upsertError, { userId, endpoint: config.endpoint });
        // Fail open - allow request if rate limiting fails
        return { allowed: true, remaining: config.maxRequests, resetTime: new Date() };
      }

      return { 
        allowed: true, 
        remaining: config.maxRequests - (currentCount + 1), 
        resetTime: new Date(windowStart.getTime() + (config.windowMinutes * 60 * 1000))
      };
    } catch (error) {
      logger.error('Rate limit check error', error as Error, { userId, endpoint: config.endpoint });
      // Fail open - allow request if rate limiting fails
      return { allowed: true, remaining: config.maxRequests, resetTime: new Date() };
    }
  }

  /**
   * Get the start of the current rate limit window
   */
  private getWindowStart(windowMinutes: number): Date {
    const now = new Date();
    const minutes = Math.floor(now.getMinutes() / windowMinutes) * windowMinutes;
    const windowStart = new Date(now);
    windowStart.setMinutes(minutes, 0, 0);
    return windowStart;
  }

  /**
   * Get rate limit headers for API responses
   */
  getRateLimitHeaders(
    remaining: number,
    resetTime: Date,
    maxRequests: number
  ): Record<string, string> {
    return {
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.floor(resetTime.getTime() / 1000).toString(),
      'Retry-After': Math.ceil((resetTime.getTime() - Date.now()) / 1000).toString()
    };
  }
}

// Predefined rate limit configurations for common endpoints
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  'auth': { maxRequests: 10, windowMinutes: 15, endpoint: 'auth' },
  'api': { maxRequests: 100, windowMinutes: 60, endpoint: 'api' },
  'shopping': { maxRequests: 50, windowMinutes: 60, endpoint: 'shopping' },
  'chores': { maxRequests: 30, windowMinutes: 60, endpoint: 'chores' },
  'bills': { maxRequests: 20, windowMinutes: 60, endpoint: 'bills' },
  'meal-planner': { maxRequests: 25, windowMinutes: 60, endpoint: 'meal-planner' },
  'default': { maxRequests: 100, windowMinutes: 60, endpoint: 'default' }
};

// Helper function to get rate limit config for an endpoint
export function getRateLimitConfig(pathname: string): RateLimitConfig {
  if (pathname.includes('/auth')) return RATE_LIMIT_CONFIGS.auth;
  if (pathname.includes('/shopping')) return RATE_LIMIT_CONFIGS.shopping;
  if (pathname.includes('/chores')) return RATE_LIMIT_CONFIGS.chores;
  if (pathname.includes('/bills')) return RATE_LIMIT_CONFIGS.bills;
  if (pathname.includes('/meal-planner')) return RATE_LIMIT_CONFIGS['meal-planner'];
  if (pathname.includes('/api')) return RATE_LIMIT_CONFIGS.api;
  return RATE_LIMIT_CONFIGS.default;
}
