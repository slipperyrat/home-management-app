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
    redirect('/onboarding');
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
