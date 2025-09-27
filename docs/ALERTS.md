# Alerting Guide

## Ownership
- Primary oncall: platform-team@company.com
- Secondary: devops@company.com
- Pager escalation: PagerDuty service `home-management-app`

## Alert Rules

### API SLO Burn
- Trigger: `api-success-rate` burn rate > 2 over 6h OR > 1 over 24h.
- Action: PagerDuty alert; follow SLO runbook.

### API Latency
- Trigger: `api-p95-latency` > 300ms for 15m.
- Action: Slack #ops-alerts (warning) + PagerDuty if persists 30m.

### Job Failures
- Trigger: `job-success-rate` burn rate > 3 over 1h OR failure count > 5 in 15m.
- Action: PagerDuty + create incident ticket.

### Queue Depth
- Trigger: `job-queue-depth` > 10 pending for 15m.
- Action: Slack alert; if sustained 30m escalate to oncall.

## Response Checklist
1. Acknowledge alert in PagerDuty/Slack.
2. Check Grafana dashboard (`/pages/admin/metrics`) for API/job panels.
3. Review recent deployments (GitHub actions, Vercel logs).
4. Inspect logs in Sentry for correlated errors.
5. Apply mitigation (scale queue worker, rollback, hotfix).
6. Document incident in `docs/INCIDENT_REPORTS/` with timeline & resolution.
