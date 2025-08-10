"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

export function SyncUserClient() {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      console.log('User signed in, syncing to database...');
      fetch("/api/sync-user", {
        method: "POST",
      })
      .then(async response => {
        if (response.ok) {
          console.log('User synced successfully');
        } else {
          console.error('Failed to sync user:', response.status, response.statusText);
          // Try to get error details
          try {
            const errorText = await response.text();
            console.error('Response body:', errorText);
          } catch (e) {
            console.error('Could not read response body');
          }
        }
      })
      .catch(error => {
        console.error('Error syncing user:', error);
      });
    }
  }, [isSignedIn]);

  return null;
} 