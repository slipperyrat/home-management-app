// Analytics and usage tracking utilities
// This provides a foundation for tracking feature usage and business metrics

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  userId?: string;
  householdId?: string;
  timestamp?: Date;
}

export interface FeatureUsageEvent extends AnalyticsEvent {
  event: 'feature_used';
  properties: {
    feature: string;
    plan: string;
    action: string;
    metadata?: Record<string, any>;
  };
}

export interface SubscriptionEvent extends AnalyticsEvent {
  event: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled';
  properties: {
    plan: string;
    previous_plan?: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
  };
}

export interface UserEngagementEvent extends AnalyticsEvent {
  event: 'user_engagement';
  properties: {
    action: string;
    page: string;
    duration?: number;
    metadata?: Record<string, any>;
  };
}

// Analytics event types
export type AnalyticsEventType = 
  | FeatureUsageEvent 
  | SubscriptionEvent 
  | UserEngagementEvent;

class Analytics {
  private events: AnalyticsEvent[] = [];
  private isEnabled: boolean = true;

  constructor() {
    // Check if analytics is enabled (you might want to make this configurable)
    this.isEnabled = process.env.NODE_ENV === 'production' || 
                    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
  }

  /**
   * Track a feature usage event
   */
  trackFeatureUsage(
    feature: string,
    action: string,
    plan: string,
    userId?: string,
    householdId?: string,
    metadata?: Record<string, any>
  ) {
    this.track({
      event: 'feature_used',
      properties: {
        feature,
        plan,
        action,
        metadata,
      },
      userId,
      householdId,
      timestamp: new Date(),
    });
  }

  /**
   * Track subscription events
   */
  trackSubscription(
    event: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled',
    plan: string,
    previousPlan?: string,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string,
    userId?: string,
    householdId?: string
  ) {
    this.track({
      event,
      properties: {
        plan,
        previous_plan: previousPlan,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
      },
      userId,
      householdId,
      timestamp: new Date(),
    });
  }

  /**
   * Track user engagement
   */
  trackEngagement(
    action: string,
    page: string,
    duration?: number,
    userId?: string,
    householdId?: string,
    metadata?: Record<string, any>
  ) {
    this.track({
      event: 'user_engagement',
      properties: {
        action,
        page,
        duration,
        metadata,
      },
      userId,
      householdId,
      timestamp: new Date(),
    });
  }

  /**
   * Generic track method
   */
  track(event: AnalyticsEvent) {
    if (!this.isEnabled) {
      return;
    }

    this.events.push(event);

    // In production, you'd send this to your analytics service
    if (typeof window !== 'undefined') {
      // Send to client-side analytics (Google Analytics, Mixpanel, etc.)
      this.sendToClientAnalytics(event);
    } else {
      // Send to server-side analytics
      this.sendToServerAnalytics(event);
    }
  }

  /**
   * Send event to client-side analytics
   */
  private sendToClientAnalytics(event: AnalyticsEvent) {
    // Google Analytics 4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event.event, {
        event_category: 'feature_usage',
        event_label: event.properties?.feature || event.event,
        value: event.properties?.duration || 1,
        custom_parameters: event.properties,
      });
    }

    // Mixpanel
    if (typeof window !== 'undefined' && (window as any).mixpanel) {
      (window as any).mixpanel.track(event.event, event.properties);
    }

    // Custom analytics endpoint
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }).catch(error => {
      console.error('Failed to send analytics event:', error);
    });
  }

  /**
   * Send event to server-side analytics
   */
  private async sendToServerAnalytics(event: AnalyticsEvent) {
    try {
      // In a real implementation, you'd send this to your analytics service
      // For now, we'll just log it
      console.log('Analytics Event:', JSON.stringify(event, null, 2));
    } catch (error) {
      console.error('Failed to send server analytics event:', error);
    }
  }

  /**
   * Get all tracked events
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events
   */
  clearEvents() {
    this.events = [];
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Helper functions for common tracking scenarios
export const trackFeatureUsage = (
  feature: string,
  action: string,
  plan: string,
  userId?: string,
  householdId?: string,
  metadata?: Record<string, any>
) => {
  analytics.trackFeatureUsage(feature, action, plan, userId, householdId, metadata);
};

export const trackSubscription = (
  event: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled',
  plan: string,
  previousPlan?: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
  userId?: string,
  householdId?: string
) => {
  analytics.trackSubscription(event, plan, previousPlan, stripeCustomerId, stripeSubscriptionId, userId, householdId);
};

export const trackEngagement = (
  action: string,
  page: string,
  duration?: number,
  userId?: string,
  householdId?: string,
  metadata?: Record<string, any>
) => {
  analytics.trackEngagement(action, page, duration, userId, householdId, metadata);
};
