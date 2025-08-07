'use client';

import { useState } from 'react';

export default function TestSyncButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSyncUser = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      console.log('Sync user response:', result);
    } catch (error) {
      console.error('Error syncing user:', error);
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
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            Syncing...
          </div>
        ) : (
          '🔄 Test Sync User'
        )}
      </button>
    </div>
  );
} 