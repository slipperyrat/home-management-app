'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserData } from '@/hooks/useUserData';
import { DigestPreferences } from '@/components/DigestPreferences';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

export default function DigestPreferencesPage() {
  const router = useRouter();
  const { userData, isLoading, isError, error, refetch, isLoaded, isSignedIn } = useUserData();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
  }, [isLoaded, isSignedIn, router]);

  // Show skeleton loading while auth is loading or data is being fetched
  if (!isLoaded || isLoading) {
    return <DashboardSkeleton />;
  }

  // This should not be reached if redirect is working, but just in case
  if (!isSignedIn) {
    return null;
  }

  // Show error state
  if (isError && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorDisplay 
          error={error.message || 'An unexpected error occurred'} 
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow rounded-lg p-4 sm:p-6">
          <DigestPreferences />
        </div>
      </div>
    </div>
  );
}
