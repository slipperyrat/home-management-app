'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, ArrowLeft } from 'lucide-react';

import { useUserData } from '@/hooks/useUserData';
import type { Entitlements } from '@/lib/entitlements';
import { fetchEntitlements } from '@/lib/entitlements-client';
import CalendarTemplates from '@/components/CalendarTemplates';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CalendarTemplatesPage() {
  const { userData, isLoading: userLoading, isError: userError } = useUserData();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEntitlements = useCallback(async () => {
    if (!userData?.household_id) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchEntitlements(userData.household_id);
      setEntitlements(data);
    } catch (err) {
      console.error('Error loading entitlements:', err);
      setError('Failed to load entitlements');
    } finally {
      setIsLoading(false);
    }
  }, [userData?.household_id]);

  useEffect(() => {
    if (userData?.household_id) {
      void loadEntitlements();
    }
  }, [userData?.household_id, loadEntitlements]);

  if (userLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (userError || error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <ErrorDisplay error={error || 'Failed to load user data'} />
        </div>
      </div>
    );
  }

  if (!userData?.household_id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No Household Found
              </h2>
              <p className="text-gray-600 mb-4">
                You need to be part of a household to access calendar templates.
              </p>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/calendar" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Calendar
              </Link>
            </Button>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Calendar Templates
            </h1>
            <p className="text-gray-600">
              Create events quickly using pre-built templates for school terms, sports schedules, and more.
            </p>
          </div>
        </div>

        {/* Templates Component */}
        <CalendarTemplates 
          householdId={userData.household_id} 
          entitlements={entitlements}
        />

        {/* Pro Features Info */}
        {entitlements?.tier === 'pro' && (
          <Card className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Calendar className="h-5 w-5" />
                Pro Features Active
              </CardTitle>
              <CardDescription className="text-blue-700">
                You have access to all calendar template features with your Pro subscription.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm text-blue-800">Unlimited custom templates</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm text-blue-800">Advanced recurrence patterns</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm text-blue-800">Conflict detection</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
