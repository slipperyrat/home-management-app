'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import EventRow from './EventRow';

interface HouseholdEvent {
  id: string;
  type: string;
  source: string;
  payload: Record<string, any>;
  occurred_at: string;
  created_at: string;
}

interface InboxEventsProps {
  householdId: string;
}

export default function InboxEvents({ householdId }: InboxEventsProps) {
  const [events, setEvents] = useState<HouseholdEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [eventTypes, setEventTypes] = useState<string[]>([]);

  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    fetchEvents();
    fetchEventTypes();
  }, [householdId, selectedType]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('household_events')
        .select('*')
        .eq('household_id', householdId)
        .order('occurred_at', { ascending: false })
        .limit(100);

      if (selectedType !== 'all') {
        query = query.eq('type', selectedType);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const fetchEventTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('household_events')
        .select('type')
        .eq('household_id', householdId);

      if (error) throw error;
      
      const types = [...new Set(data?.map(e => e.type) || [])];
      setEventTypes(types);
    } catch (err) {
      console.error('Error fetching event types:', err);
    }
  };

  const handleRefresh = () => {
    fetchEvents();
    fetchEventTypes();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading events</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={handleRefresh}
                className="bg-red-100 text-red-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-200"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Recent Events</h2>
          <div className="flex items-center space-x-4">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Event Types</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {events.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-gray-500">
              {selectedType === 'all' ? 'No events found' : `No events of type "${selectedType}" found`}
            </div>
          </div>
        ) : (
          events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))
        )}
      </div>

      {events.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 text-center">
          Showing {events.length} most recent events
        </div>
      )}
    </div>
  );
}
