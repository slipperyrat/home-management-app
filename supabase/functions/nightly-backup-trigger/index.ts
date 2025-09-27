// Edge Function: nightly-backup-trigger
//
// Invoked by Supabase Scheduled Functions to dispatch the GitHub Actions
// workflow `.github/workflows/db_backup.yml`. The function requires the
// following environment variables configured via Supabase project secrets:
//
//   GITHUB_TOKEN            -> personal access token or GitHub App token with
//                               `workflow` scope enabling workflow_dispatch.
//   GITHUB_REPO             -> owner/repo string (e.g., `your-org/home-management-app`).
//   GITHUB_WORKFLOW_FILE    -> optional, defaults to `db_backup.yml`.
//   GITHUB_REF              -> optional, branch or tag to dispatch (default `main`).
//
// Optional request payload overrides:
//   { "ref": "main", "triggeredBy": "manual", "scheduleTimestamp": "ISO" }
//
import { serve } from "https://deno.land/std@0.214.0/http/server.ts";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_REPO = Deno.env.get("GITHUB_REPO");
const WORKFLOW_FILE = Deno.env.get("GITHUB_WORKFLOW_FILE") ?? "db_backup.yml";
const DEFAULT_REF = Deno.env.get("GITHUB_REF") ?? "main";

if (!GITHUB_TOKEN || !GITHUB_REPO) {
  console.error("Missing required GitHub configuration.", {
    hasToken: Boolean(GITHUB_TOKEN),
    hasRepo: Boolean(GITHUB_REPO),
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return new Response("GitHub integration not configured", { status: 500 });
  }

  let payload: Record<string, unknown> = {};
  try {
    const text = await req.text();
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    console.warn("Failed to parse request payload", { error });
    return new Response("Invalid JSON body", { status: 400 });
  }

  const ref = typeof payload.ref === "string" && payload.ref.length > 0
    ? payload.ref
    : DEFAULT_REF;
  const triggeredBy = typeof payload.triggeredBy === "string"
    ? payload.triggeredBy
    : "supabase-schedule";
  const scheduleTimestamp = typeof payload.scheduleTimestamp === "string"
    ? payload.scheduleTimestamp
    : new Date().toISOString();

  const dispatchUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  const response = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "supabase-nightly-backup-trigger",
    },
    body: JSON.stringify({
      ref,
      inputs: {
        triggeredBy,
        scheduleTimestamp,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("GitHub dispatch failed", {
      status: response.status,
      statusText: response.statusText,
      errorBody,
    });
    return new Response(
      JSON.stringify({
        ok: false,
        status: response.status,
        error: errorBody,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const result = {
    ok: true,
    dispatchedAt: scheduleTimestamp,
    workflowFile: WORKFLOW_FILE,
    ref,
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

