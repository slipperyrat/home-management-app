import { logger } from '@/lib/logging/logger';

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
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
    metadata?: Record<string, unknown>;
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
    metadata?: Record<string, unknown>;
  };
}

export type AnalyticsEventType = FeatureUsageEvent | SubscriptionEvent | UserEngagementEvent;

type GTag = (...args: unknown[]) => void;
type Mixpanel = { track: (event: string, props?: Record<string, unknown>) => void };

declare global {
  interface Window {
    gtag?: GTag;
    mixpanel?: Mixpanel;
  }
}

class Analytics {
  private events: AnalyticsEvent[] = [];
  private isEnabled = true;

  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
  }

  trackFeatureUsage(
    feature: string,
    action: string,
    plan: string,
    userId?: string,
    householdId?: string,
    metadata?: Record<string, unknown>,
  ) {
    this.track({
      event: 'feature_used',
      properties: {
        feature,
        plan,
        action,
        ...(metadata ? { metadata } : {}),
      },
      ...(userId ? { userId } : {}),
      ...(householdId ? { householdId } : {}),
      timestamp: new Date(),
    } satisfies FeatureUsageEvent);
  }

  trackSubscription(
    event: SubscriptionEvent['event'],
    plan: string,
    previousPlan?: string,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string,
    userId?: string,
    householdId?: string,
  ) {
    this.track({
      event,
      properties: {
        plan,
        ...(previousPlan ? { previous_plan: previousPlan } : {}),
        ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
        ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {}),
      },
      ...(userId ? { userId } : {}),
      ...(householdId ? { householdId } : {}),
      timestamp: new Date(),
    } satisfies SubscriptionEvent);
  }

  trackEngagement(
    action: string,
    page: string,
    duration?: number,
    userId?: string,
    householdId?: string,
    metadata?: Record<string, unknown>,
  ) {
    this.track({
      event: 'user_engagement',
      properties: {
        action,
        page,
        duration: duration ?? 0,
        ...(metadata ? { metadata } : {}),
      },
      ...(userId ? { userId } : {}),
      ...(householdId ? { householdId } : {}),
      timestamp: new Date(),
    } satisfies UserEngagementEvent);
  }

  track(event: AnalyticsEvent) {
    if (!this.isEnabled) {
      return;
    }

    this.events.push(event);

    if (typeof window !== 'undefined') {
      this.sendToClientAnalytics(event);
    } else {
      void this.sendToServerAnalytics(event);
    }
  }

  private sendToClientAnalytics(event: AnalyticsEvent) {
    const { gtag, mixpanel } = window;

    if (typeof gtag === 'function') {
      gtag('event', event.event, {
        event_category: 'feature_usage',
        event_label: (event.properties as FeatureUsageEvent['properties'])?.feature ?? event.event,
        value: (event.properties as UserEngagementEvent['properties'])?.duration ?? 1,
        custom_parameters: event.properties,
      });
    }

    if (mixpanel) {
      mixpanel.track(event.event, event.properties as Record<string, unknown> | undefined);
    }

    fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }).catch((error: unknown) => {
      logger.warn('Failed to send analytics event to /api/analytics/track', {
        error,
        event: event.event,
      });
    });
  }

  private async sendToServerAnalytics(event: AnalyticsEvent) {
    try {
      logger.info('Analytics event captured', {
        event: event.event,
        ...(event.userId ? { userId: event.userId } : {}),
        ...(event.householdId ? { householdId: event.householdId } : {}),
      });
    } catch (error) {
      logger.warn('Failed to record server analytics event', { event: event.event }, error);
    }
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  clearEvents() {
    this.events = [];
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }
}

export const analytics = new Analytics();

export const trackFeatureUsage = (
  feature: string,
  action: string,
  plan: string,
  userId?: string,
  householdId?: string,
  metadata?: Record<string, unknown>,
) => {
  analytics.trackFeatureUsage(feature, action, plan, userId, householdId, metadata);
};

export const trackSubscription = (
  event: SubscriptionEvent['event'],
  plan: string,
  previousPlan?: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
  userId?: string,
  householdId?: string,
) => {
  analytics.trackSubscription(event, plan, previousPlan, stripeCustomerId, stripeSubscriptionId, userId, householdId);
};

export const trackEngagement = (
  action: string,
  page: string,
  duration?: number,
  userId?: string,
  householdId?: string,
  metadata?: Record<string, unknown>,
) => {
  analytics.trackEngagement(action, page, duration, userId, householdId, metadata);
};
