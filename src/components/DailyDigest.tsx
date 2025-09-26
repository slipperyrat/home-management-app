'use client';

import { useState, useEffect } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { canAccessFeature } from '@/lib/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Mail, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Send,
  Settings,
  Calendar,
  Users,
  BarChart3
} from 'lucide-react';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';

interface DailyDigestProps {
  householdId: string;
  entitlements: any;
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

export default function DailyDigest({ householdId, entitlements }: DailyDigestProps) {
  const { userData } = useUserData();
  const [digestStatus, setDigestStatus] = useState<DigestStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user can access daily digest (Pro feature)
  const canAccessDailyDigest = canAccessFeature(entitlements, 'digest_max_per_day');

  useEffect(() => {
    if (canAccessDailyDigest) {
      loadDigestStatus();
    } else {
      setIsLoading(false);
    }
  }, [canAccessDailyDigest, householdId]);

  const loadDigestStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get digest preferences
      const prefsResponse = await fetch('/api/digest/preferences');
      const prefsData = await prefsResponse.json();
      
      if (!prefsData.success) {
        throw new Error(prefsData.error || 'Failed to load digest preferences');
      }

      // Get digest history
      const historyResponse = await fetch(`/api/digest/history?household_id=${householdId}`);
      const historyData = await historyResponse.json();
      
      const status: DigestStatus = {
        enabled: prefsData.data.daily_digest_enabled || false,
        last_sent: historyData.data?.last_sent || null,
        next_scheduled: historyData.data?.next_scheduled || null,
        quota_used: historyData.data?.quota_used || 0,
        quota_limit: entitlements.digest_max_per_day || 1,
        preferences: {
          daily_digest_enabled: prefsData.data.daily_digest_enabled || false,
          daily_digest_time: prefsData.data.daily_digest_time || '08:00',
          email_enabled: prefsData.data.email_enabled || false,
          email_address: prefsData.data.email_address || ''
        }
      };

      setDigestStatus(status);
    } catch (err) {
      console.error('Error loading digest status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load digest status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestDigest = async () => {
    try {
      setIsSending(true);
      setError(null);

      const response = await fetch('/api/digest/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'daily' }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Test daily digest sent successfully!');
        loadDigestStatus(); // Refresh status
      } else {
        toast.error(data.error || 'Failed to send test digest');
      }
    } catch (err) {
      console.error('Error sending test digest:', err);
      toast.error('Failed to send test digest');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendDigest = async () => {
    try {
      setIsSending(true);
      setError(null);

      const response = await fetch('/api/digest/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          household_id: householdId,
          type: 'daily'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Daily digest sent to ${data.stats.success_count} users`);
        loadDigestStatus(); // Refresh status
      } else {
        toast.error(data.error || 'Failed to send digest');
      }
    } catch (err) {
      console.error('Error sending digest:', err);
      toast.error('Failed to send digest');
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (!canAccessDailyDigest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Daily Digest
          </CardTitle>
          <CardDescription>
            Receive daily email summaries of your household activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upgrade to Pro to unlock Daily Digest
            </h3>
            <p className="text-gray-600 mb-4">
              Get daily email summaries of your chores, events, meals, and more.
            </p>
            <Button className="bg-green-600 hover:bg-green-700">
              Upgrade to Pro
            </Button>
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Daily Digest
          </CardTitle>
          <CardDescription>
            Receive daily email summaries of your household activities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Status</span>
              </div>
              <div className="flex items-center gap-2">
                {digestStatus?.enabled ? (
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
              <p className="text-sm text-gray-600">
                {formatDate(digestStatus?.last_sent)}
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-orange-500" />
                <span className="font-medium">Quota</span>
              </div>
              <p className="text-sm text-gray-600">
                {digestStatus?.quota_used || 0} / {digestStatus?.quota_limit || 1} today
              </p>
            </div>
          </div>

          {/* Email Configuration */}
          {digestStatus?.preferences && (
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
                <Switch
                  id="email-enabled"
                  checked={digestStatus.preferences.email_enabled}
                  disabled
                />
              </div>

              {digestStatus.preferences.email_enabled && digestStatus.preferences.email_address && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Label htmlFor="email-address" className="text-sm font-medium text-gray-700">
                    Email Address
                  </Label>
                  <Input
                    id="email-address"
                    value={digestStatus.preferences.email_address}
                    readOnly
                    className="mt-1"
                  />
                </div>
              )}

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
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button 
              onClick={handleSendTestDigest}
              disabled={isSending || !digestStatus?.enabled}
              variant="outline"
              className="flex-1"
            >
              {isSending ? (
                <LoadingSpinner />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Test Digest
            </Button>
            
            <Button 
              onClick={handleSendDigest}
              disabled={isSending || !digestStatus?.enabled}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isSending ? (
                <LoadingSpinner />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Now
            </Button>
          </div>

          {/* Settings Link */}
          <div className="text-center">
            <a 
              href="/digest-preferences"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
            >
              <Settings className="h-4 w-4" />
              Manage Digest Settings
            </a>
          </div>

          {/* Info Notice */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Daily Digest Information</p>
                <p>
                  Daily digests are sent automatically at your chosen time. 
                  You can send test digests anytime to preview the content. 
                  Manage your preferences in the settings page.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
