'use client';

import { useState, useEffect } from 'react';
import { canAccessFeature } from '@/lib/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BellOff,
  AlertCircle,
  Settings,
  Moon,
  Sun,
} from 'lucide-react';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';

interface QuietHoursProps {
  householdId: string;
  entitlements: any;
}

interface QuietHoursSettings {
  enabled: boolean;
  start_time: string;
  end_time: string;
  days_of_week: number[];
}

interface QuietHoursStatus {
  is_quiet_hours: boolean;
  settings: any;
  next_change: string | null;
  formatted: {
    next_change: string | null;
    days_of_week: string | null;
    time_range: string | null;
  };
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export default function QuietHours({ householdId, entitlements }: QuietHoursProps) {
  const [settings, setSettings] = useState<QuietHoursSettings>({
    enabled: false,
    start_time: '22:00',
    end_time: '07:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6]
  });
  const [status, setStatus] = useState<QuietHoursStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user can access quiet hours (Pro feature)
  const canAccessQuietHours = canAccessFeature(entitlements, 'quiet_hours');

  useEffect(() => {
    if (canAccessQuietHours) {
      loadQuietHours();
    } else {
      setIsLoading(false);
    }
  }, [canAccessQuietHours, householdId]);

  const loadQuietHours = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/quiet-hours?household_id=${householdId}`);
      const data = await response.json();
      
      if (data.success) {
        if (data.data.settings) {
          setSettings({
            enabled: data.data.settings.enabled,
            start_time: data.data.settings.start_time,
            end_time: data.data.settings.end_time,
            days_of_week: data.data.settings.days_of_week
          });
        }
        setStatus(data.data.status);
      } else {
        throw new Error(data.error || 'Failed to load quiet hours');
      }
    } catch (err) {
      console.error('Error loading quiet hours:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quiet hours');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Retry mechanism for authentication issues
      let response;
      let data;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        response = await fetch('/api/quiet-hours', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            household_id: householdId,
            ...settings
          }),
        });

        data = await response.json();
        
        if (response?.ok && data?.success) {
          toast.success('Quiet hours settings saved successfully!');
          setStatus(data.status);
          return; // Success, exit the retry loop
        } else if (response?.status === 401 && retryCount < maxRetries) {
          // Authentication failed, wait a bit and retry
          console.log(`Authentication failed, retrying... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          retryCount++;
        } else {
          // Other error or max retries reached
          break;
        }
      }
      
      // Handle final result
      if (response?.status === 401) {
        toast.error('Authentication failed. Please refresh the page and try again.');
        console.error('Authentication error after retries:', data);
      } else {
        toast.error(data?.error || 'Failed to save quiet hours settings');
        console.error('Save error:', data);
      }
    } catch (err) {
      console.error('Error saving quiet hours:', err);
      toast.error('Failed to save quiet hours settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDayToggle = (dayValue: number) => {
    setSettings(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dayValue)
        ? prev.days_of_week.filter(d => d !== dayValue)
        : [...prev.days_of_week, dayValue]
    }));
  };

  const formatTime = (time: string) => {
    try {
      const [hoursRaw, minutesRaw] = (time ?? '').split(':');
      const hour = Number.parseInt(hoursRaw ?? '0', 10);
      const minutes = minutesRaw ?? '00';
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  if (!canAccessQuietHours) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Manage notification quiet hours for your household
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BellOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upgrade to Pro to unlock Quiet Hours
            </h3>
            <p className="text-gray-600 mb-4">
              Set quiet hours to automatically silence notifications during specific times.
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
            <BellOff className="h-5 w-5" />
            Quiet Hours
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
            <BellOff className="h-5 w-5" />
            Quiet Hours
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
            <BellOff className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Automatically silence notifications during specific times
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Status */}
          {status && (
            <div className="p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {status.is_quiet_hours ? (
                    <Moon className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Sun className="h-5 w-5 text-yellow-600" />
                  )}
                  <span className="font-medium">
                    {status.is_quiet_hours ? 'Quiet Hours Active' : 'Quiet Hours Inactive'}
                  </span>
                </div>
                <Badge variant={status.is_quiet_hours ? "default" : "secondary"}>
                  {status.is_quiet_hours ? 'Silent' : 'Active'}
                </Badge>
              </div>
              {status.formatted.time_range && (
                <p className="text-sm text-gray-600">
                  {status.formatted.time_range} • {status.formatted.days_of_week}
                </p>
              )}
              {status.next_change && (
                <p className="text-sm text-gray-500 mt-1">
                  Next change: {status.formatted.next_change}
                </p>
              )}
            </div>
          )}

          {/* Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="quiet-hours-enabled" className="text-base font-medium">
                  Enable Quiet Hours
                </Label>
                <p className="text-sm text-gray-600">
                  Automatically silence notifications during specified times
                </p>
              </div>
              <Switch
                id="quiet-hours-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
              />
            </div>

            {settings.enabled && (
              <>
                {/* Time Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">Start Time</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={settings.start_time}
                      onChange={(e) => setSettings(prev => ({ ...prev, start_time: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">End Time</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={settings.end_time}
                      onChange={(e) => setSettings(prev => ({ ...prev, end_time: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Days of Week */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Days of Week</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={settings.days_of_week.includes(day.value)}
                          onCheckedChange={() => handleDayToggle(day.value)}
                        />
                        <Label 
                          htmlFor={`day-${day.value}`} 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {day.short}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Preview</h4>
                  <p className="text-sm text-blue-800">
                    Quiet hours will be active from <strong>{formatTime(settings.start_time)}</strong> to{' '}
                    <strong>{formatTime(settings.end_time)}</strong> on{' '}
                    <strong>
                      {settings.days_of_week.length === 7
                        ? 'all days'
                        : settings.days_of_week
                            .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.short ?? String(d))
                            .join(', ')}
                    </strong>
                  </p>
                </div>
              </>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button 
                onClick={handleSave}
                disabled={isSaving || !settings.enabled || settings.days_of_week.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? (
                  <LoadingSpinner />
                ) : (
                  <Settings className="h-4 w-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          </div>

          {/* Info Notice */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">How Quiet Hours Work</p>
                <p>
                  When quiet hours are active, notifications will be automatically silenced. 
                  This applies to push notifications, email alerts, and other household notifications.
                  You can still access the app normally during quiet hours.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
