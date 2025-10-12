'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  useDigestPreferences,
  useUpdateDigestPreferences,
  useSendTestDigest,
  formatDigestTime,
  getNextDigestTime,
  DEFAULT_DIGEST_PREFERENCES,
} from '@/hooks/useDigestPreferences';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Clock, Mail, Calendar, Settings, Send, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logging/logger';

interface DigestPreferencesProps {
  className?: string;
}

interface DigestPreferencesForm {
  daily_digest_enabled: boolean;
  daily_digest_time: string;
  weekly_digest_enabled?: boolean;
  weekly_digest_day?: string;
  weekly_digest_time?: string;
  include_chores?: boolean;
  include_meals?: boolean;
  include_shopping?: boolean;
  include_events?: boolean;
  include_achievements?: boolean;
  include_insights?: boolean;
  email_enabled?: boolean;
  email_address?: string;
  push_enabled?: boolean;
  priority_filter?: string;
  completion_status?: string;
}

type DigestType = 'daily' | 'weekly';

const LOADING_SKELETON_KEYS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6'];

export function DigestPreferences({ className = '' }: DigestPreferencesProps) {
  const { data: preferences, isLoading, error } = useDigestPreferences();
  const updatePreferences = useUpdateDigestPreferences();
  const sendTestDigest = useSendTestDigest();

  const [localPreferences, setLocalPreferences] = useState<DigestPreferencesForm | null>(null);

  const currentPreferences = useMemo(() => {
    if (localPreferences) return localPreferences;
    return (preferences as DigestPreferencesForm | undefined) ?? DEFAULT_DIGEST_PREFERENCES;
  }, [localPreferences, preferences]);

  const nextDigest = useMemo(() => (preferences ? getNextDigestTime(preferences) : null), [preferences]);
  const hasUnsavedChanges = localPreferences !== null;

  const handlePreferenceChange = useCallback((key: keyof DigestPreferencesForm, value: unknown) => {
    setLocalPreferences((prev) => ({
      ...(prev ?? (preferences as DigestPreferencesForm | undefined) ?? DEFAULT_DIGEST_PREFERENCES),
      [key]: value,
    }));
  }, [preferences]);

  const handleSave = useCallback(() => {
    if (!localPreferences) return;

    updatePreferences.mutate(localPreferences, {
      onSuccess: () => {
        setLocalPreferences(null);
      },
      onError: (mutationError) => {
        logger.error('Error updating digest preferences', mutationError as Error);
      },
    });
  }, [localPreferences, updatePreferences]);

  const handleTestDigest = useCallback(
    (type: DigestType) => {
      sendTestDigest.mutate(type);
    },
    [sendTestDigest],
  );

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="space-y-4">
            {LOADING_SKELETON_KEYS.map((key) => (
              <div key={key} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load preferences</h3>
          <p className="text-gray-600">There was an error loading your digest preferences.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Digest Preferences</h2>
          <p className="text-gray-600">Customize when and how you receive your daily and weekly summaries</p>
        </div>
        {hasUnsavedChanges ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              Unsaved Changes
            </Badge>
            <Button onClick={handleSave} disabled={updatePreferences.isPending}>
              Save Changes
            </Button>
          </div>
        ) : null}
      </div>

      {nextDigest ? (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-gray-900">Next {nextDigest.type} digest</p>
                  <p className="text-sm text-gray-600">
                    {nextDigest.time.toLocaleDateString()} at{' '}
                    {formatDigestTime(
                      nextDigest.time.toLocaleTimeString('en-US', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestDigest(nextDigest.type)}
                disabled={sendTestDigest.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Test {nextDigest.type}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Daily Digest
            </CardTitle>
            <CardDescription>Receive a summary of your day&apos;s tasks and activities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="daily-enabled">Enable daily digest</Label>
              <Switch
                id="daily-enabled"
                checked={currentPreferences.daily_digest_enabled ?? false}
                onCheckedChange={(checked) => handlePreferenceChange('daily_digest_enabled', checked)}
              />
            </div>

            {currentPreferences.daily_digest_enabled ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="daily-time">Send at</Label>
                  <Input
                    id="daily-time"
                    type="time"
                    value={currentPreferences.daily_digest_time ?? '08:00'}
                    onChange={(event) => handlePreferenceChange('daily_digest_time', event.target.value)}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Include in daily digest:</p>
                  <div className="space-y-2">
                    {(['chores', 'meals', 'shopping', 'events'] as const).map((section) => (
                      <div key={`daily-${section}`} className="flex items-center justify-between">
                        <Label htmlFor={`daily-${section}`}>{section.charAt(0).toUpperCase() + section.slice(1)}</Label>
                        <Switch
                          id={`daily-${section}`}
                          checked={currentPreferences[`include_${section}` as const] ?? false}
                          onCheckedChange={(checked) => handlePreferenceChange(`include_${section}` as const, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Weekly Digest
            </CardTitle>
            <CardDescription>Get a comprehensive weekly summary and insights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="weekly-enabled">Enable weekly digest</Label>
              <Switch
                id="weekly-enabled"
                checked={currentPreferences.weekly_digest_enabled ?? false}
                onCheckedChange={(checked) => handlePreferenceChange('weekly_digest_enabled', checked)}
              />
            </div>

            {currentPreferences.weekly_digest_enabled ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="weekly-day">Day of week</Label>
                  <Select
                    value={currentPreferences.weekly_digest_day ?? 'sunday'}
                    onValueChange={(value) => handlePreferenceChange('weekly_digest_day', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                        <SelectItem key={`weekly-day-${day}`} value={day}>
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekly-time">Send at</Label>
                  <Input
                    id="weekly-time"
                    type="time"
                    value={currentPreferences.weekly_digest_time ?? '09:00'}
                    onChange={(event) => handlePreferenceChange('weekly_digest_time', event.target.value)}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Include in weekly digest:</p>
                  <div className="space-y-2">
                    {['chores', 'meals', 'shopping', 'events', 'achievements', 'insights'].map((section) => (
                      <div key={`weekly-${section}`} className="flex items-center justify-between">
                        <Label htmlFor={`weekly-${section}`}>{section.charAt(0).toUpperCase() + section.slice(1)}</Label>
                        <Switch
                          id={`weekly-${section}`}
                          checked={currentPreferences[`include_${section}` as const] ?? false}
                          onCheckedChange={(checked) => handlePreferenceChange(`include_${section}` as const, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-green-500" />
              Delivery Methods
            </CardTitle>
            <CardDescription>Choose how you want to receive your digests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-enabled">Email</Label>
              <Switch
                id="email-enabled"
                checked={currentPreferences.email_enabled ?? false}
                onCheckedChange={(checked) => handlePreferenceChange('email_enabled', checked)}
              />
            </div>

            {currentPreferences.email_enabled ? (
              <div className="space-y-2">
                <Label htmlFor="email-address">Email address</Label>
                <Input
                  id="email-address"
                  type="email"
                  value={currentPreferences.email_address ?? ''}
                  onChange={(event) => handlePreferenceChange('email_address', event.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            ) : null}

            <Separator />

            <div className="flex items-center justify-between">
              <Label htmlFor="push-enabled">Push notifications</Label>
              <Switch
                id="push-enabled"
                checked={currentPreferences.push_enabled ?? false}
                onCheckedChange={(checked) => handlePreferenceChange('push_enabled', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-500" />
              Advanced Settings
            </CardTitle>
            <CardDescription>Fine-tune what appears in your digests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="priority-filter">Priority filter</Label>
              <Select
                value={currentPreferences.priority_filter ?? 'all'}
                onValueChange={(value) => handlePreferenceChange('priority_filter', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="medium_high">Medium & High priority</SelectItem>
                  <SelectItem value="high">High priority only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="completion-status">Completion status</Label>
              <Select
                value={currentPreferences.completion_status ?? 'all'}
                onValueChange={(value) => handlePreferenceChange('completion_status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  <SelectItem value="pending">Pending items only</SelectItem>
                  <SelectItem value="overdue">Overdue items only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Need more control?&nbsp;
          <Link href="/help/digests" className="text-blue-600 hover:text-blue-700">
            Learn about digest customization
          </Link>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!hasUnsavedChanges || updatePreferences.isPending}
            onClick={() => setLocalPreferences(null)}
          >
            Discard Changes
          </Button>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges || updatePreferences.isPending}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
