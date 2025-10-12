'use client';

import { useState } from 'react';

export default function TestSyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastDuration, setLastDuration] = useState<number | null>(null);

  const handleSyncUser = async () => {
    const start = performance.now();

    try {
      setIsLoading(true);
      const response = await fetch('/api/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const duration = performance.now() - start;
      setLastDuration(duration);

      await response.json();
    } catch (error) {
      console.error('Error syncing user:', error);
      setLastDuration(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handleSyncUser}
        disabled={isLoading}
        className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
            Syncing...
          </div>
        ) : (
          '🔄 Test Sync User'
        )}
      </button>
      {lastDuration !== null ? (
        <p className="mt-2 text-sm text-gray-600">
          Last sync completed in {Math.round(lastDuration)}ms
        </p>
      ) : null}
    </div>
  );
}