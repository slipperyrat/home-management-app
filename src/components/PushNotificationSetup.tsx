'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function PushNotificationSetup() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;

    const setupPushNotifications = async () => {
      // Check if browser supports notifications and service workers
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }

      try {
        // Register service worker
        console.log('Registering service worker...');
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        console.log('Service Worker registered successfully:', registration);

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('Service Worker is ready');

        // Check if already subscribed
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          console.log('Already subscribed to push notifications');
          return;
        }

        // Request notification permission if needed
        if (Notification.permission === 'default') {
          console.log('Requesting notification permission...');
          const permission = await Notification.requestPermission();
          console.log('Notification permission:', permission);
          
          if (permission !== 'granted') {
            console.log('Notification permission denied');
            return;
          }
        }

        // Create push subscription if permission granted
        if (Notification.permission === 'granted' && VAPID_PUBLIC_KEY) {
          console.log('Creating push subscription...');
          
          const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });

          console.log('Push subscription created:', subscription);

          // Send subscription to server
          const response = await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subscription: subscription.toJSON(),
              userId: user.id,
            }),
          });

          if (response.ok) {
            console.log('✅ Push subscription sent to server successfully');
          } else {
            console.error('❌ Failed to send subscription to server:', await response.text());
          }
        }

      } catch (error) {
        console.error('Error setting up push notifications:', error);
      }
    };

    // Setup with a small delay to ensure everything is loaded
    const timer = setTimeout(setupPushNotifications, 2000);
    return () => clearTimeout(timer);
  }, [isLoaded, user]);

  return null; // This component doesn't render anything
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
