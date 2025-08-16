'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/nextjs';

export interface UserData {
  email: string;
  role: 'owner' | 'member';
  plan: 'free' | 'premium';
  xp: number;
  coins: number;
  has_onboarded?: boolean;
  updated_at?: string;
  household_id?: string;
  household?: {
    id: string;
    plan: string;
    game_mode: string;
    created_at: string;
  };
}

export interface PowerUp {
  id: string;
  type: string;
  expires_at: string;
  is_active: boolean;
}

async function fetchUserData(): Promise<UserData> {
  const response = await fetch('/api/user-data', {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch user data');
  }
  
  const result = await response.json();
  return result.data;
}

async function fetchPowerUps(userId: string): Promise<PowerUp[]> {
  const response = await fetch(`/api/power-ups?userId=${userId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch power-ups');
  }
  
  const result = await response.json();
  return result.data || [];
}

export function useUserData() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const userDataQuery = useQuery({
    queryKey: ['userData', user?.id],
    queryFn: fetchUserData,
    enabled: isLoaded && isSignedIn && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 401/403 errors
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
  });

  const powerUpsQuery = useQuery({
    queryKey: ['powerUps', user?.id],
                    queryFn: () => fetchPowerUps(user?.id || ''),
    enabled: isLoaded && isSignedIn && !!user?.id && userDataQuery.isSuccess,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    userData: userDataQuery.data,
    powerUps: powerUpsQuery.data || [],
    isLoading: userDataQuery.isLoading || powerUpsQuery.isLoading,
    isError: userDataQuery.isError || powerUpsQuery.isError,
    error: userDataQuery.error || powerUpsQuery.error,
    refetch: () => {
      userDataQuery.refetch();
      powerUpsQuery.refetch();
    },
    isLoaded,
    isSignedIn,
    user,
  };
}
