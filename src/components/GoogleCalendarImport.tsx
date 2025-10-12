'use client';

import { useState, useCallback, useEffect } from 'react';
import { canAccessFeature, type Entitlements } from '@/lib/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Calendar,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Info,
} from 'lucide-react';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';

interface GoogleCalendarImportProps {
  householdId: string;
  entitlements: Entitlements | null;
}

interface CalendarInfo {
  id: string;
  summary: string;
  accessRole: string;
  selected: boolean;
}

interface ImportStats {
  imported_events: number;
  calendars_imported: number;
}

interface ImportStatus {
  connected: boolean;
  status: string;
  is_token_expired: boolean;
  last_import_at: string | null;
  last_successful_import_at: string | null;
  calendars: CalendarInfo[];
  recent_imports: {
    last_7_days: number;
    last_import: string | null;
  };
  needs_reauth: boolean;
}

type ImportStatusResponse =
  | ({ success: true; error?: undefined } & ImportStatus)
  | { success: false; error?: string };

interface AuthResponse {
  success: boolean;
  auth_url?: string;
  error?: string;
}

interface ImportResponse {
  success: boolean;
  error?: string;
  stats?: ImportStats;
}

export default function GoogleCalendarImport({ householdId, entitlements }: GoogleCalendarImportProps) {
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);

  const canAccessGoogleImport = canAccessFeature(entitlements, 'google_import');

  const loadImportStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/google-calendar/status?household_id=${householdId}`);
      const data: ImportStatusResponse = await response.json();
      
      if (data.success) {
        setImportStatus(data);
        if (data.calendars) {
          setSelectedCalendars(data.calendars.filter((cal) => cal.selected).map((cal) => cal.id));
        }
      } else {
        setError(data.error || 'Failed to load import status');
      }
    } catch (err) {
      console.error('Error loading import status:', err);
      setError('Failed to load import status');
    } finally {
      setIsLoading(false);
    }
  }, [householdId]);

  const handleConnectGoogle = useCallback(async () => {
    try {
      const response = await fetch('/api/google-calendar/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ household_id: householdId }),
      });

      const data: AuthResponse = await response.json();
      
      if (data.success) {
        // Redirect to Google OAuth
        if (data.auth_url) {
          window.location.href = data.auth_url;
        } else {
          toast.error('Missing redirect URL for Google authentication.');
        }
      } else {
        if (data.error?.includes('Missing Google OAuth2 configuration')) {
          toast.error('Google Calendar integration is not configured. Please check the setup guide or contact support.');
        } else {
          toast.error(data.error || 'Failed to initiate Google Calendar connection');
        }
      }
    } catch (err) {
      console.error('Error connecting to Google Calendar:', err);
      toast.error('Failed to connect to Google Calendar');
    }
  }, [householdId]);

  const handleImportEvents = useCallback(async () => {
    if (selectedCalendars.length === 0) {
      toast.error('Please select at least one calendar to import from');
      return;
    }

    try {
      setIsImporting(true);
      setError(null);

      const response = await fetch('/api/google-calendar/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          household_id: householdId,
          calendar_ids: selectedCalendars,
          max_results: 100,
        }),
      });

      const data: ImportResponse = await response.json();
      
      if (data.success) {
        if (data.stats) {
          toast.success(`Successfully imported ${data.stats.imported_events} events from ${data.stats.calendars_imported} calendars`);
        } else {
          toast.success('Events imported successfully');
        }
        void loadImportStatus();
      } else {
        toast.error(data.error || 'Failed to import events');
      }
    } catch (err) {
      console.error('Error importing events:', err);
      toast.error('Failed to import events');
    } finally {
      setIsImporting(false);
    }
  }, [householdId, loadImportStatus, selectedCalendars]);

  const toggleCalendarSelection = useCallback((calendarId: string) => {
    setSelectedCalendars((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  }, []);

  useEffect(() => {
    if (canAccessGoogleImport) {
      void loadImportStatus();
    } else {
      setIsLoading(false);
    }
  }, [canAccessGoogleImport, loadImportStatus]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (!canAccessGoogleImport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar Import
          </CardTitle>
          <CardDescription>
            Import events from your Google Calendar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upgrade to Pro to unlock Google Calendar Import
            </h3>
            <p className="text-gray-600 mb-4">
              Sync your Google Calendar events with your household calendar.
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
            <Calendar className="h-5 w-5" />
            Google Calendar Import
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
            <Calendar className="h-5 w-5" />
            Google Calendar Import
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
            <Calendar className="h-5 w-5" />
            Google Calendar Import
          </CardTitle>
          <CardDescription>
            Import events from your Google Calendar to your household calendar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!importStatus?.connected ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Connect Google Calendar
              </h3>
              <p className="text-gray-600 mb-4">
                Connect your Google Calendar to import events into your household calendar.
              </p>
              <Button 
                onClick={handleConnectGoogle}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect Google Calendar
              </Button>
            </div>
          ) : (
            <>
              {/* Connection Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">G</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Google Calendar Connected</span>
                      {importStatus.is_token_expired ? (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Token Expired
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Last import: {formatDate(importStatus.last_successful_import_at)}
                    </p>
                  </div>
                </div>
                {importStatus.needs_reauth && (
                  <Button 
                    onClick={handleConnectGoogle}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reconnect
                  </Button>
                )}
              </div>

              {/* Calendar Selection */}
              {importStatus.calendars.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Select Calendars to Import</h4>
                  <div className="grid gap-3">
                    {importStatus.calendars.map((calendar) => (
                      <div key={calendar.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`calendar-${calendar.id}`}
                            checked={selectedCalendars.includes(calendar.id)}
                            onCheckedChange={() => toggleCalendarSelection(calendar.id)}
                          />
                          <Label htmlFor={`calendar-${calendar.id}`} className="font-medium">
                            {calendar.summary}
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            {calendar.accessRole}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Actions */}
              <div className="flex gap-4">
                <Button 
                  onClick={handleImportEvents}
                  disabled={isImporting || selectedCalendars.length === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isImporting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isImporting ? 'Importing...' : 'Import Events'}
                </Button>
                
                <Button 
                  onClick={loadImportStatus}
                  variant="outline"
                  disabled={isImporting}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              </div>

              {/* Recent Import Stats */}
              {importStatus.recent_imports.last_7_days > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className="font-medium text-gray-900">Recent Activity</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {importStatus.recent_imports.last_7_days} events imported in the last 7 days
                  </p>
                </div>
              )}

              {/* Info Notice */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Import Information</p>
                    <p>
                      Events are imported as read-only. Changes made in your household calendar 
                      will not sync back to Google Calendar. Only future events are imported by default.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
