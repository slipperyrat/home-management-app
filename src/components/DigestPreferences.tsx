'use client';

import { useState } from 'react';
import { useDigestPreferences, useUpdateDigestPreferences, useSendTestDigest, formatDigestTime, getNextDigestTime, DEFAULT_DIGEST_PREFERENCES } from '@/hooks/useDigestPreferences';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Mail, 
  Bell, 
  Calendar,
  Settings,
  Send,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface DigestPreferencesProps {
  className?: string;
}

export function DigestPreferences({ className = '' }: DigestPreferencesProps) {
  const { data: preferences, isLoading, error } = useDigestPreferences();
  const updatePreferences = useUpdateDigestPreferences();
  const sendTestDigest = useSendTestDigest();
  
  const [localPreferences, setLocalPreferences] = useState<any>(null);

  // Use local state or server data
  const currentPreferences = localPreferences || preferences || DEFAULT_DIGEST_PREFERENCES;

  const handlePreferenceChange = (key: string, value: any) => {
    const newPreferences = { ...currentPreferences, [key]: value };
    setLocalPreferences(newPreferences);
  };

  const handleSave = () => {
    if (!localPreferences) return;
    
    updatePreferences.mutate(localPreferences, {
      onSuccess: () => {
        setLocalPreferences(null);
      }
    });
  };

  const handleTestDigest = (type: 'daily' | 'weekly') => {
    sendTestDigest.mutate(type);
  };

  const hasUnsavedChanges = localPreferences !== null;
  const nextDigest = preferences ? getNextDigestTime(preferences) : null;

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Digest Preferences</h2>
          <p className="text-gray-600">
            Customize when and how you receive your daily and weekly summaries
          </p>
        </div>
        {hasUnsavedChanges && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              Unsaved Changes
            </Badge>
            <Button onClick={handleSave} disabled={updatePreferences.isPending}>
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Next Digest Info */}
      {nextDigest && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-gray-900">
                    Next {nextDigest.type} digest
                  </p>
                  <p className="text-sm text-gray-600">
                    {nextDigest.time.toLocaleDateString()} at {formatDigestTime(nextDigest.time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }))}
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Digest Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Daily Digest
            </CardTitle>
            <CardDescription>
              Receive a summary of your day's tasks and activities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="daily-enabled">Enable daily digest</Label>
              <Switch
                id="daily-enabled"
                checked={currentPreferences.daily_digest_enabled || false}
                onCheckedChange={(checked) => handlePreferenceChange('daily_digest_enabled', checked)}
              />
            </div>

            {currentPreferences.daily_digest_enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="daily-time">Send at</Label>
                  <Input
                    id="daily-time"
                    type="time"
                    value={currentPreferences.daily_digest_time || '08:00'}
                    onChange={(e) => handlePreferenceChange('daily_digest_time', e.target.value)}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Include in daily digest:</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="daily-chores">Chores</Label>
                      <Switch
                        id="daily-chores"
                        checked={currentPreferences.include_chores || false}
                        onCheckedChange={(checked) => handlePreferenceChange('include_chores', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="daily-meals">Meals</Label>
                      <Switch
                        id="daily-meals"
                        checked={currentPreferences.include_meals || false}
                        onCheckedChange={(checked) => handlePreferenceChange('include_meals', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="daily-shopping">Shopping</Label>
                      <Switch
                        id="daily-shopping"
                        checked={currentPreferences.include_shopping || false}
                        onCheckedChange={(checked) => handlePreferenceChange('include_shopping', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="daily-events">Events</Label>
                      <Switch
                        id="daily-events"
                        checked={currentPreferences.include_events || false}
                        onCheckedChange={(checked) => handlePreferenceChange('include_events', checked)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Weekly Digest Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Weekly Digest
            </CardTitle>
            <CardDescription>
              Get a comprehensive weekly summary and insights
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="weekly-enabled">Enable weekly digest</Label>
              <Switch
                id="weekly-enabled"
                checked={currentPreferences.weekly_digest_enabled || false}
                onCheckedChange={(checked) => handlePreferenceChange('weekly_digest_enabled', checked)}
              />
            </div>

            {currentPreferences.weekly_digest_enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="weekly-day">Day of week</Label>
                  <Select
                    value={currentPreferences.weekly_digest_day || 'sunday'}
                    onValueChange={(value) => handlePreferenceChange('weekly_digest_day', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="tuesday">Tuesday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                      <SelectItem value="friday">Friday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekly-time">Send at</Label>
                  <Input
                    id="weekly-time"
                    type="time"
                    value={currentPreferences.weekly_digest_time || '09:00'}
                    onChange={(e) => handlePreferenceChange('weekly_digest_time', e.target.value)}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Include in weekly digest:</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="weekly-chores">Chores</Label>
                      <Switch
                        id="weekly-chores"
                        checked={currentPreferences.include_chores || false}
                        onCheckedChange={(checked) => handlePreferenceChange('include_chores', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="weekly-meals">Meals</Label>
                      <Switch
                        id="weekly-meals"
                        checked={currentPreferences.include_meals || false}
                        onCheckedChange={(checked) => handlePreferenceChange('include_meals', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="weekly-shopping">Shopping</Label>
                      <Switch
                        id="weekly-shopping"
                        checked={currentPreferences.include_shopping || false}
                        onCheckedChange={(checked) => handlePreferenceChange('include_shopping', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="weekly-events">Events</Label>
                      <Switch
                        id="weekly-events"
                        checked={currentPreferences.include_events || false}
                        onCheckedChange={(checked) => handlePreferenceChange('include_events', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="weekly-achievements">Achievements</Label>
                      <Switch
                        id="weekly-achievements"
                        checked={currentPreferences.include_achievements || false}
                        onCheckedChange={(checked) => handlePreferenceChange('include_achievements', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="weekly-insights">AI Insights</Label>
                      <Switch
                        id="weekly-insights"
                        checked={currentPreferences.include_insights || false}
                        onCheckedChange={(checked) => handlePreferenceChange('include_insights', checked)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Delivery Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-green-500" />
              Delivery Methods
            </CardTitle>
            <CardDescription>
              Choose how you want to receive your digests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-enabled">Email</Label>
              <Switch
                id="email-enabled"
                checked={currentPreferences.email_enabled || false}
                onCheckedChange={(checked) => handlePreferenceChange('email_enabled', checked)}
              />
            </div>

            {currentPreferences.email_enabled && (
              <div className="space-y-2">
                <Label htmlFor="email-address">Email address</Label>
                <Input
                  id="email-address"
                  type="email"
                  value={currentPreferences.email_address || ''}
                  onChange={(e) => handlePreferenceChange('email_address', e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <Label htmlFor="push-enabled">Push notifications</Label>
              <Switch
                id="push-enabled"
                checked={currentPreferences.push_enabled || false}
                onCheckedChange={(checked) => handlePreferenceChange('push_enabled', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-500" />
              Advanced Settings
            </CardTitle>
            <CardDescription>
              Fine-tune what appears in your digests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="priority-filter">Priority filter</Label>
              <Select
                value={currentPreferences.priority_filter || 'all'}
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
                value={currentPreferences.completion_status || 'all'}
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
    </div>
  );
}
