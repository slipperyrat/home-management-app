'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';

interface PerformanceMetric {
  metric: string;
  value: number;
  description: string;
}

interface TableStats {
  schemaname: string;
  tablename: string;
  seq_scan: number;
  idx_scan: number;
  n_live_tup: number;
  n_dead_tup: number;
}

interface IndexStats {
  schemaname: string;
  tablename: string;
  indexname: string;
  idx_scan: number;
  idx_tup_read: number;
}

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [indexStats, setIndexStats] = useState<IndexStats[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPerformanceData();
    const interval = setInterval(fetchPerformanceData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      
      // Fetch performance metrics
      const metricsResponse = await fetch('/api/performance/metrics');
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData);
      }

      // Fetch table statistics
      const tableResponse = await fetch('/api/performance/tables');
      if (tableResponse.ok) {
        const tableData = await tableResponse.json();
        setTableStats(tableData);
      }

      // Fetch index statistics
      const indexResponse = await fetch('/api/performance/indexes');
      if (indexResponse.ok) {
        const indexData = await indexResponse.json();
        setIndexStats(indexData);
      }

      // Fetch performance recommendations
      const recResponse = await fetch('/api/performance/recommendations');
      if (recResponse.ok) {
        const recData = await recResponse.json();
        setRecommendations(recData.map((r: any) => r.recommendation));
      }
    } catch (err) {
      setError('Failed to fetch performance data');
      console.error('Performance data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (value: number, threshold: number) => {
    if (value < threshold * 0.7) return 'text-green-600';
    if (value < threshold) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTableEfficiency = (seqScan: number, idxScan: number) => {
    const total = seqScan + idxScan;
    if (total === 0) return 100;
    return Math.round((idxScan / total) * 100);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor database performance, query efficiency, and system health
          </p>
        </div>
        <Button onClick={fetchPerformanceData} variant="outline">
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.metric}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium capitalize">
                {metric.metric.replace('_', ' ')}
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPerformanceColor(metric.value, 100)}`}>
                {metric.value.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Table Performance</CardTitle>
          <CardDescription>
            Monitor table access patterns and efficiency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tableStats.map((table) => (
              <div
                key={`${table.schemaname}.${table.tablename}`}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {/* Database icon removed as per edit hint */}
                  <div>
                    <div className="font-medium">{table.tablename}</div>
                    <div className="text-sm text-muted-foreground">
                      {table.n_live_tup.toLocaleString()} rows
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">Index Usage</div>
                    <div className={`text-sm ${getPerformanceColor(getTableEfficiency(table.seq_scan, table.idx_scan), 80)}`}>
                      {getTableEfficiency(table.seq_scan, table.idx_scan)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">Sequential Scans</div>
                    <div className="text-sm text-muted-foreground">
                      {table.seq_scan.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">Index Scans</div>
                    <div className="text-sm text-muted-foreground">
                      {table.idx_scan.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Index Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Index Usage</CardTitle>
          <CardDescription>
            Monitor index efficiency and usage patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {indexStats.slice(0, 10).map((index) => (
              <div
                key={`${index.schemaname}.${index.tablename}.${index.indexname}`}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <Zap className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{index.indexname}</div>
                    <div className="text-sm text-muted-foreground">
                      {index.tablename}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">Scans</div>
                    <div className="text-sm text-muted-foreground">
                      {index.idx_scan.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">Rows Read</div>
                    <div className="text-sm text-muted-foreground">
                      {index.idx_tup_read.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Recommendations</CardTitle>
          <CardDescription>
            Actionable suggestions to improve performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No performance issues detected</p>
              <p className="text-sm">Your database is performing well</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">{recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
