'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Calendar,
  Link,
  Copy,
  RefreshCw,
  Shield,
  Globe,
  Clock,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@clerk/nextjs';

interface SyncSettings {
  household_id: string;
  household_name: string;
  public_sync_enabled: boolean;
  ics_token: string;
  token_expires_at: string;
  sync_urls: {
    public: string;
    private: string;
  };
  instructions: {
    google_calendar: string;
    apple_calendar: string;
    outlook: string;
    general: string;
  };
}

interface CalendarSyncManagerProps {
  householdId: string;
  className?: string;
}

export function CalendarSyncManager({ householdId, className }: CalendarSyncManagerProps) {
  const { getToken } = useAuth();
  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchSyncSettings();
  }, [householdId]);

  const fetchSyncSettings = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await fetch(`/api/calendars/${householdId}/sync`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setSyncSettings(data.sync_settings);
      } else {
        toast.error('Failed to load sync settings');
      }
    } catch (error) {
      console.error('❌ Error fetching sync settings:', error);
      toast.error('Failed to load sync settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublicSync = async (enabled: boolean) => {
    try {
      setUpdating(true);
      const token = await getToken();
      const response = await fetch(`/api/calendars/${householdId}/sync`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enable_public_sync: enabled })
      });

      const data = await response.json();
      
      if (data.success) {
        setSyncSettings(prev => prev ? { ...prev, public_sync_enabled: enabled } : null);
        toast.success(enabled ? 'Public sync enabled' : 'Public sync disabled');
      } else {
        toast.error(data.error || 'Failed to update sync settings');
      }
    } catch (error) {
      console.error('❌ Error updating sync settings:', error);
      toast.error('Failed to update sync settings');
    } finally {
      setUpdating(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!confirm('Are you sure you want to regenerate the sync token? This will invalidate existing calendar subscriptions.')) {
      return;
    }

    try {
      setRegenerating(true);
      const token = await getToken();
      const response = await fetch(`/api/calendars/${householdId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Sync token regenerated successfully');
        fetchSyncSettings(); // Refresh settings
      } else {
        toast.error(data.error || 'Failed to regenerate token');
      }
    } catch (error) {
      console.error('❌ Error regenerating token:', error);
      toast.error('Failed to regenerate token');
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(label);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const isTokenExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading sync settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!syncSettings) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600">Failed to load sync settings</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Sync Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Public Sync Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-blue-600" />
              <div>
                <Label htmlFor="public-sync" className="text-base font-medium">
                  Enable Public Calendar Sync
                </Label>
                <p className="text-sm text-gray-600">
                  Allow external calendar apps to subscribe to your household calendar
                </p>
              </div>
            </div>
            <Switch
              id="public-sync"
              checked={syncSettings.public_sync_enabled}
              onCheckedChange={handleTogglePublicSync}
              disabled={updating}
            />
          </div>

          {syncSettings.public_sync_enabled && (
            <>
              {/* Sync URL */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  <Label className="text-sm font-medium">Public Calendar URL</Label>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    value={syncSettings.sync_urls.public}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(syncSettings.sync_urls.public, 'Sync URL')}
                    className="shrink-0"
                  >
                    {copiedUrl === 'Sync URL' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Token Status */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Sync Token</span>
                  {isTokenExpired(syncSettings.token_expires_at) ? (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Expired
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Valid
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Expires: {format(new Date(syncSettings.token_expires_at), 'MMM dd, yyyy')}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerateToken}
                    disabled={regenerating}
                  >
                    {regenerating ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Regenerate
                  </Button>
                </div>
              </div>

              {/* Setup Instructions */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">How to Subscribe</h4>
                
                <div className="grid gap-4">
                  {/* Google Calendar */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">G</span>
                      </div>
                      <span className="font-medium">Google Calendar</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      1. Open Google Calendar<br/>
                      2. Click the "+" next to "Other calendars"<br/>
                      3. Choose "From URL"<br/>
                      4. Paste the sync URL above
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(syncSettings.sync_urls.public, 'Google Calendar URL')}
                    >
                      {copiedUrl === 'Google Calendar URL' ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      Copy URL
                    </Button>
                  </div>

                  {/* Apple Calendar */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
                        <span className="text-white text-xs">🍎</span>
                      </div>
                      <span className="font-medium">Apple Calendar</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      1. Open Calendar app<br/>
                      2. Go to File → New Calendar Subscription<br/>
                      3. Paste the sync URL above<br/>
                      4. Click Subscribe
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(syncSettings.sync_urls.public, 'Apple Calendar URL')}
                    >
                      {copiedUrl === 'Apple Calendar URL' ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      Copy URL
                    </Button>
                  </div>

                  {/* Outlook */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">O</span>
                      </div>
                      <span className="font-medium">Microsoft Outlook</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      1. Open Outlook<br/>
                      2. Go to File → Account Settings → Account Settings<br/>
                      3. Click "Internet Calendars" tab<br/>
                      4. Click "New" and paste the sync URL
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(syncSettings.sync_urls.public, 'Outlook URL')}
                    >
                      {copiedUrl === 'Outlook URL' ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      Copy URL
                    </Button>
                  </div>
                </div>
              </div>

              {/* Security Notice */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Security Notice</p>
                    <p>
                      Only events marked as "Public" will be included in the sync. 
                      Private events remain private and are not shared through this URL.
                      Keep your sync URL secure and regenerate it if compromised.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {!syncSettings.public_sync_enabled && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">Public calendar sync is disabled</p>
              <p className="text-sm text-gray-500">
                Enable public sync to generate a URL for subscribing to your calendar in external apps.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
