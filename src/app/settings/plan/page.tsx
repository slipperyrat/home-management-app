'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canAccessFeature } from "@/lib/planFeatures";

interface UserData {
  email: string;
  role: 'owner' | 'member';
  plan: 'free' | 'premium';
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
            plan: result.user.plan || 'free'
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

    const newPlan = userData.plan === 'free' ? 'premium' : 'free';
    
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
        setSuccessMessage(`Plan successfully updated to ${newPlan === 'premium' ? 'Premium' : 'Free'}!`);
      }
    } catch (err) {
      console.error('Exception updating plan:', err);
      setError('An unexpected error occurred while updating plan');
    } finally {
      setUpdating(false);
    }
  };

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

          {successMessage && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="text-green-400">✓</div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Current Plan Section */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Your current plan is:</p>
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      userData?.plan === 'premium' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {userData?.plan === 'premium' ? '⭐ Premium' : '🆓 Free'}
                    </span>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handlePlanToggle}
                    disabled={updating}
                    className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                      updating
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {updating ? 'Updating...' : `Switch to ${userData?.plan === 'free' ? 'Premium' : 'Free'}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Plan Comparison */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Features</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Free Plan</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Shopping List
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Calendar
                    </li>
                    <li className="flex items-center">
                      <span className="text-red-500 mr-2">✗</span>
                      Games
                    </li>
                    <li className="flex items-center">
                      <span className="text-red-500 mr-2">✗</span>
                      Finance Tracking
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Premium Plan</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Shopping List
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Calendar
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Games
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Finance Tracking
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