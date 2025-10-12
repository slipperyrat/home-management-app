"use client";

import type { Entitlements } from "@/lib/entitlements";

export async function fetchEntitlements(householdId: string): Promise<Entitlements | null> {
  const response = await fetch(`/api/entitlements/${householdId}`);
  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  return (json.data?.entitlements ?? json.entitlements ?? null) as Entitlements | null;
}

