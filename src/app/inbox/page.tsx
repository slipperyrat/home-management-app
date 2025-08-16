import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import InboxEvents from '@/components/Inbox/InboxEvents';

export default async function InboxPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  const supabase = createServerComponentClient({ cookies });
  
  // Get user's household
  const { data: userData } = await supabase
    .from('users')
    .select('household_id')
    .eq('clerk_id', userId)
    .single();

  if (!userData?.household_id) {
    // Instead of redirecting, show a message and link to complete onboarding
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Inbox</h1>
            <p className="text-gray-600 mb-4">
              View automation events and system notifications for your household
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Complete Onboarding First
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      You need to complete the onboarding process to access your inbox. 
                      This will set up your household and enable all features.
                    </p>
                  </div>
                  <div className="mt-4">
                    <a
                      href="/onboarding"
                      className="bg-yellow-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                    >
                      Go to Onboarding
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Inbox</h1>
          <p className="text-gray-600">
            View automation events and system notifications for your household
          </p>
        </div>
        
        <InboxEvents householdId={userData.household_id} />
      </div>
    </div>
  );
}
