# Disaster Recovery & Backup Runbook

## Overview
This document captures our disaster recovery (DR) posture, objectives, and
operational playbooks. It complements existing reliability guides and focuses on
database resiliency, storage durability, and business continuity.

## Objectives
- **Recovery Time Objective (RTO)**: ≤ 60 minutes for primary database
  incidents; ≤ 120 minutes for total Supabase project loss.
- **Recovery Point Objective (RPO)**: ≤ 15 minutes leveraging nightly logical
  dumps plus weekly physical snapshots and WAL-based point-in-time recovery.
- **Integrity Goal**: 100% verified checksums for retained logical backups.
- **Compliance Goal**: Retain evidence of quarterly DR rehearsals for 12 months.

## Backup Strategy
- **Logical dumps**: Nightly Supabase PostgreSQL `pg_dump` run via
  `scripts/backup_db.sh`. Artifacts stored locally and optionally uploaded to a
  hardened Supabase storage bucket or S3 with encryption-at-rest.
- **Storage snapshots**: Optional object storage archival (Supabase bucket or
  S3) zipped and checksummed alongside DB dump.
- **Retention tiers**: Daily backups kept 7 days, weekly kept 30 days, monthly
  kept 90 days. Lifecycle enforced via script cleanup and storage policies.
- **Encryption**: Optional AES-256 encryption with passphrase stored in
  password manager (1Password). Keys rotated annually.
- **Monitoring**: Backup job emits JSON logs; integrate with DataDog or
  CloudWatch for alerting on failures, duration spikes, or checksum mismatch.
- **Scheduling**: Supabase Cron job defined in `supabase/cron/backup.sql`. Can
  be swapped for GitHub Action `.github/workflows/db_backup.yml` if preferred.

## Restore Strategy
- **Scripted restore**: `scripts/restore_db.sh` supports dev/staging restore,
  dry-run mode, encrypted dump handling, and optional PITR using WAL segments.
- **Staging warm standby**: Nightly staging refresh recommended to validate
  restore pipeline and reduce RTO.
- **Integrity validation**: Weekly job (future) to spin ephemeral DB, restore
  latest dump, run smoke tests. Track results in `docs/dr-drill/YYYY-MM-DD/`.

## Roles & Responsibilities
- **Incident Commander (IC)**: Coordinates DR execution, communicates with
  stakeholders.
- **Database Operator**: Executes backup/restore scripts, manages Supabase
  project settings, verifies data integrity.
- **Application Owner**: Validates application-level functionality, handles
  feature flags, ensures background jobs resume.
- **Comms Lead**: Posts updates to Slack, Statuspage, email (if required).

## DR Rehearsal Plan
### Frequency
- Perform at least quarterly. Schedule on shared calendar and track in issue
  template `DR Drill YYYY-MM-DD`.

### Pre-Requisites
- Up-to-date `scripts/backup_db.sh` and `scripts/restore_db.sh`.
- Confirm access to Supabase dashboard, storage bucket, secrets manager.
- Documented staging credentials and infrastructure references in `.env.dr`.
- Ensure latest backup artifacts available (from preceding night).
- Slack channel `#dr-drill` prepped for real-time comms.

### Scenario Template
1. **Select Failure Scenario**:
   - Primary database corruption (logical)
   - Storage bucket deletion
   - Total Supabase project loss
2. **Initiate Simulation**:
   - For database scenario, run destructive script against staging copy or
     disable primary DB access via Supabase controls.
   - For storage scenario, rename or remove bucket objects in staging.
   - For project loss, spin up new Supabase project to restore into.
3. **Trigger Incident Process**:
   - Assign IC, DB Operator, Comms Lead.
   - Start incident document in Notion/Google Doc.
   - Begin timeline log.
4. **Execute Restore**:
   - Identify target backup artifact (most recent or scenario-specific).
   - Run `scripts/restore_db.sh -i <backup-dir> -t staging --force`.
   - For project rebuild:
     - Provision new Supabase project and set env vars.
     - Run schema migrations or `supabase db push` if needed.
     - Restore data dump.
     - Reconfigure storage bucket and upload archived objects.
5. **Validate**:
   - Run automated smoke tests (`npm run test:smoke` or e2e suite) against
     restored environment.
   - Verify core flows (auth, tasks, finance modules) manually.
   - Check background jobs/rescheduled cron tasks.
6. **Review**:
   - Calculate RTO (start -> service restored) and RPO (data loss window).
   - Capture logs, screenshots, metrics; store in `docs/dr-drill/<date>/`.
   - Update playbook with lessons learned.

### Rollback Criteria
- Abort restore if checksum validation fails twice.
- Abort if restore runs >2 hours without significant progress.
- If restored environment exhibits data integrity issues, revert to previous
  known-good snapshot and communicate service impact.
- Document fallback steps (e.g., switch traffic to read-only mode) before
  initiating restore.

### Communication Plan
- **Internal**: IC posts updates every 15 minutes in `#engineering` and
  dedicated incident channel.
- **External**: Comms Lead prepares customer-facing update in Statuspage or
  email when outage exceeds 30 minutes or data loss possible.
- **Post-mortem**: Publish internal post-incident review within 5 business
  days summarizing timeline, root cause, remediation.

## Operational Processes
- **Backup Verification**:
  - Check job logs daily.
  - Verify latest checksum weekly.
  - Run automated integrity restore monthly.
- **Configuration Management**:
  - `.env.dr` contains environment-specific overrides (never commit secrets).
  - `BACKUP_PASSPHRASE`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`,
    `SUPABASE_STORAGE_BUCKET` stored in 1Password + Supabase Vault.
  - Cron job tokens maintained via Supabase config settings (`app.settings`).
- **Key Rotation**:
  - Rotate encryption passphrase annually.
  - Update Supabase service role key concurrently; document in `docs/SECURITY.md`.
- **Cost Control**:
  - Lifecycle rules purge storage objects beyond retention.
  - Configure alert for monthly storage growth exceeding 20%.

## Appendices
- **Scripts**:
  - `scripts/backup_db.sh`: logical dump, storage snapshot, retention cleanup.
  - `scripts/restore_db.sh`: restore workflow with checksum, optional PITR.
- **Scheduling**:
  - Supabase Scheduled Function `nightly-backup-trigger` dispatches GitHub
    Action `.github/workflows/db_backup.yml` which runs `scripts/backup_db.sh`.
- **Future Enhancements**:
  - GitHub Actions fallback for teams without Supabase cron access.
  - Automated staging refresh pipeline to validate backups daily.
  - Data masking script for sharing sanitized backups with contractors.


