'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

interface UserData {
  email: string;
  role: 'owner' | 'member';
  plan: 'free' | 'premium';
  xp: number;
  coins: number;
  household: {
    id: string;
    plan: string;
    game_mode: string;
    created_at: string;
  };
}

export default function DebugPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function fetchData() {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);

        const userResponse = await fetch('/api/user-data');
        const userResult = await userResponse.json();

        if (!userResponse.ok) {
          console.error('Error fetching user data:', userResult.error);
          setError(userResult.error || 'Failed to load user data');
          return;
        }

        if (userResult.success && userResult.data) {
          setUserData(userResult.data);
        } else {
          setError('User not found in database');
        }
      } catch (err) {
        console.error('Exception fetching data:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isLoaded, isSignedIn, user?.id]);

  if (!isLoaded) {
    return <div>Loading auth...</div>;
  }

  if (!isSignedIn) {
    return <div>Please sign in to view debug information.</div>;
  }

  if (loading) {
    return <div>Loading user data...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Debug Information</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Data</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(userData, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Plan Analysis</h2>
          <div className="space-y-2">
            <p><strong>Current Plan:</strong> {userData?.plan}</p>
            <p><strong>Household Plan:</strong> {userData?.household?.plan}</p>
            <p><strong>Can Access Rewards:</strong> {userData?.plan === 'premium' ? 'Yes' : 'No'}</p>
            <p><strong>Feature Check:</strong> {userData?.plan === 'premium' ? 'xp_rewards should be available' : 'xp_rewards not available'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-y-2">
            <button 
              onClick={() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
            <button 
              onClick={() => fetch('/api/sync-user', { method: 'POST' })}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ml-2"
            >
              Sync User
            </button>
            <button 
              onClick={async () => {
                try {
                  const response = await fetch('/api/debug/check-db');
                  const result = await response.json();
                  console.log('🔍 Database check result:', result);
                  alert(`Database Status:\n\nTables: ${result.tables.available.join(', ')}\n\nMissing Tables: ${result.missingTables.join(', ') || 'None'}\n\nMissing Columns: ${result.missingColumns.join(', ') || 'None'}`);
                } catch (err) {
                  console.error('Error checking database:', err);
                  alert('Error checking database. See console for details.');
                }
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 ml-2"
            >
              Check Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 