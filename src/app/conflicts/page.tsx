'use client';

import { useEffect, useState } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { canAccessFeature } from '@/lib/entitlements';
import ConflictDetection from '@/components/ConflictDetection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Info, AlertTriangle, Clock, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function ConflictsPage() {
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
                  You need to be part of a household to access conflict detection features.
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Conflict Detection</h1>
          <p className="text-gray-600">
            Automatically detect and manage calendar conflicts to keep your schedule organized.
          </p>
        </div>

        {/* Conflict Detection Component */}
        <ConflictDetection 
          householdId={userData.household_id}
          entitlements={entitlements}
        />

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              About Conflict Detection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Overlap Detection
                </h4>
                <p className="text-sm text-gray-600">
                  Automatically detects when events overlap in time, helping you avoid double-booking.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Duplicate Title Detection
                </h4>
                <p className="text-sm text-gray-600">
                  Identifies events with identical titles that might be duplicates or need clarification.
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Exact Time Detection
                </h4>
                <p className="text-sm text-gray-600">
                  Finds events that have exactly the same start and end times, which are likely conflicts.
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Pro Feature
                </h4>
                <p className="text-sm text-gray-600">
                  Conflict detection is a Pro feature that helps maintain a clean, organized calendar 
                  by automatically identifying potential scheduling issues.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
