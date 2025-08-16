'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserData {
  email: string;
  role: 'owner' | 'member';
  plan: 'free' | 'premium';
  household: {
    id: string;
    plan: string;
  };
}

interface PlannerItem {
  id: string;
  title: string;
  description?: string;
  category: 'trip' | 'renovation' | 'dream' | 'goal' | 'event' | 'other';
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  created_by: string;
  household_id: string;
  created_at: string;
  updated_at: string;
}

export default function PlannerPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

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
      fetchPlannerItems();
    }
  }, [userData]);

  async function fetchPlannerItems() {
    if (!userData?.household?.id) return;

    try {
      const response = await fetch('/api/planner');
      const result = await response.json();

      if (response.ok) {
        // API returns array directly
        setPlannerItems(Array.isArray(result) ? result : []);
      }
    } catch (err) {
      console.error('Error fetching planner items:', err);
    }
  }

  function getCategoryIcon(category: string): string {
    switch (category) {
      case 'trip': return '✈️';
      case 'renovation': return '🏠';
      case 'dream': return '💭';
      case 'goal': return '🎯';
      case 'event': return '📅';
      default: return '📝';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'on-hold': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  const filteredItems = selectedCategory === 'all' 
    ? plannerItems 
    : plannerItems.filter(item => item.category === selectedCategory);

  const categories = [
    { id: 'all', name: 'All Plans', icon: '📋' },
    { id: 'trip', name: 'Trips', icon: '✈️' },
    { id: 'renovation', name: 'Renovations', icon: '🏠' },
    { id: 'dream', name: 'Dreams', icon: '💭' },
    { id: 'goal', name: 'Goals', icon: '🎯' },
    { id: 'event', name: 'Events', icon: '📅' },
    { id: 'other', name: 'Other', icon: '📝' }
  ];

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

  if (!isSignedIn) {
    return null;
  }

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
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow rounded-lg mb-4 sm:mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Collaborative Planner</h1>
                <p className="text-sm sm:text-base text-gray-600">Plan trips, renovations, dreams, goals, and more together</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-3 sm:py-2 rounded-md hover:bg-blue-700 active:bg-blue-800 font-medium text-base sm:text-sm touch-manipulation"
              >
                + New Plan
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="px-4 sm:px-6 py-4">
            <div className="flex space-x-2 overflow-x-auto pb-2 -mb-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors touch-manipulation ${
                    selectedCategory === category.id
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                  }`}
                >
                  <span>{category.icon}</span>
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Planner Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white shadow rounded-lg p-4 sm:p-6 cursor-pointer hover:shadow-md active:scale-95 transition-all duration-200 touch-manipulation"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <span className="text-xl sm:text-2xl flex-shrink-0">{getCategoryIcon(item.category)}</span>
                  <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                </div>
                <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1 ml-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(item.status)}`}>
                    {item.status.replace('-', ' ')}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getPriorityColor(item.priority)}`}>
                    {item.priority}
                  </span>
                </div>
              </div>

              {item.description ? <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p> : null}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500 space-y-1 sm:space-y-0">
                <span>Created {formatDate(item.created_at)}</span>
                {item.due_date ? <span className="font-medium">
                    Due: {formatDate(item.due_date)}
                  </span> : null}
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No plans yet</h3>
            <p className="text-gray-600 mb-4">
              {selectedCategory === 'all' 
                ? 'Create your first plan to get started!'
                : `No ${categories.find(c => c.id === selectedCategory)?.name.toLowerCase()} plans yet.`
              }
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Create Your First Plan
            </button>
          </div>
        )}

        {/* Create Plan Modal */}
        {showCreateModal ? <CreatePlanModal
            onClose={() => setShowCreateModal(false)}
            onCreated={(newItem) => {
              setPlannerItems([newItem, ...plannerItems]); // Add to beginning
              setShowCreateModal(false);
              // Optionally refresh the list to ensure consistency
              setTimeout(() => fetchPlannerItems(), 100);
            }}
            householdId={userData?.household?.id || ''}
          /> : null}
      </div>
    </div>
  );
}

interface CreatePlanModalProps {
  onClose: () => void;
  onCreated: (item: PlannerItem) => void;
  householdId: string;
}

function CreatePlanModal({ onClose, onCreated, householdId: _householdId }: CreatePlanModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('trip');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          due_date: dueDate || null
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Plan created successfully:', result);
        onCreated(result); // API returns the item directly
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to create plan:', errorData);
        alert(`Failed to create plan: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error creating plan:', err);
      alert('Failed to create plan. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Create New Plan</h2>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-600 p-2 -mr-2 touch-manipulation"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 sm:px-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter plan title..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 sm:px-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Enter description..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 sm:px-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="trip">🌍 Trip</option>
                  <option value="renovation">🏠 Renovation</option>
                  <option value="dream">💭 Dream</option>
                  <option value="goal">🎯 Goal</option>
                  <option value="event">🎉 Event</option>
                  <option value="other">📋 Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-3 sm:px-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 sm:px-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-3 sm:py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100 font-medium text-base sm:text-sm touch-manipulation"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || creating}
              className="px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base sm:text-sm touch-manipulation"
            >
              {creating ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
