import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { postEventTypes } from '@/lib/postEvent';
import { useUserData } from './useUserData';
import { logger } from '@/lib/logging/logger';

export function useHeartbeat() {
  const { user } = useUser();
  const { userData } = useUserData();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user || !userData?.household_id) {
      logger.debug?.('useHeartbeat: Skipping setup', {
        hasUser: !!user,
        hasUserData: !!userData,
        householdId: userData?.household_id,
      });
      return;
    }

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && userData?.household_id?.trim()) {
        postEventTypes.heartbeat({ household_id: userData.household_id }).catch((error) => {
          logger.warn('Failed to post visibility change heartbeat', error, {
            householdId: userData.household_id,
          });
        });
      }
    };

    const setupTimer = setTimeout(() => {
      if (!userData?.household_id?.trim()) {
        logger.warn('useHeartbeat: No valid household_id after delay', {
          householdId: userData?.household_id,
        });
        return;
      }

      logger.info('useHeartbeat: Setting up heartbeat listener', {
        householdId: userData.household_id,
      });

      postEventTypes.heartbeat({ household_id: userData.household_id }).catch((error) => {
        logger.warn('Failed to post initial heartbeat', error, {
          householdId: userData.household_id,
        });
      });

      intervalRef.current = setInterval(() => {
        if (userData?.household_id?.trim()) {
          postEventTypes.heartbeat({ household_id: userData.household_id }).catch((error) => {
            logger.warn('Failed to post periodic heartbeat', error, {
              householdId: userData.household_id,
            });
          });
        }
      }, 30 * 60 * 1000);

      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      events.forEach((event) => {
        document.addEventListener(event, handleActivity, true);
      });

      document.addEventListener('visibilitychange', handleVisibilityChange);
    }, 1000);

    return () => {
      clearTimeout(setupTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });

      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, userData?.household_id, userData]);

  const triggerHeartbeat = () => {
    if (userData?.household_id?.trim()) {
      postEventTypes.heartbeat({ household_id: userData.household_id }).catch((error) => {
        logger.warn('Failed to post manual heartbeat', error, {
          householdId: userData.household_id,
        });
      });
    } else {
      logger.warn('triggerHeartbeat: No valid household_id available');
    }
  };

  return { triggerHeartbeat };
}
