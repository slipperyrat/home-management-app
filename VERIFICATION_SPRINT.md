# 🔍 Verification Sprint - Lock Down Completed Items

*Based on roadmap review analysis - prove the ✅ completed items with concrete artifacts*

## 🎯 **Goal**
Verify the items marked as "✅ COMPLETED" in the roadmap to prevent wishful thinking and ensure we have solid proof before moving to Phase 1.

---

## 📋 **Items to Verify (Priority Order)**

### 1. **✅ RLS Audit & Fixes** - **HIGH PRIORITY**
**Quick Verification Steps:**
```bash
# Check for explicit auth.uid() casts
grep -r "auth\.uid()" supabase/ --include="*.sql" | grep -E "::text|::uuid"

# Test RLS policies with sample data
# Run the test harness from roadmap on a seeded database
```

**Acceptance Criteria:**
- [ ] Explicit `auth.uid()::text` or `auth.uid()::uuid` casts where needed
- [ ] Allow/deny tests for owner/member/outsider roles
- [ ] CI job that seeds + runs RLS policy tests
- [ ] All policies tested with test harness

**Artifact Required:** 
- RLS policy test results showing all policies work correctly
- CI pipeline that runs these tests automatically

---

### 2. **🔄 Security Hardening (Headers + Rate Limiting)** - **HIGH PRIORITY**
**Quick Verification Steps:**
```bash
# Check security headers
curl -I https://your.app/ | grep -E "strict-transport-security|content-security-policy|x-frame-options"

# Test rate limiting
for i in {1..30}; do curl -s -o /dev/null -w "%{http_code}\n" https://your.app/api/test; done | grep 429
```

**Acceptance Criteria:**
- [ ] Global security headers coverage (CSP, HSTS, X-Frame-Options, Referrer-Policy)
- [ ] Rate limiting triggers 429 on burst requests (not just single routes)
- [ ] Limiter wraps auth and webhook routes
- [ ] Health checks excluded from rate limiting

**Artifact Required:**
- curl output showing all security headers
- Rate limiting test results showing 429 responses

---

### 3. **✅ Error Handling/Logging Foundation** - **MEDIUM PRIORITY**
**Quick Verification Steps:**
```bash
# Check for structured logging
grep -r "logger\." src/ --include="*.ts" | head -10

# Look for error boundaries
grep -r "ErrorBoundary\|error.tsx" src/ --include="*.tsx"
```

**Acceptance Criteria:**
- [ ] Consistent structured errors (route, user/household, correlation id)
- [ ] Error boundaries catch client exceptions
- [ ] Unified logger with request context
- [ ] All API routes use shared error handling

**Artifact Required:**
- Sample log entries showing structured error format
- Error boundary test results

---

### 4. **🔄 Minimal Audit Logging** - **MEDIUM PRIORITY**
**Quick Verification Steps:**
```sql
-- Check if audit_log table exists and has proper structure
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'audit_log' ORDER BY ordinal_position;

-- Check for audit logging in API routes
SELECT * FROM audit_log ORDER BY at DESC LIMIT 5;
```

**Acceptance Criteria:**
- [ ] Writes for create/update/delete across lists/items/plans store:
  - actor_id, household_id, resource, action
  - diff (optional but preferred)
  - ip/user_agent, timestamp
- [ ] Audit log table exists with proper indexes
- [ ] Critical operations logged consistently

**Artifact Required:**
- Sample audit log entries showing complete data capture
- Database schema showing audit_log table structure

---

### 5. **✅ E2E Testing Foundation** - **MEDIUM PRIORITY**
**Quick Verification Steps:**
```bash
# Run E2E tests and check results
npm run test:e2e

# Check if tests run in CI
# Look for Playwright report artifacts
```

**Acceptance Criteria:**
- [ ] 115/115 tests passing consistently
- [ ] Runs in CI on seeded DB
- [ ] Fails build on any regression
- [ ] Playwright HTML report published as artifact

**Artifact Required:**
- GitHub Actions workflow showing E2E test results
- Playwright report artifact link

---

### 6. **🔄 Performance Indexes** - **LOW PRIORITY**
**Quick Verification Steps:**
```sql
-- Check if indexes exist
SELECT indexname, tablename FROM pg_indexes 
WHERE tablename IN ('shopping_items', 'shopping_lists', 'household_members', 'chores', 'meal_plans')
ORDER BY tablename, indexname;

-- Add missing indexes if needed
CREATE INDEX IF NOT EXISTS shopping_items_list_complete_idx ON shopping_items (list_id, is_complete);
CREATE INDEX IF NOT EXISTS shopping_lists_household_idx ON shopping_lists (household_id);
CREATE INDEX IF NOT EXISTS household_members_household_user_idx ON household_members (household_id, user_id);
CREATE INDEX IF NOT EXISTS shopping_items_created_idx ON shopping_items (created_at);
```

