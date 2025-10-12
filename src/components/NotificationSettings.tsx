'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { logger } from '@/lib/logging/logger';

interface NotificationSettings {
  choreReminders: boolean;
  mealPlanningReminders: boolean;
  shoppingListUpdates: boolean;
  achievementNotifications: boolean;
  householdUpdates: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  choreReminders: true,
  mealPlanningReminders: true,
  shoppingListUpdates: true,
  achievementNotifications: true,
  householdUpdates: true,
};

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { userId } = useAuth();

  const checkNotificationStatus = useCallback(() => {
    if ('Notification' in window) {
      const currentPermission = Notification.permission;
      setPermission(currentPermission);
      setIsSubscribed(currentPermission === 'granted');
    }
  }, []);

  const loadSettings = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch('/api/notifications/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings as NotificationSettings);
        }
      }
    } catch (error) {
      logger.error('Error loading notification settings', error as Error);
      toast.error('Unable to load notification settings');
    }
  }, [userId]);

  useEffect(() => {
    checkNotificationStatus();
    void loadSettings();
  }, [checkNotificationStatus, loadSettings]);

  const saveSettings = useCallback(
    async (newSettings: NotificationSettings) => {
      if (!userId) return;
      try {
        const response = await fetch('/api/notifications/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ settings: newSettings }),
        });
        if (!response.ok) {
          throw new Error('Failed to save settings');
        }
        setSettings(newSettings);
        toast.success('Notification preferences updated');
      } catch (error) {
        logger.error('Error saving notification settings', error as Error);
        toast.error('Unable to save notification settings');
      }
    },
    [userId],
  );

  const handleSettingChange = useCallback(
    (key: keyof NotificationSettings, value: boolean) => {
      saveSettings({ ...settings, [key]: value });
    },
    [saveSettings, settings],
  );

  const requestPermission = useCallback(async () => {
    if ('Notification' in window) {
      const newPermission = await Notification.requestPermission();
      setPermission(newPermission);
      setIsSubscribed(newPermission === 'granted');
      if (newPermission === 'granted') {
        toast.success('Notifications enabled');
      } else {
        toast.warning('Notifications were not enabled');
      }
    }
  }, []);

  const testNotification = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }
      toast.success('Test notification sent');
    } catch (error) {
      logger.error('Error sending test notification', error as Error);
      toast.error('Unable to send test notification');
    }
  }, []);

  if (permission === 'denied') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-yellow-400 text-xl">⚠️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Notifications Blocked</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Notifications are blocked. Update your browser settings to allow notifications.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Push Notifications</h3>
            <p className="text-sm text-gray-500 mt-1">
              {isSubscribed
                ? 'You&apos;ll receive notifications for household activities'
                : 'Enable notifications to stay updated on household activities'}
            </p>
          </div>
          {!isSubscribed ? (
            <button
              onClick={requestPermission}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Enable Notifications
            </button>
          ) : (
            <div className="flex space-x-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ Enabled
              </span>
              <button
                onClick={testNotification}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                Test
              </button>
            </div>
          )}
        </div>
      </div>

      {isSubscribed ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
          <div className="space-y-4">
            {PREFERENCE_OPTIONS.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings[item.key]}
                    onChange={(event) => handleSettingChange(item.key, event.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const PREFERENCE_OPTIONS: Array<{
  key: keyof NotificationSettings;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    key: 'choreReminders',
    label: 'Chore Reminders',
    description: 'Get notified about upcoming and overdue chores',
    icon: '✅',
  },
  {
    key: 'mealPlanningReminders',
    label: 'Meal Planning',
    description: 'Reminders to plan meals and prep ingredients',
    icon: '🍽️',
  },
  {
    key: 'shoppingListUpdates',
    label: 'Shopping Lists',
    description: 'Updates when items are added to shopping lists',
    icon: '🛒',
  },
  {
    key: 'achievementNotifications',
    label: 'Achievements',
    description: 'Celebrate when you complete goals and earn rewards',
    icon: '🎉',
  },
  {
    key: 'householdUpdates',
    label: 'Household Updates',
    description: 'Important updates from other household members',
    icon: '🏠',
  },
];
