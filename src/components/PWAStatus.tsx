'use client';

import { useState, useEffect } from 'react';

export default function PWAStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(true);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          if (typeof window !== 'undefined') {
          window.location.reload();
        }
        }
      });
    }
  };

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 text-center text-sm">
        <span className="font-medium">📱 You're offline</span>
        <span className="ml-2">Some features may be limited</span>
      </div>
    );
  }

  if (updateAvailable) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-2 text-center text-sm">
        <span className="font-medium">🚀 Update available!</span>
        <button
          onClick={handleUpdate}
          className="ml-2 underline hover:no-underline"
        >
          Refresh to update
        </button>
      </div>
    );
  }

  return null;
}
