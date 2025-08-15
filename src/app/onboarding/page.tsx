'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

// Validation schemas
const HouseholdSchema = z.object({
  name: z.string().min(1, 'Household name is required').max(100, 'Name too long'),
});

const StarterDataSchema = z.object({
  loadSampleRecipes: z.boolean(),
  loadSamplePlannerItems: z.boolean(),
});

export default function OnboardingPage() {
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Household data
  const [householdName, setHouseholdName] = useState('');
  const [memberCount] = useState(1);
  
  // Step 2: Starter data options
  const [loadSampleRecipes, setLoadSampleRecipes] = useState(true);
  const [loadSamplePlannerItems, setLoadSamplePlannerItems] = useState(true);

  useEffect(() => {
    if (user?.firstName && user?.lastName) {
      setHouseholdName(`${user.firstName}'s Household`);
    } else if (user?.firstName) {
      setHouseholdName(`${user.firstName}'s Household`);
    }
  }, [user]);

  if (!isSignedIn) {
    router.push('/sign-in');
    return null;
  }

  const handleHouseholdStep = async () => {
    try {
      const validation = HouseholdSchema.safeParse({ name: householdName });
      if (!validation.success) {
        const firstIssue = validation.error.issues[0];
        if (firstIssue) {
          toast.error(firstIssue.message);
        } else {
          toast.error('Invalid household name');
        }
        return;
      }

      setIsLoading(true);
      
      const response = await fetch('/api/onboarding/household', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: householdName,
        }),
      });

      if (response.ok) {
        setCurrentStep(2);
        toast.success('Household setup complete!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to setup household');
      }
    } catch (error) {
      console.error('Error setting up household:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

    const handleStarterDataStep = async () => {
    try {
      const validation = StarterDataSchema.safeParse({
        loadSampleRecipes,
        loadSamplePlannerItems,
      });

      if (!validation.success) {
        toast.error('Invalid starter data options');
        return;
      }

      setIsLoading(true);

      const response = await fetch('/api/onboarding/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sampleRecipes: loadSampleRecipes,
          samplePlans: loadSamplePlannerItems,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const { recipesAdded, plansAdded } = result;
        
        setCurrentStep(3);
        
        // Enhanced toast with counts and action buttons
        if (recipesAdded > 0 || plansAdded > 0) {
          const message = `Loaded ${recipesAdded} recipes • ${plansAdded} plans`;
          toast.success(message, {
            duration: 6000,
            action: {
              label: recipesAdded > 0 ? 'View Meal Planner' : 'View Planner',
              onClick: () => {
                if (typeof window !== 'undefined') {
                  if (recipesAdded > 0) {
                    window.open('/meal-planner', '_blank');
                  } else {
                    window.open('/planner', '_blank');
                  }
                }
              },
            },
            cancel: plansAdded > 0 && recipesAdded > 0 ? {
              label: 'View Planner',
              onClick: () => {
                if (typeof window !== 'undefined') {
                  window.open('/planner', '_blank');
                }
              },
            } : undefined,
          });
        } else {
          toast.success('Starter data ready!');
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create starter data');
      }
    } catch (error) {
      console.error('Error creating starter data:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success('Welcome to your new home management system!');
        router.push('/dashboard');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to complete onboarding');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white text-center">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome to Home Management! 🏠
            </h1>
            <p className="text-blue-100">
              Hello {user?.firstName || 'there'}! Let's get your household set up.
            </p>
            
            {/* Debug section */}
            <div className="mt-4 p-3 bg-blue-800 bg-opacity-50 rounded-lg">
              <p className="text-sm text-blue-100 mb-2">🔧 Debug Tools (You shouldn't see this if properly onboarded)</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/debug/user-status');
                      const data = await response.json();
                      console.log('🔍 User Status:', data);
                      alert(`Check console for user status. hasOnboarded: ${  data.debug?.hasOnboarded}`);
                    } catch (error) {
                      console.error('Error checking status:', error);
                      alert(`Error checking status: ${  error}`);
                    }
                  }}
                  className="px-3 py-1 bg-blue-700 text-white text-xs rounded hover:bg-blue-600"
                >
                  🔍 Check Status
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/debug/fix-onboarding', { method: 'POST' });
                      const data = await response.json();
                      console.log('🔧 Fix Result:', data);
                      if (data.success) {
                        alert('✅ Onboarding status fixed! Redirecting to dashboard...');
                        router.push('/dashboard');
                      } else {
                        alert(`❌ Failed to fix: ${  data.error}`);
                      }
                    } catch (error) {
                      console.error('Error fixing onboarding:', error);
                      alert(`Error fixing onboarding: ${  error}`);
                    }
                  }}
                  className="px-3 py-1 bg-green-700 text-white text-xs rounded hover:bg-green-600"
                >
                  🔧 Fix Onboarding
                </button>
              </div>
            </div>
          </div>

                           {/* Progress indicator */}
                 <div className="px-6 py-6 bg-gray-50">
                   <div className="flex items-center justify-center space-x-2 md:space-x-4">
                     {[1, 2, 3].map((step) => (
                       <div key={step} className="flex items-center">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                           currentStep >= step
                             ? 'bg-blue-600 text-white'
                             : 'bg-gray-200 text-gray-600'
                         }`}>
                           {step}
                         </div>
                         {step < 3 && (
                           <div className={`w-8 md:w-16 h-1 mx-2 transition-colors ${
                             currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                           }`} />
                         )}
                       </div>
                     ))}
                   </div>
                   <div className="flex justify-center mt-3">
                     <div className="text-center">
                       <div className="text-sm font-medium text-gray-700">
                         Step {currentStep} of 3
                       </div>
                       <div className="text-xs text-gray-500 mt-1">
                         {currentStep === 1 && 'Household Setup'}
                         {currentStep === 2 && 'Starter Data'}
                         {currentStep === 3 && 'Complete Setup'}
                       </div>
                     </div>
                   </div>
                 </div>

          {/* Step Content */}
          <div className="px-6 py-8">
            {/* Step 1: Household */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">
                    Set Up Your Household
                  </h2>
                  <p className="text-gray-600">
                    Let's start with some basic information about your home.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="householdName" className="block text-sm font-medium text-gray-700 mb-2">
                      Household Name
                    </label>
                    <input
                      id="householdName"
                      type="text"
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      placeholder="Enter your household name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      maxLength={100}
                    />
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-blue-900">Current Members</h3>
                        <p className="text-sm text-blue-700">You can invite more people later</p>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        {memberCount}
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      onClick={() => toast.info('You can invite members from the dashboard after setup!')}
                    >
                      💌 I'll invite people later
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleHouseholdStep}
                  disabled={isLoading || !householdName.trim()}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Setting up...' : 'Continue'}
                </button>
              </div>
            )}

            {/* Step 2: Starter Data */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">
                    Add Starter Content
                  </h2>
                  <p className="text-gray-600">
                    We can populate your account with some sample data to get you started.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loadSampleRecipes}
                        onChange={(e) => setLoadSampleRecipes(e.target.checked)}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Load sample recipes</div>
                        <div className="text-sm text-gray-500">
                          Add a variety of recipes to your meal planner (breakfast, lunch, dinner)
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loadSamplePlannerItems}
                        onChange={(e) => setLoadSamplePlannerItems(e.target.checked)}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Load sample planner items</div>
                        <div className="text-sm text-gray-500">
                          Add example tasks and planning items to help you get organized
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleStarterDataStep}
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Creating starter data...' : 'Create starter data'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Finish */}
            {currentStep === 3 && (
              <div className="space-y-6 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <div>
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">
                    You're All Set!
                  </h2>
                  <p className="text-gray-600">
                    Your household is ready to go. Welcome to your new home management system!
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-4 text-left">
                  <h3 className="font-medium text-green-900 mb-2">What's been set up:</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>✅ Your household: {householdName}</li>
                    {loadSampleRecipes ? <li>✅ Sample recipes added</li> : null}
                    {loadSamplePlannerItems ? <li>✅ Sample planner items added</li> : null}
                    <li>✅ Your account is ready to use</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCompleteOnboarding}
                    disabled={isLoading}
                    className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Finalizing...' : 'Go to Dashboard'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
