'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useUserData } from '@/hooks/useUserData';
import { postEventTypes } from '@/lib/postEvent';
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

  const [selectedRuleType, setSelectedRuleType] = useState('heartbeat');
  const [ruleConditions, setRuleConditions] = useState({});

  // Predefined rule templates for different scenarios
  const ruleTemplates = {
    heartbeat: {
      name: 'Heartbeat Monitor',
      description: 'Monitors app activity and sends notifications',
      triggerTypes: ['heartbeat'],
      actions: [
        {
          name: 'notify',
          params: {
            user_id: user?.id || '',
            title: 'App Activity Detected',
            message: 'Your home management app is active and running!',
            type: 'info',
            category: 'automation'
          }
        }
      ]
    },
    choreCompleted: {
      name: 'Chore Completion Celebration',
      description: 'Rewards users when they complete chores',
      triggerTypes: ['chore.completed'],
      actions: [
        {
          name: 'notify',
          params: {
            user_id: user?.id || '',
            title: 'Chore Completed! 🎉',
            message: 'Great job! You\'ve earned XP for completing a chore.',
            type: 'success',
            category: 'automation'
          }
        }
      ]
    },
    billReceived: {
      name: 'Bill Management Assistant',
      description: 'Automatically processes incoming bills',
      triggerTypes: ['bill.email.received'],
      actions: [
        {
          name: 'notify',
          params: {
            user_id: user?.id || '',
            title: 'New Bill Received',
            message: 'A new bill has been automatically detected and processed.',
            type: 'warning',
            category: 'automation'
          }
        },
        {
          name: 'create_bill',
          params: {
            name: 'Auto-detected Bill',
            amount: 0,
            currency: 'AUD',
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
            category: 'utilities',
            description: 'Automatically created from email'
          }
        }
      ]
    },
    shoppingListUpdated: {
      name: 'Shopping List Monitor',
      description: 'Tracks shopping list changes and notifies household',
      triggerTypes: ['shopping_list.updated'],
      actions: [
        {
          name: 'notify',
          params: {
            user_id: user?.id || '',
            title: 'Shopping List Updated',
            message: 'Someone in your household has updated the shopping list.',
            type: 'info',
            category: 'automation'
          }
        }
      ]
    }
  };

  const updateRuleFromTemplate = (templateKey: keyof typeof ruleTemplates) => {
    const template = ruleTemplates[templateKey];
    setTestRule({
      ...template,
      actions: template.actions.map((action: any) => ({
        ...action,
        params: {
          ...action.params,
          user_id: user?.id || ''
        }
      }))
    });
    setSelectedRuleType(templateKey);
  };

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

  const triggerChoreCompleted = async () => {
    if (!userData?.household_id) {
      setMessage('No household ID found');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await postEventTypes.choreCompleted(userData.household_id, 'test-chore-id', user?.id || '');
      setMessage('Chore completed event triggered! Check the Inbox to see if automation rules fired.');
    } catch (error) {
      console.error('Error triggering chore completed:', error);
      setMessage(`Error triggering chore completed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const triggerBillReceived = async () => {
    if (!userData?.household_id) {
      setMessage('No household ID found');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const billData = {
        name: 'Test Utility Bill',
        amount: 125.50,
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days from now
        category: 'utilities',
        source: 'email'
      };
      
      await postEventTypes.billReceived(userData.household_id, billData);
      setMessage('Bill received event triggered! Check the Inbox to see if automation rules fired.');
    } catch (error) {
      console.error('Error triggering bill received:', error);
      setMessage(`Error triggering bill received: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const triggerShoppingListUpdated = async () => {
    if (!userData?.household_id) {
      setMessage('No household ID found');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await postEventTypes.shoppingListUpdated(userData.household_id, 'test-list-id', 'items_added');
      setMessage('Shopping list updated event triggered! Check the Inbox to see if automation rules fired.');
    } catch (error) {
      console.error('Error triggering shopping list updated:', error);
      setMessage(`Error triggering shopping list updated: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const runAutomationWorker = async () => {
    if (!userData?.household_id) {
      setMessage('No household ID found');
      return;
    }

    setLoading(true);
    setMessage('Running automation worker...');

    try {
      console.log('Running automation worker for household:', userData.household_id);
      
      // Call the Supabase automation worker function directly
      const response = await fetch(`/api/automation/run-worker?household_id=${userData.household_id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run automation worker');
      }

      const result = await response.json();
      console.log('Worker response:', result);

      if (result.jobsProcessed > 0) {
        setMessage(`Automation worker processed ${result.jobsProcessed} jobs. ${result.jobsSucceeded} succeeded, ${result.jobsFailed} failed. Check the Inbox for notifications.`);
      } else {
        setMessage('No pending automation jobs found to process.');
      }
    } catch (error) {
      console.error('Error running automation worker:', error);
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
            
            {/* Rule Templates */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose Rule Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateRuleFromTemplate('heartbeat')}
                  className={`px-3 py-2 text-sm rounded-md border ${
                    selectedRuleType === 'heartbeat' 
                      ? 'bg-blue-100 border-blue-300 text-blue-800' 
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Heartbeat Monitor
                </button>
                <button
                  onClick={() => updateRuleFromTemplate('choreCompleted')}
                  className={`px-3 py-2 text-sm rounded-md border ${
                    selectedRuleType === 'choreCompleted' 
                      ? 'bg-blue-100 border-blue-300 text-blue-800' 
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Chore Completion
                </button>
                <button
                  onClick={() => updateRuleFromTemplate('billReceived')}
                  className={`px-3 py-2 text-sm rounded-md border ${
                    selectedRuleType === 'billReceived' 
                      ? 'bg-blue-100 border-blue-300 text-blue-800' 
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Bill Management
                </button>
                <button
                  onClick={() => updateRuleFromTemplate('shoppingListUpdated')}
                  className={`px-3 py-2 text-sm rounded-md border ${
                    selectedRuleType === 'shoppingListUpdated' 
                      ? 'bg-blue-100 border-blue-300 text-blue-800' 
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Shopping List
                </button>
              </div>
            </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Types
                </label>
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border">
                  {testRule.triggerTypes.join(', ')}
                </div>
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
              
              <button
                onClick={triggerChoreCompleted}
                disabled={loading}
                className="w-full bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                {loading ? 'Triggering...' : 'Trigger Chore Completed Event'}
              </button>
              
              <button
                onClick={triggerBillReceived}
                disabled={loading}
                className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Triggering...' : 'Trigger Bill Received Event'}
              </button>
              
              <button
                onClick={triggerShoppingListUpdated}
                disabled={loading}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Triggering...' : 'Trigger Shopping List Updated Event'}
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
              
              <button
                onClick={runAutomationWorker}
                disabled={loading}
                className="w-full bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                {loading ? 'Running...' : 'Run Automation Worker'}
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
              <li>• Choose a rule template (Heartbeat, Chore, Bill, Shopping List)</li>
              <li>• Customize the rule name and description if desired</li>
              <li>• Create the automation rule</li>
              <li>• Trigger the corresponding event type</li>
              <li>• Run the automation worker to process jobs</li>
              <li>• Check the <Link href="/inbox" className="text-blue-600 hover:underline">Inbox</Link> to see notifications</li>
              <li>• Test different rule types and see how they interact</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