**Acceptance Criteria:**
- [ ] All recommended indexes exist
- [ ] Query performance improved
- [ ] Database monitoring shows better performance

**Artifact Required:**
- Database index list showing all recommended indexes exist
- Performance metrics showing improvement

---

### 7. **🔄 Recurrence Model** - **LOW PRIORITY**
**Quick Verification Steps:**
```sql
-- Check if RRULE columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name IN ('chores', 'calendar_events') 
AND column_name IN ('rrule', 'dtstart');
```

**Acceptance Criteria:**
- [ ] RRULE text column exists and is used
- [ ] Server-side expansion to instances for next N weeks
- [ ] De-duplication of clashes
- [ ] Basic recurrence functionality working

**Artifact Required:**
- Database schema showing RRULE columns
- Test showing recurrence expansion works

---

## 🚀 **Phase 1 - Next Priorities (Highest ROI)**

Based on the other tool's analysis, here are the next features to build (in priority order):

### **1. Today View + Daily/Weekly Digest** - **HIGHEST ROI**
**Why:** Anchors daily use; upsell lever.

**Acceptance Criteria:**
- [ ] Single screen showing today's tasks, meals, shopping gaps, events
- [ ] Digest email/push at user's preferred time
- [ ] Per-household digest toggle
- [ ] Custom digest time settings

**Pro Gates:**
- [ ] Custom digest time
- [ ] Cross-calendar pull
- [ ] Smart suggestions

---

### **2. Meal → Shopping v1.5 (Auto-merge)** - **HIGH ROI**
**Why:** Tangible value, reduces friction.

**Acceptance Criteria:**
- [ ] Lock a week → ingredients auto-merged into list
- [ ] De-duplicated units and quantities
- [ ] Pantry matches flagged
- [ ] "Swap" suggestions available

**Pro Gates:**
- [ ] 1-click AI plan
- [ ] Leftover reuse
- [ ] Multi-store partitioning

---

### **3. Attachments + OCR Lite (Receipts, Task Photos)** - **MEDIUM ROI**
**Why:** Unlocks price history, proof-of-done.

**Acceptance Criteria:**
- [ ] Upload on items/tasks
- [ ] OCR extracts store, date, total
- [ ] Searchable text
- [ ] Privacy-safe storage

**Pro Gates:**
- [ ] Expense categorization
- [ ] Price trends
- [ ] Receipt export

---

### **4. Read-only Calendar Sync (ICS) + "Add to Calendar"** - **MEDIUM ROI**
**Why:** Low ops, high value; retention.

**Acceptance Criteria:**
- [ ] Household ICS URL (rotatable token)
- [ ] Per-item "Add to Calendar"
- [ ] Read-only sync working

**Pro Gates:**
- [ ] Faster refresh
- [ ] Per-member ICS feeds

---

### **5. Design System + Onboarding Polish** - **MEDIUM ROI**
**Why:** Conversion, perceived quality.

**Acceptance Criteria:**
- [ ] Tokens (spacing/typography/colors)
- [ ] Light/dark parity
- [ ] Zero states, skeletons
- [ ] 3-step onboarding (join/create household, import sample plan, enable digest)

---

### **6. AI Input Hardening + Guardrails** - **LOW ROI (But Important)**
**Why:** Reliability + cost control.

**Acceptance Criteria:**
- [ ] Centralized prompt lib
- [ ] Schema validation on outputs
- [ ] Retry/backoff logic
- [ ] Per-feature budget caps

---

## 📝 **"Definition of Done" Snippets**

### **Rate Limiting is Global:**
```typescript
// limiter middleware wraps /api/*, /auth/*, /webhooks/*
// smoke test proves 429 on burst; exclude health checks
```

### **Security Headers:**
```
CSP: script-src 'self' plus known third-parties
HSTS: preload
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

### **Audit Log:**
```sql
-- table + insert helpers; view in admin; retention policy (e.g., 180 days)
```

### **CI Proofs:**
- [ ] Publish Playwright HTML, Lighthouse JSON, and k6 summary as build artifacts
- [ ] Badges in README

---

## ⏰ **Timeline**

**Week 1:** Complete verification sprint (items 1-7 above)
**Week 2:** Start Phase 1 - Today View + Digest (highest ROI)
**Week 3:** Continue Phase 1 - Meal → Shopping Auto-merge

**Success Metrics:**
- All verification items have concrete artifacts
- Phase 1 features have clear acceptance criteria
- CI/CD pipeline includes all quality gates
- Documentation updated with proof of completion

---

## 🎯 **Success Criteria**

By the end of this verification sprint:
1. **All ✅ completed items have concrete proof**
2. **All 🔄 partially completed items have clear completion criteria**
3. **Phase 1 priorities are defined with acceptance criteria**
4. **CI/CD pipeline includes quality gates for all completed items**
5. **Roadmap accurately reflects current state**

This prevents roadmap drift and ensures we build on a solid, verified foundation.
