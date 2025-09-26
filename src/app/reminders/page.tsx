'use client'

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getReminders, addReminder, deleteReminder } from '@/lib/reminders';
import { getChores } from '@/lib/chores';
import { getCalendarEvents } from '@/lib/calendar';
import { canAccessFeature } from '@/lib/planFeatures';

interface UserData {
  email: string;
  role: 'owner' | 'member';
  plan: 'free' | 'pro' | 'pro_plus';
  xp: number;
  coins: number;
  household: {
    id: string;
    plan: string;
    game_mode: string;
    created_at: string;
  };
}

interface Reminder {
  id: string;
  title: string;
  related_type: 'chore' | 'calendar_event';
  related_id: string;
  remind_at: string;
  created_by: string;
  household_id: string;
  created_at: string;
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

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  created_by: string;
  household_id: string;
  created_at: string;
}

export default function RemindersPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingReminder, setAddingReminder] = useState(false);
  const [deletingReminder, setDeletingReminder] = useState<string | null>(null);
  const [loadingRelatedItems, setLoadingRelatedItems] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    related_type: 'chore' as 'chore' | 'calendar_event',
    related_id: '',
    remind_at: ''
  });

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
          const userDataObj = {
            email: result.data.email,
            role: result.data.role,
            plan: result.data.plan || 'free',
            xp: result.data.xp || 0,
            coins: result.data.coins || 0,
            household: result.data.household
          };
          
          setUserData(userDataObj);

          // Check if user can access reminders feature
          if (!canAccessFeature(userDataObj.plan, 'reminders')) {
            router.push('/upgrade');
            
          }
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
      fetchReminders();
      fetchRelatedItems();
    }
  }, [userData]);

  async function fetchRelatedItems() {
    if (!userData?.household?.id) return;

    try {
      setLoadingRelatedItems(true);
      const [choresData, eventsData] = await Promise.all([
        getChores(userData.household.id),
        getCalendarEvents(userData.household.id)
      ]);
      setChores(choresData);
      setCalendarEvents(eventsData);
    } catch (err) {
      console.error('Error fetching related items:', err);
      setError('Failed to load chores and events');
    } finally {
      setLoadingRelatedItems(false);
    }
  }

  async function fetchReminders() {
    if (!userData?.household?.id) return;

    try {
      setLoading(true);
      const data = await getReminders(userData.household.id);
      setReminders(data);
    } catch (err) {
      console.error('Error fetching reminders:', err);
      setError('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !userData?.household?.id) return;

    try {
      setAddingReminder(true);
      setError(null);

      await addReminder({
        title: formData.title,
        related_type: formData.related_type,
        related_id: formData.related_id,
        remind_at: formData.remind_at,
        created_by: user.id,
        household_id: userData.household.id
      });

      // Reset form
      setFormData({
        title: '',
        related_type: 'chore',
        related_id: '',
        remind_at: ''
      });

      // Refresh reminders
      await fetchReminders();
    } catch (err) {
      console.error('Error adding reminder:', err);
      setError('Failed to add reminder');
    } finally {
      setAddingReminder(false);
    }
  }

  function handleRelatedTypeChange(newType: 'chore' | 'calendar_event') {
    setFormData({
      ...formData,
      related_type: newType,
      related_id: '' // Reset related_id when type changes
    });
  }

  async function handleDeleteReminder(reminderId: string) {
    if (!user?.id) return;

    try {
      setDeletingReminder(reminderId);
      setError(null);

      await deleteReminder(reminderId);
      await fetchReminders();
    } catch (err) {
      console.error('Error deleting reminder:', err);
      setError('Failed to delete reminder');
    } finally {
      setDeletingReminder(null);
    }
  }

  function formatDateTime(dateTimeString: string) {
    return new Date(dateTimeString).toLocaleString('en-US', {
      weekday: 'short',
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">⏰ Reminders</h1>
          <p className="text-gray-600">Manage your household reminders</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Reminder Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Reminder</h2>
              
              <form onSubmit={handleAddReminder} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Reminder title"
                  />
                </div>

                                 <div>
                   <label htmlFor="related_type" className="block text-sm font-medium text-gray-700 mb-1">
                     Related Type *
                   </label>
                   <select
                     id="related_type"
                     required
                     value={formData.related_type}
                     onChange={(e) => handleRelatedTypeChange(e.target.value as 'chore' | 'calendar_event')}
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                   >
                     <option value="chore">Chore</option>
                     <option value="calendar_event">Calendar Event</option>
                   </select>
                 </div>

                 <div>
                   <label htmlFor="related_id" className="block text-sm font-medium text-gray-700 mb-1">
                     Related Item *
                   </label>
                   {loadingRelatedItems ? (
                     <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                       Loading {formData.related_type === 'chore' ? 'chores' : 'events'}...
                     </div>
                   ) : (
                     <select
                       id="related_id"
                       required
                       value={formData.related_id}
                       onChange={(e) => setFormData({ ...formData, related_id: e.target.value })}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                     >
                       <option value="">Select a {formData.related_type === 'chore' ? 'chore' : 'event'}</option>
                       {formData.related_type === 'chore' ? (
                         chores.map((chore) => (
                           <option key={chore.id} value={chore.id}>
                             {chore.title}
                           </option>
                         ))
                       ) : (
                         calendarEvents.map((event) => (
                           <option key={event.id} value={event.id}>
                             {event.title}
                           </option>
                         ))
                       )}
                     </select>
                   )}
                   {formData.related_type === 'chore' && chores.length === 0 && !loadingRelatedItems && (
                     <p className="text-sm text-gray-500 mt-1">No chores available. Create some chores first.</p>
                   )}
                   {formData.related_type === 'calendar_event' && calendarEvents.length === 0 && !loadingRelatedItems && (
                     <p className="text-sm text-gray-500 mt-1">No calendar events available. Create some events first.</p>
                   )}
                 </div>

                <div>
                  <label htmlFor="remind_at" className="block text-sm font-medium text-gray-700 mb-1">
                    Remind At *
                  </label>
                  <input
                    type="datetime-local"
                    id="remind_at"
                    required
                    value={formData.remind_at}
                    onChange={(e) => setFormData({ ...formData, remind_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingReminder}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingReminder ? 'Adding...' : 'Add Reminder'}
                </button>
              </form>
            </div>
          </div>

          {/* Reminders List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Upcoming Reminders</h2>
              </div>
              
              {reminders.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="text-gray-400 text-6xl mb-4">⏰</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No reminders set</h3>
                  <p className="text-gray-600">Add your first reminder to get started!</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {reminders.map((reminder) => (
                    <li key={reminder.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{reminder.title}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              reminder.related_type === 'chore' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {reminder.related_type === 'chore' ? 'Chore' : 'Event'}
                            </span>
                          </div>
                          
                          <div className="text-sm text-gray-500 space-y-1">
                            <div>⏰ {formatDateTime(reminder.remind_at)}</div>
                            <div>🔗 Related ID: {reminder.related_id}</div>
                            <div>👤 Created by: {reminder.created_by.replace('user_', '').slice(0, 6)}...</div>
                          </div>
                        </div>
                        
                        {reminder.created_by === user?.id && (
                          <button
                            onClick={() => handleDeleteReminder(reminder.id)}
                            disabled={deletingReminder === reminder.id}
                            className="ml-4 text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingReminder === reminder.id ? 'Deleting...' : '🗑️'}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 