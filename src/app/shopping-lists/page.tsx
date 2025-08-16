'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getShoppingLists, createShoppingList } from '@/lib/shoppingLists';

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

interface ShoppingList {
  id: string;
  title: string;
  created_at: string;
  created_by: string;
  household_id: string;
  shopping_items: ShoppingItem[];
}

interface ShoppingItem {
  id: string;
  name: string;
  quantity: string | null;
  completed: boolean;
  list_id: string;
}

export default function ShoppingListsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newListTitle, setNewListTitle] = useState('');
  const [creatingList, setCreatingList] = useState(false);

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

        if (result.success && result.data) {
          setUserData({
            email: result.data.email,
            role: result.data.role,
            plan: result.data.plan || 'free',
            xp: result.data.xp || 0,
            coins: result.data.coins || 0,
            household: result.data.household
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
      fetchShoppingLists();
    }
  }, [userData]);

  async function fetchShoppingLists() {
    if (!userData?.household?.id) return;

    try {
      setLoading(true);
      const lists = await getShoppingLists(userData.household.id);
      setShoppingLists(lists);
    } catch (err) {
      console.error('Error fetching shopping lists:', err);
      setError('Failed to load shopping lists');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateList() {
    if (!newListTitle.trim() || !userData?.household?.id || !user?.id) return;

    try {
      setCreatingList(true);
      await createShoppingList(newListTitle.trim(), user.id, userData.household.id);
      setNewListTitle('');
      await fetchShoppingLists(); // Refresh the lists
    } catch (err) {
      console.error('Error creating shopping list:', err);
      setError('Failed to create shopping list');
    } finally {
      setCreatingList(false);
    }
  }

  function handleListClick(listId: string) {
    router.push(`/shopping-lists/${listId}`);
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
              onClick={() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Shopping Lists</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your household shopping lists</p>
        </div>

        {/* Create new list section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New List</h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              placeholder="Enter list title..."
              className="flex-1 px-4 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateList()}
            />
            <button
              onClick={handleCreateList}
              disabled={!newListTitle.trim() || creatingList}
              className="px-6 py-3 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base sm:text-sm"
            >
              {creatingList ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </div>

        {/* Shopping lists grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {shoppingLists.map((list) => (
            <div
              key={list.id}
              onClick={() => handleListClick(list.id)}
              className="bg-white rounded-lg shadow hover:shadow-md transition-all duration-200 cursor-pointer p-4 sm:p-6 active:scale-95 touch-manipulation"
            >
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <h3 className="text-lg font-semibold text-gray-900 truncate pr-2">
                  {list.title}
                </h3>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  {list.shopping_items?.length || 0} items
                </span>
              </div>
              
              <div className="text-sm text-gray-500 mb-3 sm:mb-4">
                Created {formatDate(list.created_at)}
              </div>

              {/* Progress bar */}
              {list.shopping_items && list.shopping_items.length > 0 ? <div className="mb-3 sm:mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progress</span>
                    <span>
                      {list.shopping_items.filter(item => item.completed).length} / {list.shopping_items.length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(list.shopping_items.filter(item => item.completed).length / list.shopping_items.length) * 100}%`
                      }}
                    />
                  </div>
                </div> : null}

              <div className="text-blue-600 text-sm font-medium flex items-center">
                <span>View details</span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {shoppingLists.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-4xl sm:text-6xl text-gray-400 mb-4">🛒</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No shopping lists yet</h3>
            <p className="text-sm sm:text-base text-gray-600">Create your first shopping list to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
} 