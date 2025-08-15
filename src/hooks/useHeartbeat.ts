import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { postEventTypes } from '@/lib/postEvent';
import { useUserData } from './useUserData';

export function useHeartbeat() {
  const { user } = useUser();
  const { userData } = useUserData();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user || !userData?.household_id) return;

    // Post initial heartbeat
    postEventTypes.heartbeat(userData.household_id);

    // Set up interval for periodic heartbeats
    intervalRef.current = setInterval(() => {
      if (userData?.household_id) {
        postEventTypes.heartbeat(userData.household_id);
      }
    }, 15 * 60 * 1000); // 15 minutes

    // Track user activity
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Listen for user activity events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Post heartbeat when tab becomes visible
        if (userData?.household_id) {
          postEventTypes.heartbeat(userData.household_id);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, userData?.household_id]);

  // Return function to manually trigger heartbeat
  const triggerHeartbeat = () => {
    if (userData?.household_id) {
      postEventTypes.heartbeat(userData.household_id);
    }
  };

  return { triggerHeartbeat };
}
