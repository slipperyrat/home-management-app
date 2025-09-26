'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserData } from '@/hooks/useUserData';
import { canAccessFeature } from '@/lib/entitlements';
import GoogleCalendarImport from '@/components/GoogleCalendarImport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function CalendarSyncPage() {
  const { userData, isLoading } = useUserData();
  const searchParams = useSearchParams();
  const [entitlements, setEntitlements] = useState<any>(null);
  const [entitlementsLoading, setEntitlementsLoading] = useState(true);

  // Check for success/error messages from OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const calendars = searchParams.get('calendars');

    if (success === 'true') {
      toast.success(`Successfully connected to Google Calendar! Found ${calendars} calendars.`);
    } else if (error === 'authentication_failed') {
      toast.error('Failed to connect to Google Calendar. Please try again.');
    }
  }, [searchParams]);

  // Load entitlements
  useEffect(() => {
    if (userData?.household_id) {
      loadEntitlements();
    }
  }, [userData?.household_id]);

  const loadEntitlements = async () => {
    try {
      setEntitlementsLoading(true);
      const response = await fetch(`/api/entitlements/${userData.household_id}`);
      const data = await response.json();
      
      if (response.ok) {
        setEntitlements(data);
      } else {
        console.error('Failed to load entitlements:', data.error);
      }
    } catch (error) {
      console.error('Error loading entitlements:', error);
    } finally {
      setEntitlementsLoading(false);
    }
  };

  if (isLoading || entitlementsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!userData?.household_id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Household Required
                </h2>
                <p className="text-gray-600">
                  You need to be part of a household to access calendar sync features.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendar Sync</h1>
          <p className="text-gray-600">
            Connect and sync your external calendars with your household calendar.
          </p>
        </div>

        {/* Google Calendar Import */}
        <GoogleCalendarImport 
          householdId={userData.household_id}
          entitlements={entitlements}
        />

        {/* Additional Sync Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              More Sync Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Export Your Calendar</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Share your household calendar with external applications using our public ICS feed.
                </p>
                <a 
                  href={`/calendar/sync/export`}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  View Export Options →
                </a>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Coming Soon</h4>
                <p className="text-sm text-gray-600">
                  We're working on additional calendar sync options including Apple Calendar, 
                  Outlook, and other popular calendar applications.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}