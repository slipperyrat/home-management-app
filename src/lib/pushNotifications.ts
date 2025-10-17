// Push notification service using VAPID keys
import { logger } from '@/lib/logging/logger';

interface PushNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string | null;
  data?: Record<string, unknown>;
  actions?: PushNotificationAction[];
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private vapidPublicKey: string | null = null;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Get VAPID public key from environment
    this.vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;

    if (!this.vapidPublicKey) {
      logger.warn('VAPID public key not found. Push notifications will not work.');
      return;
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.ready;
        logger.info('Service worker ready for push notifications');
      } catch (error) {
        logger.error('Failed to register service worker', error as Error);
      }
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      logger.warn('This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  async subscribe(): Promise<PushSubscription | null> {
    if (!this.registration || !this.vapidPublicKey) {
      logger.warn('Service worker or VAPID key not available');
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      logger.info('Push subscription successful');
      return subscription;
    } catch (error) {
      logger.error('Failed to subscribe to push notifications', error as Error);
      return null;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await this.removeSubscriptionFromServer(subscription);
        logger.info('Push subscription removed');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to unsubscribe from push notifications', error as Error);
      return false;
    }
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      return !!subscription;
    } catch (error) {
      logger.error('Failed to check subscription status', error as Error);
      return false;
    }
  }

  async showNotification(data: PushNotificationData): Promise<void> {
    if (!this.registration) {
      logger.warn('Service worker not available');
      return;
    }

    const options: NotificationOptions & { actions?: Array<{ action: string; title: string; icon?: string }> } = {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/icon-72x72.png',
      tag: data.tag ?? '',
      data: data.data,
      requireInteraction: true,
      silent: false,
    };

    if (Array.isArray(data.actions) && data.actions.length > 0) {
      options.actions = data.actions.map(({ action, title, icon }) => ({ action, title, icon: icon ?? '' }));
    }

    await this.registration.showNotification(data.title, options);
  }

  // Helper method to convert VAPID key
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      logger.error('Failed to send subscription to server', error as Error);
    }
  }

  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      logger.error('Failed to remove subscription from server', error as Error);
    }
  }
}

// Notification templates
export const notificationTemplates = {
  choreReminder: (choreName: string, assignee: string) => ({
    title: 'Chore Reminder',
    body: `${choreName} is due for ${assignee}`,
    icon: '/icons/icon-192x192.png',
    tag: 'chore-reminder',
    data: { type: 'chore-reminder', choreName, assignee },
    actions: [
      { action: 'complete', title: 'Mark Complete' },
      { action: 'snooze', title: 'Snooze 1 Hour' },
    ],
  }),

  mealPlanReminder: (mealName: string, time: string) => ({
    title: 'Meal Plan Reminder',
    body: `Don't forget: ${mealName} at ${time}`,
    icon: '/icons/icon-192x192.png',
    tag: 'meal-reminder',
    data: { type: 'meal-reminder', mealName, time },
    actions: [
      { action: 'view', title: 'View Recipe' },
      { action: 'shop', title: 'Add to Shopping List' },
    ],
  }),

  billDue: (billName: string, amount: number) => ({
    title: 'Bill Due Soon',
    body: `${billName} - $${amount} is due soon`,
    icon: '/icons/icon-192x192.png',
    tag: 'bill-due',
    data: { type: 'bill-due', billName, amount },
    actions: [
      { action: 'pay', title: 'Mark as Paid' },
      { action: 'remind', title: 'Remind Later' },
    ],
  }),

  shoppingListUpdate: (listName: string, itemCount: number) => ({
    title: 'Shopping List Updated',
    body: `${listName} now has ${itemCount} items`,
    icon: '/icons/icon-192x192.png',
    tag: 'shopping-update',
    data: { type: 'shopping-update', listName, itemCount },
    actions: [
      { action: 'view', title: 'View List' },
      { action: 'shop', title: 'Start Shopping' },
    ],
  }),

  achievement: (achievementName: string, points: number) => ({
    title: 'Achievement Unlocked!',
    body: `${achievementName} - +${points} XP`,
    icon: '/icons/icon-192x192.png',
    tag: 'achievement',
    data: { type: 'achievement', achievementName, points },
    actions: [
      { action: 'view', title: 'View Achievement' },
      { action: 'share', title: 'Share' },
    ],
  }),
};

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();

// React hooks for push notifications
export function usePushNotifications() {
  const requestPermission = async () => {
    return await pushNotificationService.requestPermission();
  };

  const subscribe = async () => {
    return await pushNotificationService.subscribe();
  };

  const unsubscribe = async () => {
    return await pushNotificationService.unsubscribe();
  };

  const isSubscribed = async () => {
    return await pushNotificationService.isSubscribed();
  };

  const showNotification = async (data: PushNotificationData) => {
    return await pushNotificationService.showNotification(data);
  };

  return {
    requestPermission,
    subscribe,
    unsubscribe,
    isSubscribed,
    showNotification,
  };
}

// Initialize push notification service
if (typeof window !== 'undefined') {
  pushNotificationService.init();
}
