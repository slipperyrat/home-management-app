'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getChores, addChore, completeChore, getChoreCompletions } from '@/lib/chores';

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

interface Chore {
  id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  due_at?: string;
  recurrence?: string;
  created_by: string;
  household_id: string;
  created_at: string;
}

interface ChoreCompletion {
  id: string;
  completed_at: string;
  xp_earned: number;
  completed_by: string;
  chore: {
    id: string;
    title: string;
    household_id: string;
  };
}

export default function ChoresPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [chores, setChores] = useState<Chore[]>([]);
  const [completions, setCompletions] = useState<ChoreCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newChoreTitle, setNewChoreTitle] = useState('');
  const [newChoreDescription, setNewChoreDescription] = useState('');
  const [newChoreDueDate, setNewChoreDueDate] = useState('');
  const [creatingChore, setCreatingChore] = useState(false);
  const [completingChore, setCompletingChore] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    async function fetchUserData() {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/user-data');
        const result = await response.json();

        if (!response.ok) {
          console.error('Error fetching user data:', result.error);
          setError(result.error || 'Failed to load user data');
          return;
        }

        if (result.success && result.user) {
          setUserData({
            email: result.user.email,
            role: result.user.role,
            plan: result.user.plan || 'free',
            xp: result.user.xp || 0,
            coins: result.user.coins || 0,
            household: result.user.household
          });
        } else {
          setError('User not found in database');
        }
      } catch (err) {
        console.error('Exception fetching user data:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [isLoaded, isSignedIn, user?.id, router]);

  useEffect(() => {
    if (userData?.household?.id) {
      fetchChores();
      fetchCompletions();
    }
  }, [userData]);

  async function fetchChores() {
    if (!userData?.household?.id) return;

    try {
      setLoading(true);
      const choresData = await getChores(userData.household.id);
      setChores(choresData);
    } catch (err) {
      console.error('Error fetching chores:', err);
      setError('Failed to load chores');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCompletions() {
    if (!userData?.household?.id) return;

    try {
      const completionsData = await getChoreCompletions(userData.household.id);
      setCompletions(completionsData);
    } catch (err) {
      console.error('Error fetching chore completions:', err);
    }
  }

  async function handleCreateChore() {
    if (!newChoreTitle.trim() || !userData?.household?.id || !user?.id) return;

    try {
      setCreatingChore(true);
      await addChore({
        title: newChoreTitle.trim(),
        ...(newChoreDescription.trim() && { description: newChoreDescription.trim() }),
        ...(newChoreDueDate && { due_at: newChoreDueDate }),
        created_by: user.id,
        household_id: userData.household.id
      });
      setNewChoreTitle('');
      setNewChoreDescription('');
      setNewChoreDueDate('');
      await fetchChores(); // Refresh the chores
    } catch (err) {
      console.error('Error creating chore:', err);
      setError('Failed to create chore');
    } finally {
      setCreatingChore(false);
    }
  }

  async function handleCompleteChore(choreId: string) {
    if (!user?.id) return;

    try {
      setCompletingChore(choreId);
      await completeChore({
        choreId,
        userId: user.id,
        xp: 10 // Default XP for completing a chore
      });
      await fetchChores(); // Refresh the chores
      await fetchCompletions(); // Refresh completions
    } catch (err) {
      console.error('Error completing chore:', err);
      setError('Failed to complete chore');
    } finally {
      setCompletingChore(null);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDueDate(dateString: string) {
    const dueDate = new Date(dateString);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="text-red-600 font-medium">Overdue</span>;
    } else if (diffDays === 0) {
      return <span className="text-orange-600 font-medium">Due today</span>;
    } else if (diffDays === 1) {
      return <span className="text-yellow-600 font-medium">Due tomorrow</span>;
    } else {
      return <span className="text-gray-600">Due in {diffDays} days</span>;
    }
  }

  // Show loading spinner while auth is loading or data is being fetched
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Chores</h1>
          <p className="text-gray-600">Manage your household chores and tasks</p>
        </div>

        {/* Create new chore section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Chore</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              value={newChoreTitle}
              onChange={(e) => setNewChoreTitle(e.target.value)}
              placeholder="Chore title..."
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateChore()}
            />
            <input
              type="text"
              value={newChoreDescription}
              onChange={(e) => setNewChoreDescription(e.target.value)}
              placeholder="Description (optional)..."
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="datetime-local"
              value={newChoreDueDate}
              onChange={(e) => setNewChoreDueDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleCreateChore}
            disabled={!newChoreTitle.trim() || creatingChore}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingChore ? 'Creating...' : 'Add Chore'}
          </button>
        </div>

        {/* Chores grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chores.map((chore) => (
            <div
              key={chore.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {chore.title}
                </h3>
                <button
                  onClick={() => handleCompleteChore(chore.id)}
                  disabled={completingChore === chore.id}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completingChore === chore.id ? 'Completing...' : 'Complete'}
                </button>
              </div>
              
              {chore.description ? <p className="text-gray-600 mb-4">{chore.description}</p> : null}

              <div className="text-sm text-gray-500 mb-4">
                Created {formatDate(chore.created_at)}
              </div>

              {chore.due_at ? <div className="mb-4">
                  {formatDueDate(chore.due_at)}
                </div> : null}

              {chore.assigned_to ? <div className="text-sm text-gray-600">
                  Assigned to: {chore.assigned_to}
                </div> : null}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {chores.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🧹</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No chores yet</h3>
            <p className="text-gray-600">Add your first chore to get started!</p>
          </div>
        )}

        {/* Recent completions */}
        {completions.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Completions</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chore
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completed By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        XP Earned
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completed At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {completions.slice(0, 10).map((completion) => (
                      <tr key={completion.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {completion.chore.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {completion.completed_by}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          +{completion.xp_earned} XP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(completion.completed_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 