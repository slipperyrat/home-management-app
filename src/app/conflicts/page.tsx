'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useUserData } from '@/hooks/useUserData';
import ConflictDetection from '@/components/ConflictDetection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Info, AlertTriangle, Clock, Users, Calendar } from 'lucide-react';
import type { Entitlements } from '@/lib/entitlements';

function getFallbackEntitlements(householdId: string): Entitlements {
  return {
    household_id: householdId,
    tier: 'free',
    history_months: 0,
    advanced_rrule: false,
    conflict_detection: 'none',
    google_import: false,
    digest_max_per_day: 0,
    quiet_hours: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
    quota_actions_per_month: 0,
    quota_actions_used: 0,
    quota_reset_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export default function ConflictsPage() {
  const { userData, isLoading } = useUserData();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [entitlementsLoading, setEntitlementsLoading] = useState(true);
  const householdId = userData?.household_id;

  const loadEntitlements = useCallback(async () => {
    if (!householdId) {
      return;
    }

    try {
      setEntitlementsLoading(true);
      const response = await fetch(`/api/entitlements/${householdId}`);
      const data = await response.json();
      
      if (response.ok) {
        setEntitlements(data as Entitlements);
      } else {
        console.error('Failed to load entitlements:', data.error);
        setEntitlements(getFallbackEntitlements(householdId));
      }
    } catch (error) {
      console.error('Error loading entitlements:', error);
      setEntitlements(getFallbackEntitlements(householdId));
    } finally {
      setEntitlementsLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (householdId) {
      void loadEntitlements();
    }
  }, [householdId, loadEntitlements]);

  const userHouseholdId = userData?.household_id ?? householdId ?? null

  const safeEntitlements = useMemo(() => {
    if (entitlements) {
      return entitlements
    }

    return userHouseholdId ? getFallbackEntitlements(userHouseholdId) : null
  }, [entitlements, userHouseholdId])

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

  if (!userHouseholdId) {
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
        {safeEntitlements ? (
          <ConflictDetection 
            householdId={userHouseholdId}
            entitlements={safeEntitlements}
          />
        ) : null}

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
