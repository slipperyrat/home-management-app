import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import InboxEvents from '@/components/Inbox/InboxEvents';

export default async function InboxPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  const supabase = createServerComponentClient({ cookies });
  
  // Get user's household - try both clerk_id and id patterns
  let { data: userData } = await supabase
    .from('users')
    .select('household_id, id, onboarding_completed')
    .eq('clerk_id', userId)
    .single();
    
  // If not found by clerk_id, try by id (for users with user_ prefix)
  if (!userData) {
    const { data: userDataById } = await supabase
      .from('users')
      .select('household_id, id, onboarding_completed')
      .eq('id', userId)
      .single();
    userData = userDataById;
  }
  
  // Debug logging
  console.log('Inbox page - User ID:', userId);
  console.log('Inbox page - User data found:', userData);

  if (!userData?.household_id) {
    // Debug information to help troubleshoot
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Inbox</h1>
            <p className="text-gray-600 mb-4">
              View automation events and system notifications for your household
            </p>
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Debug: User Data Issue
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      <strong>User ID:</strong> {userId}<br/>
                      <strong>User Data Found:</strong> {userData ? 'Yes' : 'No'}<br/>
                      <strong>Household ID:</strong> {userData?.household_id || 'Missing'}<br/>
                      <strong>Onboarding Completed:</strong> {userData?.onboarding_completed ? 'Yes' : 'No'}<br/>
                    </p>
                    <p className="mt-2">
                      This suggests there's a mismatch between your Clerk user ID and the database record.
                    </p>
                  </div>
                  <div className="mt-4 space-x-2">
                    <a
                      href="/onboarding"
                      className="bg-red-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Go to Onboarding
                    </a>
                    <a
                      href="/dashboard"
                      className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Go to Dashboard
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
