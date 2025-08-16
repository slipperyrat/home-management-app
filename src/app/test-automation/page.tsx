'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useUserData } from '@/hooks/useUserData';
import { postEventTypes } from '@/lib/postEvent';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import Link from 'next/link';

export default function TestAutomationPage() {
  const { user } = useUser();
  const { userData } = useUserData();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [testRule, setTestRule] = useState({
    name: 'Test Heartbeat Rule',
    description: 'Test rule that triggers on heartbeat events',
    triggerTypes: ['heartbeat'],
    actions: [
      {
        name: 'notify',
        params: {
          user_id: user?.id || '',
          title: 'Heartbeat Detected',
          message: 'Your app is running and sending heartbeat events!',
          type: 'info',
          category: 'automation'
        }
      }
    ]
  });

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const createTestRule = async () => {
    if (!userData?.household_id) {
      setMessage('No household ID found');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/automation/create-rule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          household_id: userData.household_id,
          name: testRule.name,
          description: testRule.description,
          trigger_types: testRule.triggerTypes,
          actions: testRule.actions,
          conditions: {}
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create rule');
      }

      const result = await response.json();
      setMessage(`Test rule created successfully! ID: ${result.rule.id}`);
    } catch (error) {
      console.error('Error creating test rule:', error);
      setMessage(`Error creating test rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const triggerHeartbeat = async () => {
    if (!userData?.household_id) {
      setMessage('No household ID found');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await postEventTypes.heartbeat(userData.household_id);
      setMessage('Heartbeat event triggered! Check the Inbox to see if automation rules fired.');
    } catch (error) {
      console.error('Error triggering heartbeat:', error);
      setMessage(`Error triggering heartbeat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const checkAutomationJobs = async () => {
    if (!userData?.household_id) {
      setMessage('No household ID found');
      return;
    }

    setLoading(true);
    setMessage('Checking automation jobs...');

    try {
      console.log('Checking automation jobs for household:', userData.household_id);
      
      const response = await fetch(`/api/automation/check-jobs?household_id=${userData.household_id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check automation jobs');
      }

      const result = await response.json();
      console.log('API response:', result);

      if (result.jobs && result.jobs.length > 0) {
        setMessage(`Found ${result.count} automation jobs. Check the Inbox for details.`);
        console.log('Automation jobs:', result.jobs);
      } else {
        setMessage('No automation jobs found. Try creating a rule and triggering a heartbeat first.');
      }
    } catch (error) {
      console.error('Error checking automation jobs:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !userData?.household_id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Test Automation</h1>
          <p>Please sign in and complete onboarding to test the automation system.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Test Automation System</h1>
        <p className="text-gray-600 mb-6">
          This page helps you test the automation system by creating rules and triggering events.
        </p>

        <div className="space-y-6">
          {/* Create Test Rule */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Create Test Rule</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={testRule.name}
                  onChange={(e) => setTestRule({ ...testRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={testRule.description}
                  onChange={(e) => setTestRule({ ...testRule, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={createTestRule}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Test Rule'}
              </button>
            </div>
          </div>

          {/* Trigger Events */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Trigger Events</h2>
            <div className="space-y-4">
              <button
                onClick={triggerHeartbeat}
                disabled={loading}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Triggering...' : 'Trigger Heartbeat Event'}
              </button>
            </div>
          </div>

          {/* Check Status */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Check Status</h2>
            <div className="space-y-4">
              <button
                onClick={checkAutomationJobs}
                disabled={loading}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Check Automation Jobs'}
              </button>
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-blue-800">{message}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Next Steps</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Create a test rule above</li>
              <li>• Trigger a heartbeat event</li>
              <li>• Check the <Link href="/inbox" className="text-blue-600 hover:underline">Inbox</Link> to see events</li>
              <li>• Check automation jobs status</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
