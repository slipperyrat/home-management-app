'use client';

import { useQuery } from '@tanstack/react-query';

interface UserData {
  email: string;
  role: 'owner' | 'member';
  plan: 'free' | 'premium';
  xp: number;
  coins: number;
  household: {
    id: string;
    plan: string;
    game_mode: string;
    created_at: string;
  };
}

interface UserDataResponse {
  success: boolean;
  user: UserData;
}

const fetchUserData = async (): Promise<UserData> => {
  const response = await fetch('/api/user-data');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user data: ${response.status}`);
  }
  
  const data: UserDataResponse = await response.json();
  
  if (!data.success) {
    throw new Error('Failed to fetch user data');
  }
  
  return data.user;
};

export const useUserData = () => {
  return useQuery({
    queryKey: ['userData'],
    queryFn: fetchUserData,
    staleTime: 5 * 60 * 1000, // 5 minutes - user data doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
    retry: (failureCount, error: any) => {
      // Don't retry auth errors
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        return false;
      }
      return failureCount < 3;
    },
  });
};
