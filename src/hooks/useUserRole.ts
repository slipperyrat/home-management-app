"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

export function useUserRole() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userId, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (!userId) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/user-role", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user role: ${response.statusText}`);
        }

        const data = await response.json();
        setRole(data.role);
      } catch (err) {
        console.error("Error fetching user role:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch user role");
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [userId, isLoaded]);

  return { role, loading, error };
} 