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
    if (!user || !userData?.household_id) {
      console.log('useHeartbeat: Skipping setup - user or userData not ready', {
        hasUser: !!user,
        hasUserData: !!userData,
        householdId: userData?.household_id
      });
      return;
    }

    // Add a small delay to ensure userData is fully loaded
    const setupTimer = setTimeout(() => {
      if (!userData?.household_id || userData.household_id.trim() === '') {
        console.warn('useHeartbeat: Still no valid household_id after delay', {
          householdId: userData?.household_id
        });
        return;
      }

      console.log('useHeartbeat: Setting up with household_id:', userData.household_id);

      // Post initial heartbeat only if we have a valid household_id
      postEventTypes.heartbeat({ household_id: userData.household_id }).catch(error => {
        console.warn('Failed to post initial heartbeat:', error);
      });

      // Set up interval for periodic heartbeats
      intervalRef.current = setInterval(() => {
        if (userData?.household_id && userData.household_id.trim() !== '') {
          postEventTypes.heartbeat({ household_id: userData.household_id }).catch(error => {
            console.warn('Failed to post periodic heartbeat:', error);
          });
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
          if (userData?.household_id && userData.household_id.trim() !== '') {
            postEventTypes.heartbeat({ household_id: userData.household_id }).catch(error => {
              console.warn('Failed to post visibility change heartbeat:', error);
            });
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
    }, 1000); // 1 second delay

    // Cleanup function
    return () => {
      clearTimeout(setupTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Remove event listeners
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      events.forEach(event => {
        document.removeEventListener(event, () => {}, true);
      });
      
      document.removeEventListener('visibilitychange', () => {});
    };
  }, [user, userData?.household_id]);

  // Return function to manually trigger heartbeat
  const triggerHeartbeat = () => {
    if (userData?.household_id && userData.household_id.trim() !== '') {
      postEventTypes.heartbeat({ household_id: userData.household_id }).catch(error => {
        console.warn('Failed to post manual heartbeat:', error);
      });
    } else {
      console.warn('triggerHeartbeat: No valid household_id available');
    }
  };

  return { triggerHeartbeat };
}
