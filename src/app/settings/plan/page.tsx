'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';


interface UserData {
  email: string;
  role: 'owner' | 'member';
  plan: 'free' | 'pro' | 'pro_plus';
}

export default function PlanSettingsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

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
            plan: result.data.plan || 'free'
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

  const handlePlanToggle = async () => {
    if (!userData || userData.role !== 'owner') return;

    // Cycle through plans: free -> pro -> pro_plus -> free
    let newPlan: 'free' | 'pro' | 'pro_plus';
    if (userData.plan === 'free') {
      newPlan = 'pro';
    } else if (userData.plan === 'pro') {
      newPlan = 'pro_plus';
    } else {
      newPlan = 'free';
    }
    
    try {
      setUpdating(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/update-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan: newPlan }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error updating plan:', result.error);
        setError(result.error || 'Failed to update plan');
        return;
      }

      if (result.success) {
        setUserData(prev => prev ? { ...prev, plan: newPlan } : null);
        const planDisplayName = newPlan === 'pro_plus' ? 'Pro+' : newPlan === 'pro' ? 'Pro' : 'Free';
        setSuccessMessage(`Plan successfully updated to ${planDisplayName}!`);
      }
    } catch (err) {
      console.error('Exception updating plan:', err);
      setError('An unexpected error occurred while updating plan');
    } finally {
      setUpdating(false);
    }
  };

  const handleBillingPortal = async () => {
    if (!userData) return;

    setBillingLoading(true);
    
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        console.error('Failed to create portal session:', data.error);
        alert('Failed to open billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setBillingLoading(false);
    }
  };

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

  // Check if user is owner
  if (userData && userData.role !== 'owner') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white shadow rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">🚫</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-4">Only household owners can manage plan settings.</p>
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
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

  // Show plan settings content
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Plan Settings
            </h1>
            <p className="text-gray-600">
              Manage your household's subscription plan
            </p>
          </div>

          {successMessage ? <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="text-green-400">✓</div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">{successMessage}</p>
                </div>
              </div>
            </div> : null}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Current Plan Section */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Your current plan is:</p>
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      userData?.plan === 'pro_plus' 
                        ? 'bg-purple-100 text-purple-800' 
                        : userData?.plan === 'pro'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {userData?.plan === 'pro_plus' ? '⭐ Pro+' : userData?.plan === 'pro' ? '⭐ Pro' : '🆓 Free'}
                    </span>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  {userData?.plan !== 'free' && (
                    <button
                      onClick={handleBillingPortal}
                      disabled={billingLoading}
                      className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                        billingLoading
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {billingLoading ? 'Loading...' : 'Manage Billing'}
                    </button>
                  )}
                  
                  <button
                    onClick={handlePlanToggle}
                    disabled={updating}
                    className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                      updating
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {updating ? 'Updating...' : `Switch to ${userData?.plan === 'free' ? 'Pro' : userData?.plan === 'pro' ? 'Pro+' : 'Free'}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Plan Comparison */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Features</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Free Plan</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Shopping List
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Calendar & Events
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Chores
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Basic Reminders
                    </li>
                    <li className="flex items-center">
                      <span className="text-red-500 mr-2">✗</span>
                      Finance Tracking
                    </li>
                    <li className="flex items-center">
                      <span className="text-red-500 mr-2">✗</span>
                      Advanced Analytics
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Pro Plan</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Everything in Free
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Finance Tracking
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Advanced Analytics
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      AI Features
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Google Calendar Read
                    </li>
                    <li className="flex items-center">
                      <span className="text-red-500 mr-2">✗</span>
                      Multi-household
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Pro+ Plan</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Everything in Pro
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Two-way Google Calendar Sync
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Multi-household (up to 3)
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Admin Tools
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Unlimited Automations
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Priority Support
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 