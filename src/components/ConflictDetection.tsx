'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Users,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { useUserData } from '@/hooks/useUserData';
import { canAccessFeature, Entitlements } from '@/lib/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { logger } from '@/lib/logging/logger';

interface ConflictDetectionProps {
  householdId: string;
  entitlements: Entitlements;
}

interface ConflictEventSummary {
  title: string;
  start_at: string;
  end_at: string;
}

interface Conflict {
  id: string;
  household_id: string;
  event1_id: string;
  event2_id: string;
  conflict_type: 'time_overlap' | 'same_title' | 'same_time';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected_at: string;
  resolved_at?: string;
  resolution_notes?: string;
  event1?: ConflictEventSummary;
  event2?: ConflictEventSummary;
}

interface ConflictStats {
  totalConflicts: number;
  unresolvedConflicts: number;
  resolvedConflicts: number;
  conflictsByType: Record<string, number>;
  conflictsBySeverity: Record<string, number>;
}

interface ConflictsApiResponse {
  success: boolean;
  data?: {
    conflicts: Conflict[];
    stats: ConflictStats;
  };
  error?: string;
}

interface ResolveConflictResponse {
  success: boolean;
  error?: string;
}

const buildConflictKey = (conflictId: string, suffix: string) => `${conflictId}-${suffix}`;

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getConflictTypeIcon = (type: string) => {
  switch (type) {
    case 'time_overlap':
      return <Clock className="h-4 w-4" />;
    case 'same_title':
      return <Users className="h-4 w-4" />;
    case 'same_time':
      return <Calendar className="h-4 w-4" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
};

const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

export default function ConflictDetection({ householdId, entitlements }: ConflictDetectionProps) {
  useUserData();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [stats, setStats] = useState<ConflictStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  const canAccessConflictDetection = useMemo(
    () => canAccessFeature(entitlements, 'conflict_detection'),
    [entitlements],
  );

  const loadConflicts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/conflicts?household_id=${householdId}`);
      const data = (await response.json()) as ConflictsApiResponse;

      if (data.success && data.data) {
        setConflicts(data.data.conflicts);
        setStats(data.data.stats);
      } else {
        throw new Error(data.error || 'Failed to load conflicts');
      }
    } catch (err) {
      logger.error('Error loading conflicts', err as Error, { householdId });
      setError(err instanceof Error ? err.message : 'Failed to load conflicts');
    } finally {
      setIsLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (canAccessConflictDetection) {
      void loadConflicts();
    } else {
      setIsLoading(false);
    }
  }, [canAccessConflictDetection, loadConflicts]);

  const handleResolveConflict = useCallback(
    async (conflictId: string) => {
      try {
        setIsResolving(conflictId);
        setError(null);

        const response = await fetch(`/api/conflicts/${conflictId}/resolve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resolution_notes: resolutionNotes[conflictId] || undefined,
          }),
        });

        const data = (await response.json()) as ResolveConflictResponse;

        if (data.success) {
          toast.success('Conflict resolved successfully!');
          await loadConflicts();
          setResolutionNotes((previous) => ({ ...previous, [conflictId]: '' }));
        } else {
          toast.error(data.error || 'Failed to resolve conflict');
        }
      } catch (err) {
        logger.error('Error resolving conflict', err as Error, { conflictId });
        toast.error('Failed to resolve conflict');
      } finally {
        setIsResolving(null);
      }
    },
    [loadConflicts, resolutionNotes],
  );

  const resolvedConflicts = useMemo(
    () => conflicts.filter((conflict) => Boolean(conflict.resolved_at)),
    [conflicts],
  );

  const unresolvedConflicts = useMemo(
    () => conflicts.filter((conflict) => !conflict.resolved_at),
    [conflicts],
  );

  if (!canAccessConflictDetection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Conflict Detection
          </CardTitle>
          <CardDescription>Automatically detect and manage calendar conflicts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upgrade to Pro to unlock Conflict Detection
            </h3>
            <p className="text-gray-600 mb-4">
              Automatically detect overlapping events, duplicate titles, and scheduling conflicts.
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
            <AlertTriangle className="h-5 w-5" />
            Conflict Detection
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
            <AlertTriangle className="h-5 w-5" />
            Conflict Detection
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
            <AlertTriangle className="h-5 w-5" />
            Conflict Detection
          </CardTitle>
          <CardDescription>Automatically detect and manage calendar conflicts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Total Conflicts</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalConflicts}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="font-medium">Unresolved</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{stats.unresolvedConflicts}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Resolved</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{stats.resolvedConflicts}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">Recent Activity</span>
                </div>
                <p className="text-sm text-gray-600">
                  Conflicts updated in real-time. Refresh the page to check the latest status.
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Conflicts</h3>
            <Button size="sm" variant="outline" onClick={() => loadConflicts()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {unresolvedConflicts.map((conflict) => (
              <Card key={buildConflictKey(conflict.id, 'unresolved')} className="border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    {getConflictTypeIcon(conflict.conflict_type)}
                    Unresolved Conflict
                  </CardTitle>
                  <CardDescription>{formatDate(conflict.detected_at)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge className={getSeverityColor(conflict.severity)}>{conflict.severity}</Badge>
                    <span className="text-sm text-gray-600 capitalize">{conflict.conflict_type.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm text-gray-700">{conflict.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {conflict.event1 ? (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">Event 1</h4>
                        <p className="text-sm text-gray-700">{conflict.event1.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(conflict.event1.start_at)} - {formatDate(conflict.event1.end_at)}
                        </p>
                      </div>
                    ) : null}
                    {conflict.event2 ? (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">Event 2</h4>
                        <p className="text-sm text-gray-700">{conflict.event2.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(conflict.event2.start_at)} - {formatDate(conflict.event2.end_at)}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`resolution-${conflict.id}`}>Resolution Notes</Label>
                    <Textarea
                      id={`resolution-${conflict.id}`}
                      placeholder="Add notes about how this conflict was resolved"
                      className="min-h-[100px]"
                      value={resolutionNotes[conflict.id] ?? ''}
                      onChange={(event) =>
                        setResolutionNotes((previous) => ({ ...previous, [conflict.id]: event.target.value }))
                      }
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleResolveConflict(conflict.id)}
                      disabled={isResolving === conflict.id}
                    >
                      {isResolving === conflict.id ? 'Resolving...' : 'Mark as Resolved'}
                    </Button>
                    <Button variant="outline" onClick={() => setResolutionNotes((previous) => ({ ...previous, [conflict.id]: '' }))}>
                      Clear Notes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {resolvedConflicts.map((conflict) => (
              <Card key={buildConflictKey(conflict.id, 'resolved')} className="border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Resolved Conflict
                  </CardTitle>
                  <CardDescription>{formatDate(conflict.resolved_at ?? conflict.detected_at)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge className={getSeverityColor(conflict.severity)}>{conflict.severity}</Badge>
                    <span className="text-sm text-gray-600 capitalize">{conflict.conflict_type.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm text-gray-700">{conflict.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {conflict.event1 ? (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">Event 1</h4>
                        <p className="text-sm text-gray-700">{conflict.event1.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(conflict.event1.start_at)} - {formatDate(conflict.event1.end_at)}
                        </p>
                      </div>
                    ) : null}
                    {conflict.event2 ? (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">Event 2</h4>
                        <p className="text-sm text-gray-700">{conflict.event2.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(conflict.event2.start_at)} - {formatDate(conflict.event2.end_at)}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {conflict.resolution_notes ? (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-700 mb-1">Resolution Notes</h4>
                      <p className="text-sm text-green-800">{conflict.resolution_notes}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
