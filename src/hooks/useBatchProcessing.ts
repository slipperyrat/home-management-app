// Batch Processing Hook
// This can be easily removed if the batch processing doesn't work

import { useState, useCallback, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useUserData } from './useUserData';
import { BatchJob, BatchRequest, BatchProcessingConfig } from '@/lib/ai/services/BatchProcessor';

export interface BatchProcessingOverview {
  totalJobs: number;
  activeJobs: number;
  pendingJobs: number;
  completedJobs: number;
  failedJobs: number;
  queueSize: number;
  isProcessing: boolean;
  config: BatchProcessingConfig;
}

export interface UseBatchProcessingReturn {
  // State
  overview: BatchProcessingOverview | null;
  jobs: BatchJob[];
  queue: BatchRequest[];
  config: BatchProcessingConfig | null;
  isLoading: boolean;
  error: string | null;

  // Methods
  createBatchJob: (name: string, description: string, requests: Omit<BatchRequest, 'id' | 'createdAt' | 'retryCount' | 'userId' | 'householdId'>[]) => Promise<BatchJob>;
  processBatchJob: (jobId: string) => Promise<BatchJob>;
  cancelBatchJob: (jobId: string) => Promise<boolean>;
  updateConfig: (config: Partial<BatchProcessingConfig>) => Promise<void>;
  fetchOverview: () => Promise<void>;
  fetchJobs: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  getJob: (jobId: string) => Promise<BatchJob | null>;

  // Auto-refresh
  startAutoRefresh: (interval?: number) => void;
  stopAutoRefresh: () => void;
}

export function useBatchProcessing(): UseBatchProcessingReturn {
  const { user } = useUser();
  const { userData } = useUserData();
  
  const [overview, setOverview] = useState<BatchProcessingOverview | null>(null);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [queue, setQueue] = useState<BatchRequest[]>([]);
  const [config, setConfig] = useState<BatchProcessingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  const createBatchJob = useCallback(async (
    name: string, 
    description: string, 
    requests: Omit<BatchRequest, 'id' | 'createdAt' | 'retryCount' | 'userId' | 'householdId'>[]
  ): Promise<BatchJob> => {
    if (!user?.id || !userData?.household?.id) {
      throw new Error('User not authenticated or no household');
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_job',
          name,
          description,
          requests: requests.map(req => ({
            ...req,
            userId: user.id,
            householdId: userData.household.id
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create batch job');
      }

      const result = await response.json();
      await fetchJobs(); // Refresh jobs list
      return result.data;

    } catch (err: any) {
      console.error('Failed to create batch job:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const processBatchJob = useCallback(async (jobId: string): Promise<BatchJob> => {
    if (!user?.id || !userData?.household?.id) {
      throw new Error('User not authenticated or no household');
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'process_job',
          jobId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process batch job');
      }

      const result = await response.json();
      await fetchJobs(); // Refresh jobs list
      return result.data;

    } catch (err: any) {
      console.error('Failed to process batch job:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const cancelBatchJob = useCallback(async (jobId: string): Promise<boolean> => {
    if (!user?.id || !userData?.household?.id) {
      throw new Error('User not authenticated or no household');
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel_job',
          jobId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cancel batch job');
      }

      await fetchJobs(); // Refresh jobs list
      return true;

    } catch (err: any) {
      console.error('Failed to cancel batch job:', err);
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const updateConfig = useCallback(async (newConfig: Partial<BatchProcessingConfig>): Promise<void> => {
    if (!user?.id || !userData?.household?.id) {
      throw new Error('User not authenticated or no household');
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_config',
          config: newConfig
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update config');
      }

      await fetchConfig(); // Refresh config

    } catch (err: any) {
      console.error('Failed to update config:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const fetchOverview = useCallback(async () => {
    if (!user?.id || !userData?.household?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/batch?action=overview', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch overview');
      }

      const result = await response.json();
      setOverview(result.data);

    } catch (err: any) {
      console.error('Failed to fetch overview:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const fetchJobs = useCallback(async () => {
    if (!user?.id || !userData?.household?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/batch?action=jobs', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch jobs');
      }

      const result = await response.json();
      setJobs(result.data);

    } catch (err: any) {
      console.error('Failed to fetch jobs:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const fetchQueue = useCallback(async () => {
    if (!user?.id || !userData?.household?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/batch?action=queue', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch queue');
      }

      const result = await response.json();
      setQueue(result.data);

    } catch (err: any) {
      console.error('Failed to fetch queue:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const fetchConfig = useCallback(async () => {
    if (!user?.id || !userData?.household?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/batch?action=config', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch config');
      }

      const result = await response.json();
      setConfig(result.data);

    } catch (err: any) {
      console.error('Failed to fetch config:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userData?.household?.id]);

  const getJob = useCallback(async (jobId: string): Promise<BatchJob | null> => {
    if (!user?.id || !userData?.household?.id) return null;

    try {
      const response = await fetch(`/api/ai/batch?action=job&jobId=${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch job');
      }

      const result = await response.json();
      return result.data;

    } catch (err: any) {
      console.error('Failed to fetch job:', err);
      setError(err.message);
      return null;
    }
  }, [user?.id, userData?.household?.id]);

  const startAutoRefresh = useCallback((interval: number = 30000) => {
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
    }

    autoRefreshInterval.current = setInterval(() => {
      fetchOverview();
      fetchJobs();
    }, interval);
  }, [fetchOverview, fetchJobs]);

  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
      autoRefreshInterval.current = null;
    }
  }, []);

  // Auto-fetch data when user is available
  useEffect(() => {
    if (user?.id && userData?.household?.id) {
      fetchOverview();
      fetchJobs();
      fetchConfig();
    }
  }, [user?.id, userData?.household?.id, fetchOverview, fetchJobs, fetchConfig]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoRefresh();
    };
  }, [stopAutoRefresh]);

  return {
    overview,
    jobs,
    queue,
    config,
    isLoading,
    error,
    createBatchJob,
    processBatchJob,
    cancelBatchJob,
    updateConfig,
    fetchOverview,
    fetchJobs,
    fetchQueue,
    fetchConfig,
    getJob,
    startAutoRefresh,
    stopAutoRefresh
  };
}
