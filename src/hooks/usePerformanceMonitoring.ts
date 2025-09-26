// Performance Monitoring Hook
// This can be easily removed if the performance monitoring doesn't work

import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useUserData } from './useUserData';
import { PerformanceMetric, AIPerformanceMetrics, WebSocketMetrics, SystemMetrics } from '@/lib/monitoring/PerformanceMonitor';

export interface PerformanceOverview {
  aiMetrics: AIPerformanceMetrics;
  websocketMetrics: WebSocketMetrics;
  systemMetrics: SystemMetrics;
  totalMetrics: number;
  isEnabled: boolean;
}

export interface UsePerformanceMonitoringReturn {
  // State
  overview: PerformanceOverview | null;
  aiMetrics: AIPerformanceMetrics | null;
  websocketMetrics: WebSocketMetrics | null;
  systemMetrics: SystemMetrics | null;
  rawMetrics: PerformanceMetric[];
  isLoading: boolean;
  error: string | null;
  isEnabled: boolean;

  // Methods
  fetchOverview: (timeWindow?: number) => Promise<void>;
  fetchAIMetrics: (timeWindow?: number) => Promise<void>;
  fetchWebSocketMetrics: (timeWindow?: number) => Promise<void>;
  fetchSystemMetrics: () => Promise<void>;
  fetchRawMetrics: (timeWindow?: number) => Promise<void>;
  clearMetrics: () => Promise<void>;
  enableMonitoring: () => Promise<void>;
  disableMonitoring: () => Promise<void>;
  recordCustomMetric: (metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'userId' | 'householdId'>) => Promise<void>;

  // Auto-refresh
  startAutoRefresh: (interval?: number) => void;
  stopAutoRefresh: () => void;
}

export function usePerformanceMonitoring(): UsePerformanceMonitoringReturn {
  const { user } = useUser();
  const { userData } = useUserData();
  
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [aiMetrics, setAIMetrics] = useState<AIPerformanceMetrics | null>(null);
  const [websocketMetrics, setWebSocketMetrics] = useState<WebSocketMetrics | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [rawMetrics, setRawMetrics] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);

  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchOverview = useCallback(async (timeWindow: number = 3600000) => {
    if (!user?.id || !userData?.household?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/monitoring/performance?type=overview&timeWindow=${timeWindow}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch performance overview');
      }

      const result = await response.json();
      setOverview(result.data);
      setIsEnabled(result.data.isEnabled);

    } catch (err: any) {
      console.error('Failed to fetch performance overview:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const fetchAIMetrics = useCallback(async (timeWindow: number = 3600000) => {
    if (!user?.id || !userData?.household?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/monitoring/performance?type=ai&timeWindow=${timeWindow}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch AI metrics');
      }

      const result = await response.json();
      setAIMetrics(result.data);

    } catch (err: any) {
      console.error('Failed to fetch AI metrics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const fetchWebSocketMetrics = useCallback(async (timeWindow: number = 3600000) => {
    if (!user?.id || !userData?.household?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/monitoring/performance?type=websocket&timeWindow=${timeWindow}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch WebSocket metrics');
      }

      const result = await response.json();
      setWebSocketMetrics(result.data);

    } catch (err: any) {
      console.error('Failed to fetch WebSocket metrics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const fetchSystemMetrics = useCallback(async () => {
    if (!user?.id || !userData?.household?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/monitoring/performance?type=system', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch system metrics');
      }

      const result = await response.json();
      setSystemMetrics(result.data);

    } catch (err: any) {
      console.error('Failed to fetch system metrics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const fetchRawMetrics = useCallback(async (timeWindow: number = 3600000) => {
    if (!user?.id || !userData?.household?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/monitoring/performance?type=raw&timeWindow=${timeWindow}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch raw metrics');
      }

      const result = await response.json();
      setRawMetrics(result.data);

    } catch (err: any) {
      console.error('Failed to fetch raw metrics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const clearMetrics = useCallback(async () => {
    if (!user?.id || !userData?.household?.id) return;

    try {
      const response = await fetch('/api/monitoring/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'clear_metrics' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear metrics');
      }

      // Refresh all data after clearing
      await fetchOverview();

    } catch (err: any) {
      console.error('Failed to clear metrics:', err);
      setError(err.message);
    }
  }, [user?.id, userData?.household?.id, fetchOverview]);

  const enableMonitoring = useCallback(async () => {
    if (!user?.id || !userData?.household?.id) return;

    try {
      const response = await fetch('/api/monitoring/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'enable_monitoring' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to enable monitoring');
      }

      setIsEnabled(true);
      await fetchOverview();

    } catch (err: any) {
      console.error('Failed to enable monitoring:', err);
      setError(err.message);
    }
  }, [user?.id, userData?.household?.id, fetchOverview]);

  const disableMonitoring = useCallback(async () => {
    if (!user?.id || !userData?.household?.id) return;

    try {
      const response = await fetch('/api/monitoring/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'disable_monitoring' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to disable monitoring');
      }

      setIsEnabled(false);

    } catch (err: any) {
      console.error('Failed to disable monitoring:', err);
      setError(err.message);
    }
  }, [user?.id, userData?.household?.id]);

  const recordCustomMetric = useCallback(async (metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'userId' | 'householdId'>) => {
    if (!user?.id || !userData?.household?.id) return;

    try {
      const response = await fetch('/api/monitoring/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'record_metric',
          metric 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to record metric');
      }

    } catch (err: any) {
      console.error('Failed to record custom metric:', err);
      setError(err.message);
    }
  }, [user?.id, userData?.household?.id]);

  const startAutoRefresh = useCallback((interval: number = 30000) => {
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
    }

    autoRefreshInterval.current = setInterval(() => {
      if (isEnabled) {
        fetchOverview();
      }
    }, interval);
  }, [isEnabled, fetchOverview]);

  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
      autoRefreshInterval.current = null;
    }
  }, []);

  // Auto-fetch overview when user is available
  useEffect(() => {
    if (user?.id && userData?.household?.id) {
      fetchOverview();
    }
  }, [user?.id, userData?.household?.id, fetchOverview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoRefresh();
    };
  }, [stopAutoRefresh]);

  return {
    overview,
    aiMetrics,
    websocketMetrics,
    systemMetrics,
    rawMetrics,
    isLoading,
    error,
    isEnabled,
    fetchOverview,
    fetchAIMetrics,
    fetchWebSocketMetrics,
    fetchSystemMetrics,
    fetchRawMetrics,
    clearMetrics,
    enableMonitoring,
    disableMonitoring,
    recordCustomMetric,
    startAutoRefresh,
    stopAutoRefresh
  };
}
