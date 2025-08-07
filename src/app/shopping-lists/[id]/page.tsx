'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getShoppingItems, addShoppingItem, toggleShoppingItemComplete } from '@/lib/shoppingLists';
import { debugUser } from '@/lib/debugUser';

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  completed: boolean;
  list_id: string;
  created_at: string;
  completed_at?: string;
  completed_by?: string;
}

interface ShoppingList {
  id: string;
  title: string;
  created_at: string;
  created_by: string;
  household_id: string;
}

export default function ShoppingListDetailPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;
  
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [addingItem, setAddingItem] = useState(false);
  const [togglingItems, setTogglingItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    if (listId) {
      fetchShoppingListData();
    }
  }, [isLoaded, isSignedIn, listId, router]);

  async function fetchShoppingListData() {
    if (!listId) return;

    // Check if listId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(listId)) {
      setError('Invalid shopping list ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Debug user data
      if (user?.id) {
        await debugUser(user.id);
      }

      // For now, we'll fetch the list data separately
      // In a real app, you might want to create a getShoppingList function
      const items = await getShoppingItems(listId);
      setShoppingItems(items);

      // Mock the list data for now - in a real app you'd fetch this
      setShoppingList({
        id: listId,
        title: `Shopping List ${listId.slice(0, 8)}`,
        created_at: new Date().toISOString(),
        created_by: user?.id || '',
        household_id: ''
      });

    } catch (err) {
      console.error('Error fetching shopping list data:', err);
      setError('Failed to load shopping list');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem() {
    if (!newItemName.trim() || !listId) return;

    try {
      setAddingItem(true);
      const newItem = await addShoppingItem(listId, newItemName.trim(), newItemQuantity);
      
      setShoppingItems(prev => [...prev, newItem]);
      setNewItemName('');
      setNewItemQuantity(1);
    } catch (err) {
      console.error('Error adding shopping item:', err);
      setError('Failed to add item');
    } finally {
      setAddingItem(false);
    }
  }

  async function handleToggleItem(itemId: string) {
    console.log('🔄 handleToggleItem called with:', { itemId, userId: user?.id });
    
    if (!user?.id) {
      console.log('❌ No user ID found');
      return;
    }

    // Find the current item for optimistic update
    const currentItem = shoppingItems.find(item => item.id === itemId);
    if (!currentItem) {
      console.log('❌ No current item found');
      return;
    }

    // Optimistic update - immediately update UI
    const optimisticItem = {
      ...currentItem,
      completed: !currentItem.completed,
      completed_by: !currentItem.completed ? user.id : null,
      completed_at: !currentItem.completed ? new Date().toISOString() : null
    };

    setShoppingItems(prev => 
      prev.map(item => 
        item.id === itemId ? optimisticItem : item
      )
    );

    setTogglingItems(prev => new Set(prev).add(itemId));

    try {
      console.log('🎯 About to call API endpoint with:', { itemId, userId: user.id });
      
      const response = await fetch('/api/shopping-items/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle item');
      }

      const result = await response.json();
      console.log('✅ API call succeeded:', result);
      
      // Update with actual server response
      setShoppingItems(prev => 
        prev.map(item => 
          item.id === itemId ? result.item : item
        )
      );
    } catch (err) {
      console.error('❌ Error toggling item:', err);
      
      // Revert optimistic update on error
      setShoppingItems(prev => 
        prev.map(item => 
          item.id === itemId ? currentItem : item
        )
      );
      
      setError('Failed to update item');
    } finally {
      setTogglingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
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

  // Show loading spinner while auth is loading or data is being fetched
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 mr-2"
              >
                Try Again
              </button>
              <button 
                onClick={() => router.push('/shopping-lists')}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Back to Lists
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const completedItems = shoppingItems.filter(item => item.completed);
  const pendingItems = shoppingItems.filter(item => !item.completed);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center"
          >
            ← Back to Lists
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {shoppingList?.title || 'Shopping List'}
          </h1>
          <p className="text-gray-600">
            {shoppingItems.length} items • {completedItems.length} completed
          </p>
        </div>

        {/* Debug section */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">Debug Info</h3>
          <p className="text-sm text-yellow-700 mb-2">User ID: {user?.id}</p>
          <button
            onClick={() => user?.id && debugUser(user.id)}
            className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
          >
            Debug User in Database
          </button>
        </div>

        {/* Add new item section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Item</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Name
              </label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Enter item name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
              />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qty
              </label>
              <input
                type="number"
                min="1"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleAddItem}
              disabled={!newItemName.trim() || addingItem}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingItem ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </div>

        {/* Shopping items */}
        <div className="space-y-6">
          {/* Pending items */}
          {pendingItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">To Buy</h2>
              <div className="bg-white rounded-lg shadow">
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <button
                      onClick={() => handleToggleItem(item.id)}
                      disabled={togglingItems.has(item.id)}
                      className="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded-full mr-4 hover:border-blue-500 disabled:opacity-50"
                    >
                      {togglingItems.has(item.id) && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto mt-0.5"></div>
                      )}
                    </button>
                    <div className="flex-1">
                      <span className="text-gray-900 font-medium">
                        {item.name}
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-gray-500 ml-2">
                          (x{item.quantity})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(item.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed items */}
          {completedItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Completed</h2>
              <div className="bg-white rounded-lg shadow">
                {completedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <button
                      onClick={() => handleToggleItem(item.id)}
                      disabled={togglingItems.has(item.id)}
                      className="flex-shrink-0 w-6 h-6 bg-green-500 border-2 border-green-500 rounded-full mr-4 flex items-center justify-center hover:bg-green-600 disabled:opacity-50"
                    >
                      {togglingItems.has(item.id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1">
                      <span className="text-gray-500 line-through">
                        {item.name}
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-gray-400 ml-2">
                          (x{item.quantity})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.completed_at && formatDate(item.completed_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {shoppingItems.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
              <p className="text-gray-600">Add your first item to get started!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 