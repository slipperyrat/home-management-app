'use client';

import { useEffect, useState } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { canAccessFeature } from '@/lib/entitlements';
import QuietHours from '@/components/QuietHours';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Info, BellOff, Clock, Moon } from 'lucide-react';
import { toast } from 'sonner';

export default function QuietHoursPage() {
  const { userData, isLoading } = useUserData();
  const [entitlements, setEntitlements] = useState<any>(null);
  const [entitlementsLoading, setEntitlementsLoading] = useState(true);

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
                  You need to be part of a household to access quiet hours features.
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiet Hours</h1>
          <p className="text-gray-600">
            Manage notification quiet hours to automatically silence alerts during specific times.
          </p>
        </div>

        {/* Quiet Hours Component */}
        <QuietHours 
          householdId={userData.household_id}
          entitlements={entitlements}
        />

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              About Quiet Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <BellOff className="h-4 w-4" />
                  What Gets Silenced
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Push notifications for new chores, events, and reminders</li>
                  <li>• Email alerts for household activities</li>
                  <li>• In-app notification sounds and banners</li>
                  <li>• Automated system notifications</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  How It Works
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Set your preferred start and end times</li>
                  <li>• Choose which days of the week to apply quiet hours</li>
                  <li>• Notifications are automatically silenced during these times</li>
                  <li>• You can still access the app normally during quiet hours</li>
                </ul>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Pro Feature
                </h4>
                <p className="text-sm text-gray-600">
                  Quiet hours are a Pro feature that helps you maintain a healthy work-life balance 
                  by automatically managing when you receive household notifications.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
