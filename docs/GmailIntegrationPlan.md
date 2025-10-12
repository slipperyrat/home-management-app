# Gmail Integration Plan for Bill & Receipt Scanning

## Goals
- Connect a user’s Gmail account securely and fetch emails that look like bills or receipts.
- Extract structured data (due date, amount, merchant) and feed existing billing/receipt workflows.
- Avoid double-imports and respect privacy/authorization boundaries.

## 1. OAuth & Permissions
- Use Google OAuth 2.0 with `https://www.googleapis.com/auth/gmail.readonly` scope.
- Add endpoints:
  - `GET /api/google-mail/auth` – redirect the user to Google consent.
  - `GET /api/google-mail/callback` – exchange code for tokens; store refresh token encrypted in Supabase.
  - `GET /api/google-mail/status` – surface connection state in UI.
- Create a Clerk-protected settings UI allowing connect/disconnect.
- Store tokens per user/household in a dedicated table `gmail_connections` (fields: user_id, household_id, refresh_token, access_token, expiry, history_id).

## 2. Polling & Sync Strategy
- Start with a scheduled job (cron or background worker) that wakes every 15 min.
- Use Gmail `historyId` to perform incremental sync (list history for label INBOX).
- Fetch messages for connected users using Gmail API `users.messages.list` and `users.messages.get` with `format=full`.
- Apply server-side filters to narrow candidates:
  - Only unread or recent (last 30 days) messages.
  - Sender includes keywords (`billing`, `invoice`, `receipt`, known merchants).
  - Subject matches regex (e.g., /receipt|invoice|due|statement/i).
- Track processed message IDs in `gmail_messages` table to avoid duplicates.

## 3. Parsing & Extraction
- Use existing parsing utility if available; otherwise build a simple rule-based extractor:
  - Check for merchant names in headers.
  - Extract total amounts via regex (`\$\s?[0-9,.]+`).
  - Parse due dates via `chrono-node` or similar.
  - For receipts, capture line items by looking for table structures within HTML.
- If parsing fails, fall back to storing raw email snippet/attachment for manual review.
- Persist extracted data into existing flows:
  - Create a pending bill record (`bills` table) with `source = 'gmail'`.
  - Trigger `postEventTypes.billEmailReceived` for automation.
  - Optionally add to receipts/purchases table if available.

## 4. UI & UX Considerations
- Settings page tile: “Connect Gmail for Auto Bills/Receipts.”
- After connection, show last sync time, number imported, and link to manage Google permissions.
- Provide manual “Sync now” button calling `/api/google-mail/sync`.
- Notification center entry when new bill is detected.

## 5. Security & Compliance
- Encrypt refresh tokens at rest (use Supabase vault or KMS).
- Provide a way to revoke tokens (delete row + call Google revocation endpoint).
- Respect rate limits—cache negotiated access tokens, exponential backoff on 429.
- Log minimal metadata; avoid storing full email bodies unless necessary.

## 6. Milestones
1. **OAuth foundation** – endpoints, DB table, UI toggle.
2. **Manual sync MVP** – fetch latest 20 emails, parse minimal bill info.
3. **Background sync + dedupe** – cron job, historyId handling.
4. **Advanced parsing** – attachments, PDF parsing (future).

## Open Questions
- Should receipts create entries in spending tracker automatically or stay as notifications?
- Do we need PDF/attachment OCR now or can it wait?
- How do we expose errors (e.g., token expired) to the user—in-app banner vs. email?


