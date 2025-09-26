'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { ProBadge } from '@/components/ProBadge';

export default function UpgradePage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: 'pro' | 'pro_plus') => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    setLoading(plan);
    
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();

      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        console.error('Failed to create checkout session:', data.error);
        alert('Failed to start upgrade process. Please try again.');
      }
    } catch (error) {
      console.error('Error upgrading plan:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const freeFeatures = [
    {
      icon: '📅',
      title: 'Calendar & Events',
      description: 'Manage family events and schedules'
    },
    {
      icon: '🧹',
      title: 'Chores',
      description: 'AI-powered chore assignment and tracking'
    },
    {
      icon: '🛒',
      title: 'Shopping Lists',
      description: 'Smart shopping list management'
    },
    {
      icon: '🍽️',
      title: 'Meal Planning',
      description: 'Plan meals and generate grocery lists'
    }
  ];

  const proFeatures = [
    {
      icon: '💰',
      title: 'Finance Tracking',
      description: 'Bills, budgets, and spending management'
    },
    {
      icon: '🤖',
      title: 'AI Features',
      description: 'Smart suggestions and automation'
    },
    {
      icon: '📊',
      title: 'Advanced Analytics',
      description: 'Detailed insights and progress tracking'
    },
    {
      icon: '📱',
      title: 'Push Notifications',
      description: 'Stay updated with important reminders'
    }
  ];

  const proPlusFeatures = [
    {
      icon: '🔄',
      title: 'Two-way Google Sync',
      description: 'Seamless calendar synchronization'
    },
    {
      icon: '🏠',
      title: 'Multi-household',
      description: 'Manage up to 3 households'
    },
    {
      icon: '⚙️',
      title: 'Admin Tools',
      description: 'Advanced management and bulk operations'
    },
    {
      icon: '🚀',
      title: 'Unlimited Automations',
      description: 'Create complex multi-step workflows'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-4">
              <span className="text-3xl">⭐</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Unlock powerful features and take your home management to the next level
            </p>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Free Plan */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">$0</div>
              <p className="text-gray-600">Perfect for getting started</p>
            </div>
            <ul className="space-y-3 mb-6">
              {freeFeatures.map((feature, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="text-green-500 text-lg">✓</div>
                  <div>
                    <div className="font-medium text-gray-900">{feature.title}</div>
                    <div className="text-sm text-gray-600">{feature.description}</div>
                  </div>
                </li>
              ))}
            </ul>
            <button className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors">
              Current Plan
            </button>
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-500 relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">Most Popular</span>
            </div>
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro</h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">$8.99</div>
              <p className="text-gray-600">per month</p>
            </div>
            <ul className="space-y-3 mb-6">
              {proFeatures.map((feature, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="text-green-500 text-lg">✓</div>
                  <div>
                    <div className="font-medium text-gray-900">{feature.title}</div>
                    <div className="text-sm text-gray-600">{feature.description}</div>
                  </div>
                </li>
              ))}
            </ul>
            <button 
              onClick={() => handleUpgrade('pro')}
              disabled={loading === 'pro'}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'pro' ? 'Processing...' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* Pro+ Plan */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro+</h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">$14.99</div>
              <p className="text-gray-600">per month</p>
            </div>
            <ul className="space-y-3 mb-6">
              {proPlusFeatures.map((feature, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="text-green-500 text-lg">✓</div>
                  <div>
                    <div className="font-medium text-gray-900">{feature.title}</div>
                    <div className="text-sm text-gray-600">{feature.description}</div>
                  </div>
                </li>
              ))}
            </ul>
            <button 
              onClick={() => handleUpgrade('pro_plus')}
              disabled={loading === 'pro_plus'}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'pro_plus' ? 'Processing...' : 'Upgrade to Pro+'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to upgrade?</h3>
            <p className="text-gray-600 mb-4">
              Contact your household owner to upgrade your plan and unlock Pro features
            </p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors">
              Contact Owner
            </button>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Have questions about upgrading? Reach out to your household owner for assistance.
          </p>
        </div>
      </div>
    </div>
  );
} 