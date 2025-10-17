'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Entitlements } from '@/lib/entitlements';
import { useUserData } from '@/hooks/useUserData';
import DailyDigest from '@/components/DailyDigest';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Info } from 'lucide-react';

function getFallbackEntitlements(householdId: string | null | undefined): Entitlements {
  const isoNow = new Date().toISOString();
  const resolvedHouseholdId = householdId ?? "unknown";

  return {
    household_id: resolvedHouseholdId,
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
    quota_reset_date: isoNow,
    created_at: isoNow,
    updated_at: isoNow,
  };
}

export default function DigestPage() {
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
                  You need to be part of a household to access digest features.
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Digest</h1>
          <p className="text-gray-600">
            Manage your daily email summaries and digest preferences.
          </p>
        </div>

        {/* Daily Digest Component */}
        {safeEntitlements ? (
          <DailyDigest
            householdId={userHouseholdId}
            entitlements={safeEntitlements}
          />
        ) : null}

        {/* Additional Digest Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              More Digest Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Weekly Digest</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Get comprehensive weekly summaries with achievements, insights, and progress reports.
                </p>
                <a 
                  href="/digest-preferences"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Configure Weekly Digest →
                </a>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Digest Preferences</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Customize what content is included in your digests and when they're sent.
                </p>
                <a 
                  href="/digest-preferences"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Manage Preferences →
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
