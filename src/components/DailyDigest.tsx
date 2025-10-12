'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Mail, Clock, CheckCircle, AlertCircle, Send, Settings, Calendar, BarChart3 } from 'lucide-react';
import { canAccessFeature, Entitlements } from '@/lib/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { logger } from '@/lib/logging/logger';

interface DailyDigestProps {
  householdId: string;
  entitlements: Entitlements;
}

interface DigestPreferencesResponse {
  success: boolean;
  data?: {
    daily_digest_enabled?: boolean;
    daily_digest_time?: string;
    email_enabled?: boolean;
    email_address?: string;
  };
  error?: string;
}

interface DigestHistoryResponse {
  success: boolean;
  data?: {
    last_sent?: string | null;
    next_scheduled?: string | null;
    quota_used?: number;
  };
  error?: string;
}

interface DigestSendResponse {
  success: boolean;
  stats?: {
    success_count: number;
  };
  error?: string;
}

interface DigestStatus {
  enabled: boolean;
  last_sent: string | null;
  next_scheduled: string | null;
  quota_used: number;
  quota_limit: number;
  preferences: {
    daily_digest_enabled: boolean;
    daily_digest_time: string;
    email_enabled: boolean;
    email_address: string;
  };
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleString();
};

const DIGEST_TYPE = 'daily';

export default function DailyDigest({ householdId, entitlements }: DailyDigestProps) {
  const [digestStatus, setDigestStatus] = useState<DigestStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAccessDailyDigest = useMemo(
    () => canAccessFeature(entitlements, 'digest_max_per_day'),
    [entitlements],
  );

  const loadDigestStatus = useCallback(async () => {
    if (!canAccessDailyDigest) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const [prefsResponse, historyResponse] = await Promise.all([
        fetch('/api/digest/preferences'),
        fetch(`/api/digest/history?household_id=${householdId}`),
      ]);

      const prefsData = (await prefsResponse.json()) as DigestPreferencesResponse;
      if (!prefsData.success || !prefsData.data) {
        throw new Error(prefsData.error || 'Failed to load digest preferences');
      }

      const historyData = (await historyResponse.json()) as DigestHistoryResponse;
      if (!historyData.success || !historyData.data) {
        throw new Error(historyData.error || 'Failed to load digest history');
      }

      const status: DigestStatus = {
        enabled: Boolean(prefsData.data.daily_digest_enabled),
        last_sent: historyData.data.last_sent ?? null,
        next_scheduled: historyData.data.next_scheduled ?? null,
        quota_used: historyData.data.quota_used ?? 0,
        quota_limit: entitlements.digest_max_per_day ?? 1,
        preferences: {
          daily_digest_enabled: Boolean(prefsData.data.daily_digest_enabled),
          daily_digest_time: prefsData.data.daily_digest_time ?? '08:00',
          email_enabled: Boolean(prefsData.data.email_enabled),
          email_address: prefsData.data.email_address ?? '',
        },
      };

      setDigestStatus(status);
    } catch (err) {
      logger.error('Error loading digest status', err as Error, { householdId });
      setError(err instanceof Error ? err.message : 'Failed to load digest status');
    } finally {
      setIsLoading(false);
    }
  }, [canAccessDailyDigest, entitlements.digest_max_per_day, householdId]);

  useEffect(() => {
    void loadDigestStatus();
  }, [loadDigestStatus]);

  const handleSendDigestRequest = useCallback(
    async (endpoint: string, payload?: Record<string, unknown>) => {
      try {
        setIsSending(true);
        setError(null);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload ?? { type: DIGEST_TYPE }),
        });

        const data = (await response.json()) as DigestSendResponse;

        if (data.success) {
          if (data.stats?.success_count !== undefined) {
            toast.success(`Daily digest sent to ${data.stats.success_count} users`);
          } else {
            toast.success('Test daily digest sent successfully!');
          }
          await loadDigestStatus();
        } else {
          toast.error(data.error || 'Failed to send digest');
        }
      } catch (err) {
        logger.error('Error sending digest', err as Error, { endpoint, householdId });
        toast.error('Failed to send digest');
      } finally {
        setIsSending(false);
      }
    },
    [householdId, loadDigestStatus],
  );

  if (!canAccessDailyDigest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Daily Digest
          </CardTitle>
          <CardDescription>Receive daily email summaries of your household activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upgrade to Pro to unlock Daily Digest</h3>
            <p className="text-gray-600 mb-4">
              Get daily email summaries of your chores, events, meals, and more.
            </p>
            <Button className="bg-green-600 hover:bg-green-700">Upgrade to Pro</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Daily Digest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Daily Digest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorDisplay error={error} />
        </CardContent>
      </Card>
    );
  }

  if (!digestStatus) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Daily Digest
          </CardTitle>
          <CardDescription>Receive daily email summaries of your household activities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Status</span>
              </div>
              <div className="flex items-center gap-2">
                {digestStatus.enabled ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Disabled
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Last Sent</span>
              </div>
              <p className="text-sm text-gray-600">{formatDate(digestStatus.last_sent)}</p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-orange-500" />
                <span className="font-medium">Quota</span>
              </div>
              <p className="text-sm text-gray-600">
                {digestStatus.quota_used} / {digestStatus.quota_limit} today
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Email Configuration</h4>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <Label htmlFor="email-enabled" className="text-base font-medium">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-gray-600">
                    {digestStatus.preferences.email_enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
              <Switch id="email-enabled" checked={digestStatus.preferences.email_enabled} disabled />
            </div>

            {digestStatus.preferences.email_enabled && digestStatus.preferences.email_address ? (
              <div className="p-4 bg-gray-50 rounded-lg">
                <Label htmlFor="email-address" className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <Input id="email-address" value={digestStatus.preferences.email_address} readOnly className="mt-1" />
              </div>
            ) : null}

            <div className="p-4 bg-gray-50 rounded-lg">
              <Label htmlFor="digest-time" className="text-sm font-medium text-gray-700">
                Send Time
              </Label>
              <Input
                id="digest-time"
                type="time"
                value={digestStatus.preferences.daily_digest_time}
                readOnly
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => handleSendDigestRequest('/api/digest/test')}
              disabled={isSending || !digestStatus.enabled}
              variant="outline"
              className="flex-1"
            >
              {isSending ? <LoadingSpinner /> : <Send className="h-4 w-4 mr-2" />}
              Send Test Digest
            </Button>

            <Button
              onClick={() => handleSendDigestRequest('/api/digest/send', {
                household_id: householdId,
                type: DIGEST_TYPE,
              })}
              disabled={isSending || !digestStatus.enabled}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isSending ? <LoadingSpinner /> : <Send className="h-4 w-4 mr-2" />}
              Send Now
            </Button>
          </div>

          <div className="text-center">
            <Link
              href="/digest-preferences"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
            >
              <Settings className="h-4 w-4" />
              Manage Digest Settings
            </Link>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Daily Digest Information</p>
                <p>
                  Daily digests are sent automatically at your chosen time. You can send test digests anytime to
                  preview the content. Manage your preferences in the settings page.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
