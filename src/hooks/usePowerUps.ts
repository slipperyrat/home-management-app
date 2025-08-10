import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { getUserPowerUpDetails } from '@/lib/supabase/rewards';

interface PowerUp {
  id: string;
  name: string;
  type: string;
  expires_at: string | null;
  created_at: string;
}

interface UsePowerUpsReturn {
  powerUps: PowerUp[];
  loading: boolean;
  error: string | null;
}

export function usePowerUps(): UsePowerUpsReturn {
  const { user } = useUser();
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when user changes
    setPowerUps([]);
    setLoading(true);
    setError(null);

    // Don't fetch if no user
    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetchPowerUps() {
      try {
        setLoading(true);
        setError(null);
        
        if (!user?.id) return;
        
        const powerUpsData = await getUserPowerUpDetails(user.id);
        setPowerUps(powerUpsData);
      } catch (err) {
        console.error('Error fetching power-ups:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch power-ups');
      } finally {
        setLoading(false);
      }
    }

    fetchPowerUps();
  }, [user?.id]);

  // Memoize the result to prevent unnecessary re-renders
  const result = useMemo(() => ({
    powerUps,
    loading,
    error
  }), [powerUps, loading, error]);

  return result;
} 