'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { canAccessFeature, getAvailableFeatures, getUpgradeRequiredFeatures, FeatureKey, UserPlan } from '@/lib/server/canAccessFeature';

interface FeatureFlag {
  key: FeatureKey;
  name: string;
  description: string;
  requiredPlan: UserPlan;
  enabled: boolean;
}

const FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: 'brand_assets_v1',
    name: 'Brand Assets v1',
    description: 'New branding and visual assets',
    requiredPlan: 'free',
    enabled: false,
  },
  {
    key: 'onboarding_tour',
    name: 'Onboarding Tour',
    description: 'Interactive tutorial for new users',
    requiredPlan: 'free',
    enabled: false,
  },
  {
    key: 'consent_optout',
    name: 'Consent Opt-out',
    description: 'Allow users to opt out of data collection',
    requiredPlan: 'free',
    enabled: false,
  },
  {
    key: 'projects_beta',
    name: 'Projects Beta',
    description: 'Project management features',
    requiredPlan: 'pro',
    enabled: false,
  },
  {
    key: 'finance_enabled',
    name: 'Finance Features',
    description: 'Bill management and budget tracking',
    requiredPlan: 'pro',
    enabled: false,
  },
  {
    key: 'notifications_minimal',
    name: 'Minimal Notifications',
    description: 'Basic push notification system',
    requiredPlan: 'pro',
    enabled: false,
  },
  {
    key: 'ask_box_enabled',
    name: 'Ask Box',
    description: 'AI-powered question answering',
    requiredPlan: 'pro',
    enabled: false,
  },
];

export default function FeatureFlagsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<UserPlan>('free');
  const [flags, setFlags] = useState<FeatureFlag[]>(FEATURE_FLAGS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    // Check if user is admin (you might want to add proper admin check)
    // For now, we'll allow any signed-in user to access this page
  }, [isLoaded, isSignedIn, router]);

  const handlePlanChange = (plan: UserPlan) => {
    setSelectedPlan(plan);
    setFlags(prev => prev.map(flag => ({
      ...flag,
      enabled: canAccessFeature(plan, flag.key),
    })));
  };

  const toggleFlag = (key: FeatureKey) => {
    setFlags(prev => prev.map(flag => 
      flag.key === key ? { ...flag, enabled: !flag.enabled } : flag
    ));
  };

  const saveFlags = async () => {
    setLoading(true);
    try {
      // In a real implementation, you'd save these to a database
      // For now, we'll just simulate a save
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Feature flags saved successfully!');
    } catch (error) {
      console.error('Error saving flags:', error);
      alert('Failed to save feature flags');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Feature Flags Dashboard
            </h1>
            <p className="text-gray-600">
              Manage feature flags and test different plan configurations
            </p>
          </div>

          {/* Plan Selector */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Plan</h2>
            <div className="flex space-x-4">
              {(['free', 'pro', 'pro_plus'] as UserPlan[]).map((plan) => (
                <button
                  key={plan}
                  onClick={() => handlePlanChange(plan)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    selectedPlan === plan
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {plan === 'pro_plus' ? 'Pro+' : plan === 'pro' ? 'Pro' : 'Free'}
                </button>
              ))}
            </div>
          </div>

          {/* Feature Flags */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Feature Flags</h2>
            <div className="space-y-4">
              {flags.map((flag) => (
                <div key={flag.key} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900">{flag.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          flag.requiredPlan === 'free' 
                            ? 'bg-green-100 text-green-800'
                            : flag.requiredPlan === 'pro'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {flag.requiredPlan === 'pro_plus' ? 'Pro+' : flag.requiredPlan === 'pro' ? 'Pro' : 'Free'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-sm ${
                        flag.enabled ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {flag.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        onClick={() => toggleFlag(flag.key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          flag.enabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            flag.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={saveFlags}
              disabled={loading}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Back Button */}
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