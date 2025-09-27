-- supabase/migrations/202510020900_onboarding_guard.sql
-- Reinstate onboarding tracking fields and helper view for middleware.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_onboarded boolean DEFAULT false;

COMMIT;
