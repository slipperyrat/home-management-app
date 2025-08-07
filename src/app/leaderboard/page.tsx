'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface LeaderboardEntry {
  id: string;
  xp: number;
  username: string;
}

interface LeaderboardData {
  success: boolean;
  leaderboard: LeaderboardEntry[];
  householdId: string;
}

export default function LeaderboardPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    fetchLeaderboard();
  }, [isLoaded, isSignedIn, router]);

  async function fetchLeaderboard() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/leaderboard');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch leaderboard');
      }

      const data: LeaderboardData = await response.json();
      setLeaderboard(data.leaderboard);
      
      console.log('✅ Leaderboard fetched:', data);
    } catch (err) {
      console.error('❌ Error fetching leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  }

  // Show loading spinner while auth is loading or data is being fetched
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  // This should not be reached if redirect is working, but just in case
  if (!isSignedIn) {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white shadow rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center"
          >
            ← Back
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🏆 Household Leaderboard
          </h1>
          <p className="text-gray-600">
            Top 10 members by XP
          </p>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-lg shadow">
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-6xl mb-4">🏆</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No leaderboard data</h3>
              <p className="text-gray-600">Complete some tasks to see the leaderboard!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {leaderboard.map((entry, index) => (
                <div key={entry.id} className="p-6 flex items-center">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-lg font-bold text-gray-700">
                      {index + 1}
                    </span>
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {entry.username}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {entry.xp} XP
                    </p>
                  </div>
                  
                  {/* Trophy for top 3 */}
                  {index < 3 && (
                    <div className="flex-shrink-0">
                      <span className="text-2xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Refresh button */}
        <div className="mt-6 text-center">
          <button
            onClick={fetchLeaderboard}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Refresh Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
} 