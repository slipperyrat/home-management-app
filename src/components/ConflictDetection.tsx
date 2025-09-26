'use client';

import { useState, useEffect } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { canAccessFeature } from '@/lib/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Calendar,
  Users,
  BarChart3,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';

interface ConflictDetectionProps {
  householdId: string;
  entitlements: any;
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
  event1?: {
    title: string;
    start_at: string;
    end_at: string;
  };
  event2?: {
    title: string;
    start_at: string;
    end_at: string;
  };
}

interface ConflictStats {
  totalConflicts: number;
  unresolvedConflicts: number;
  resolvedConflicts: number;
  conflictsByType: Record<string, number>;
  conflictsBySeverity: Record<string, number>;
}

export default function ConflictDetection({ householdId, entitlements }: ConflictDetectionProps) {
  const { userData } = useUserData();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [stats, setStats] = useState<ConflictStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  // Check if user can access conflict detection (Pro feature)
  const canAccessConflictDetection = canAccessFeature(entitlements, 'conflict_detection');

  useEffect(() => {
    if (canAccessConflictDetection) {
      loadConflicts();
    } else {
      setIsLoading(false);
    }
  }, [canAccessConflictDetection, householdId]);

  const loadConflicts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/conflicts?household_id=${householdId}`);
      const data = await response.json();
      
      if (data.success) {
        setConflicts(data.data.conflicts);
        setStats(data.data.stats);
      } else {
        throw new Error(data.error || 'Failed to load conflicts');
      }
    } catch (err) {
      console.error('Error loading conflicts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conflicts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveConflict = async (conflictId: string) => {
    try {
      setIsResolving(conflictId);
      setError(null);

      const response = await fetch(`/api/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resolution_notes: resolutionNotes[conflictId] || undefined
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Conflict resolved successfully!');
        loadConflicts(); // Refresh conflicts
        setResolutionNotes(prev => ({ ...prev, [conflictId]: '' }));
      } else {
        toast.error(data.error || 'Failed to resolve conflict');
      }
    } catch (err) {
      console.error('Error resolving conflict:', err);
      toast.error('Failed to resolve conflict');
    } finally {
      setIsResolving(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConflictTypeIcon = (type: string) => {
    switch (type) {
      case 'time_overlap': return <Clock className="h-4 w-4" />;
      case 'same_title': return <Users className="h-4 w-4" />;
      case 'same_time': return <Calendar className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!canAccessConflictDetection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Conflict Detection
          </CardTitle>
          <CardDescription>
            Automatically detect and manage calendar conflicts
          </CardDescription>
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
          <CardDescription>
            Automatically detect and manage calendar conflicts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Statistics */}
          {stats && (
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
                  <span className="font-medium">Resolution Rate</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.totalConflicts > 0 
                    ? Math.round((stats.resolvedConflicts / stats.totalConflicts) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          )}

          {/* Conflicts List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Active Conflicts</h3>
              <Button 
                onClick={loadConflicts}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            {conflicts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Active Conflicts
                </h3>
                <p className="text-gray-600">
                  Your calendar is conflict-free! New conflicts will be detected automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getConflictTypeIcon(conflict.conflict_type)}
                        <span className="font-medium text-gray-900">
                          {conflict.conflict_type.replace('_', ' ').toUpperCase()}
                        </span>
                        <Badge className={getSeverityColor(conflict.severity)}>
                          {conflict.severity}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDate(conflict.detected_at)}
                      </span>
                    </div>

                    <p className="text-gray-700 mb-3">{conflict.description}</p>

                    {conflict.event1 && conflict.event2 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="p-3 bg-white border rounded">
                          <h4 className="font-medium text-gray-900 mb-1">Event 1</h4>
                          <p className="text-sm text-gray-600">{conflict.event1.title}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(conflict.event1.start_at)} - {formatDate(conflict.event1.end_at)}
                          </p>
                        </div>
                        <div className="p-3 bg-white border rounded">
                          <h4 className="font-medium text-gray-900 mb-1">Event 2</h4>
                          <p className="text-sm text-gray-600">{conflict.event2.title}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(conflict.event2.start_at)} - {formatDate(conflict.event2.end_at)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`notes-${conflict.id}`} className="text-sm font-medium">
                          Resolution Notes (Optional)
                        </Label>
                        <Textarea
                          id={`notes-${conflict.id}`}
                          value={resolutionNotes[conflict.id] || ''}
                          onChange={(e) => setResolutionNotes(prev => ({
                            ...prev,
                            [conflict.id]: e.target.value
                          }))}
                          placeholder="Add notes about how this conflict was resolved..."
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                      <Button
                        onClick={() => handleResolveConflict(conflict.id)}
                        disabled={isResolving === conflict.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isResolving === conflict.id ? (
                          <LoadingSpinner />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Resolve Conflict
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Notice */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How Conflict Detection Works</p>
                <p>
                  Conflicts are automatically detected when you create or update events. 
                  The system checks for time overlaps, duplicate titles, and exact time matches. 
                  You can resolve conflicts by adding notes and marking them as resolved.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
