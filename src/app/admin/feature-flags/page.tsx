import { notFound } from "next/navigation";
import { toast } from "sonner";

import { fetchFeatureFlags } from "@/lib/server/featureFlags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AdminFeatureFlagsPage() {
  const featureFlags = await fetchFeatureFlags();

  if (!featureFlags) {
    notFound();
  }

  const allFlags = Object.entries(featureFlags.flags ?? {});
  const isEmpty = allFlags.length === 0;

  return (
    <div className="grid gap-6 px-4 py-6">
      <header className="grid gap-2">
        <CardTitle className="text-2xl font-semibold text-white">Feature Flags</CardTitle>
        <CardDescription className="text-sm text-slate-400">
          Review the current rollout state for household features.
        </CardDescription>
      </header>

      {isEmpty ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-400">
            No feature flags configured.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {allFlags.map(([flag, enabled]) => (
            <Card key={flag}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-white">{flag}</CardTitle>
                  <CardDescription className="text-sm text-slate-400">
                    Flag is currently {enabled ? "enabled" : "disabled"}.
                  </CardDescription>
                </div>
                <Badge variant={enabled ? "default" : "outline"}>{enabled ? "Enabled" : "Disabled"}</Badge>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.info(`Flag ${flag} cannot be toggled in the admin UI yet.`)}
                >
                  Toggle
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast.info(`Manage rollout for ${flag} via backend tooling.`)}
                >
                  Manage rollout
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-white">Upcoming</CardTitle>
            <CardDescription className="text-sm text-slate-400">
              Audit, staging, and environment-specific rollouts will be wired here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-400">
            <p>Flag overrides require backend support.</p>
            <p>Internal-only toggles will live behind auth in a later release.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}