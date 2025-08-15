'use client';

import { useHeartbeat } from '@/hooks/useHeartbeat';

interface HeartbeatProviderProps {
  children: React.ReactNode;
}

export default function HeartbeatProvider({ children }: HeartbeatProviderProps) {
  // Initialize heartbeat - this will run on every page load
  useHeartbeat();
  
  return <>{children}</>;
}
