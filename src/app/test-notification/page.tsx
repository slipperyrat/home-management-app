"use client";

import { useState } from 'react';

export default function TestNotificationPage() {
  const [status, setStatus] = useState('');

  const testBrowserNotification = async () => {
    setStatus('Testing browser notification support...');
    
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      setStatus('❌ This browser does not support notifications');
      return;
    }

    // Check permission
    setStatus(`Current permission: ${Notification.permission}`);

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setStatus(`Permission after request: ${permission}`);
    }

    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification('🧪 Direct Browser Test', {
          body: 'This is a direct browser notification test!',
          icon: '/icons/icon-192x192.png',
        });
        
        notification.onclick = () => {
          console.log('Notification clicked!');
          notification.close();
        };

        setStatus('✅ Direct browser notification sent!');
      } catch (error) {
        setStatus(`❌ Error creating notification: ${error}`);
      }
    } else {
      setStatus('❌ Notification permission denied');
    }
  };

  const testServiceWorkerNotification = async () => {
    setStatus('Testing service worker notification...');
    
    if (!('serviceWorker' in navigator)) {
      setStatus('❌ Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (!('showNotification' in registration)) {
        setStatus('❌ Service Worker notifications not supported');
        return;
      }

      await registration.showNotification('🔧 Service Worker Test', {
        body: 'This is a service worker notification test!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
      });

      setStatus('✅ Service worker notification sent!');
    } catch (error) {
      setStatus(`❌ Service worker error: ${error}`);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">🔔 Notification Test Page</h1>
      
      <div className="space-y-4">
        <button
          onClick={testBrowserNotification}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Test Direct Browser Notification
        </button>
        
        <button
          onClick={testServiceWorkerNotification}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Test Service Worker Notification
        </button>
        
        {status && (
          <div className="p-4 bg-gray-100 rounded">
            <strong>Status:</strong> {status}
          </div>
        )}
      </div>
    </div>
  );
}
