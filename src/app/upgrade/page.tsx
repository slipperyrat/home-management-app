'use client';

import { useRouter } from 'next/navigation';
import { ProBadge } from '@/components/ProBadge';

export default function UpgradePage() {
  const router = useRouter();

  const features = [
    {
      icon: '📅',
      title: 'Calendar',
      description: 'Manage family events and schedules'
    },
    {
      icon: '🏆',
      title: 'Rewards System',
      description: 'Redeem XP for exciting rewards'
    },
    {
      icon: '⏰',
      title: 'Reminders',
      description: 'Set notifications for important tasks'
    },
    {
      icon: '📊',
      title: 'Advanced Analytics',
      description: 'Detailed insights and progress tracking'
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
              Upgrade to <ProBadge size="lg" />
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Unlock premium features and take your home management to the next level
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              What's included in Pro?
            </h2>
            <p className="text-gray-600">
              Get access to all premium features and enhance your household management experience
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-4 p-4 rounded-lg bg-gray-50">
                <div className="text-2xl">{feature.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-6 text-white mb-6">
              <h3 className="text-xl font-semibold mb-2">Ready to upgrade?</h3>
              <p className="text-purple-100 mb-4">
                Contact your household owner to upgrade your plan and unlock all Pro features
              </p>
              <button className="bg-white text-purple-600 px-6 py-2 rounded-md font-semibold hover:bg-gray-100 transition-colors">
                Contact Owner
              </button>
            </div>
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