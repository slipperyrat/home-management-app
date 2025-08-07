'use client';

import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';

interface UserData {
  email: string;
  role: 'owner' | 'member';
  plan: 'free' | 'premium';
  household: {
    id: string;
    plan: 'free' | 'premium';
    game_mode: string;
    created_at: string;
  };
}

interface GameModeData {
  gameMode: string;
  isDefault: boolean;
  isSingle: boolean;
  isCouple: boolean;
  isFamily: boolean;
  isRoommates: boolean;
  isCustom: boolean;
}

export function useGameMode(): GameModeData {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) {
      setLoading(false);
      return;
    }

    async function fetchUserData() {
      try {
        setLoading(true);
        const response = await fetch('/api/user-data');
        const result = await response.json();

        if (response.ok && result.success && result.user) {
          setUserData(result.user);
        } else {
          console.error('Error fetching user data:', result.error);
        }
      } catch (err) {
        console.error('Exception fetching user data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [isLoaded, isSignedIn, user?.id]);

  // Default values when data is not available
  const gameMode = userData?.household?.game_mode || 'default';
  
  return {
    gameMode,
    isDefault: gameMode === 'default',
    isSingle: gameMode === 'single',
    isCouple: gameMode === 'couple',
    isFamily: gameMode === 'family',
    isRoommates: gameMode === 'roommates',
    isCustom: gameMode === 'custom'
  };
} 