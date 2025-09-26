'use client';

import { useHeartbeat } from '@/hooks/useHeartbeat';

interface HeartbeatProviderProps {
  children: React.ReactNode;
}

export default function HeartbeatProvider({ children }: HeartbeatProviderProps) {
  // Re-enable heartbeat for user activity monitoring
  useHeartbeat();
  
  return <>{children}</>;
}
