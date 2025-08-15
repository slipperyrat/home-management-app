'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

interface NotificationSettings {
  choreReminders: boolean;
  mealPlanningReminders: boolean;
  shoppingListUpdates: boolean;
  achievementNotifications: boolean;
  householdUpdates: boolean;
}

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>({
    choreReminders: true,
    mealPlanningReminders: true,
    shoppingListUpdates: true,
    achievementNotifications: true,
    householdUpdates: true,
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { userId } = useAuth();

  useEffect(() => {
    checkNotificationStatus();
    loadSettings();
  }, [userId]);

  const checkNotificationStatus = () => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      setIsSubscribed(Notification.permission === 'granted');
    }
  };

  const loadSettings = async () => {
    if (!userId) return;

    try {
      const response = await fetch('/api/notifications/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    if (!userId) return;

    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (response.ok) {
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const handleSettingChange = (key: keyof NotificationSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      setIsSubscribed(permission === 'granted');
    }
  };

  const testNotification = async () => {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
      });
      
      if (response.ok) {
        // Show success message
        console.log('Test notification sent!');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  };

  if (permission === 'denied') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-yellow-400 text-xl">⚠️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Notifications Blocked
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              You've blocked notifications for this site. To enable them, click the notification icon in your browser's address bar and allow notifications.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Permission Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Push Notifications
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {isSubscribed 
                ? 'You\'ll receive notifications for household activities'
                : 'Enable notifications to stay updated on household activities'
              }
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

      {/* Notification Settings */}
      {isSubscribed ? <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Notification Preferences
          </h3>
          <div className="space-y-4">
            {[
              {
                key: 'choreReminders' as keyof NotificationSettings,
                label: 'Chore Reminders',
                description: 'Get notified about upcoming and overdue chores',
                icon: '✅'
              },
              {
                key: 'mealPlanningReminders' as keyof NotificationSettings,
                label: 'Meal Planning',
                description: 'Reminders to plan meals and prep ingredients',
                icon: '🍽️'
              },
              {
                key: 'shoppingListUpdates' as keyof NotificationSettings,
                label: 'Shopping Lists',
                description: 'Updates when items are added to shopping lists',
                icon: '🛒'
              },
              {
                key: 'achievementNotifications' as keyof NotificationSettings,
                label: 'Achievements',
                description: 'Celebrate when you complete goals and earn rewards',
                icon: '🎉'
              },
              {
                key: 'householdUpdates' as keyof NotificationSettings,
                label: 'Household Updates',
                description: 'Important updates from other household members',
                icon: '🏠'
              }
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.description}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings[item.key]}
                    onChange={(e) => handleSettingChange(item.key, e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>
            ))}
          </div>
        </div> : null}
    </div>
  );
}
