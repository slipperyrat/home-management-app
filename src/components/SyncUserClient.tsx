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
      .then(response => {
        if (response.ok) {
          console.log('User synced successfully');
        } else {
          console.error('Failed to sync user:', response.status, response.statusText);
        }
      })
      .catch(error => {
        console.error('Error syncing user:', error);
      });
    }
  }, [isSignedIn]);

  return null;
} 