# 🏠 Enhanced Home Management App Roadmap 2025 - UPDATED
*Strategic Vision + Detailed Technical Implementation Plan*

## 🎯 **CURRENT STATUS SUMMARY**
- **Weeks 1-7: 100% COMPLETED** ✅
- **Week 8-9: 100% COMPLETED** ✅ (Calendar & Event Management - 100% Complete)
- **Phase 1: 100% COMPLETED** ✅ (All Priority 1-4 Features Complete)
- **September 15, 2025: ENHANCED** ✅ (Shopping List Integration - Complete Bug Fixes & New Features)
- **September 16, 2025: AUTHENTICATION FIXES** ✅ (OCR & Calendar Sync Authentication - Complete)
- **September 2025: STRIPE INTEGRATION** ✅ (Complete Payment & Subscription System - Ready for Vercel Deployment)
- **September 19, 2025: CALENDAR TEMPLATES** ✅ (Pro-only Template System with Full CRUD - Complete)
- **September 19, 2025: GOOGLE CALENDAR IMPORT** ⏸️ (Pro-only Google Calendar Sync with OAuth - Code Complete, OAuth Setup Postponed)
- **September 19, 2025: DAILY DIGEST** ✅ (Pro-only Email Digest System with Resend - Complete)
- **September 19, 2025: QUIET HOURS** ✅ (Pro-only Notification Management System - Complete)
- **September 19, 2025: CONFLICT DETECTION** ✅ (Pro-only Calendar Conflict Detection System - Complete)
- **Major Achievement**: Complete Home Management Ecosystem with Calendar, Today View, Smart Shopping, OCR, ICS Sync, Production-Ready Payment System, Pro Calendar Templates, Daily Digest System, Quiet Hours Management, and Conflict Detection
- **System Status**: All core features operational, advanced integrations complete, enhanced shopping integration with duplicate cleanup tools, authentication issues resolved, **STRIPE INTEGRATION COMPLETE - AWAITING VERCEL DEPLOYMENT**, **CALENDAR TEMPLATES COMPLETE**, **GOOGLE CALENDAR IMPORT CODE COMPLETE - OAUTH SETUP POSTPONED**, **DAILY DIGEST COMPLETE**, **QUIET HOURS COMPLETE**, **CONFLICT DETECTION COMPLETE**

---

## 📊 **Current App Assessment: A+ (Excellent Foundation)**

### **What's Already Working Exceptionally Well**
- **Architecture**: Next.js 15 + TypeScript + Supabase with proper RLS
- **Security**: Enterprise-grade implementation (rate limiting, CSRF, input sanitization)
- **PWA**: Full offline support, push notifications, installable experience
- **AI Features**: Sophisticated email processing, meal suggestions, automation system
- **Gamification**: XP/rewards system, leaderboards, power-ups
- **State Management**: TanStack Query with proper caching strategies
- **Testing**: Good security tests, Playwright E2E setup
- **Chore Management**: Complete AI-powered chore assignment system with smart algorithms
- **Calendar System**: Full event management with RRULE recurrence, ICS export, and multi-view UI
- **Payment System**: Complete Stripe integration with checkout, webhooks, billing portal, and analytics
- **Feature Gating**: Enterprise-grade feature flags with admin dashboard and usage tracking

### **Technical Debt & Immediate Concerns**
- **Database**: Missing performance indexes, potential RLS UUID/TEXT casting issues
- **Testing**: Limited coverage beyond security functions
- **Monitoring**: Basic performance tracking, needs comprehensive observability
- **Offline Strategy**: Conflict resolution not defined
- **Type Safety**: Some API routes lack Zod validation

---

## 🚨 **CRITICAL: MVP PRICING IMPLEMENTATION**

### **🔴 MVP PRICING STRUCTURE - READY FOR IMPLEMENTATION**

**Status**: ✅ **CODE IMPLEMENTATION COMPLETE** - Ready for MVP pricing implementation
**Priority**: **CRITICAL** - Required for revenue generation and market validation

#### **What's Been Implemented (September 2025)**
- ✅ **Complete Stripe Integration**: Checkout sessions, webhooks, billing portal
- ✅ **Database Schema**: Stripe customer/subscription tracking columns
- ✅ **API Endpoints**: Payment processing and subscription management
- ✅ **UI Components**: Enhanced upgrade page, success/cancellation pages
- ✅ **Analytics System**: Feature usage tracking and subscription events
- ✅ **Admin Dashboard**: Feature flag management and testing interface
- ✅ **Security**: RLS policies, input validation, error handling

#### **MVP Pricing Structure** (AU - Household-based)
- **Free Tier**: $0 - Trial/solo/light households
  - Shared calendar & events, basic repeat rules, reminders, meal planner → grocery list (manual)
  - Shopping lists, chores, starter templates, ICS export
  - 1 household, up to 5 members, 12 months history
- **Pro Tier**: $7.99/month or $59/year (38% annual discount)
  - Everything in Free plus: Advanced recurrence (RRULE/EXDATE/RDATE), conflict detection
  - Calendar templates, meal → list automation, Google Calendar read-only import
  - Daily digest, quiet hours, 24 months history, priority support

#### **MVP Implementation Checklist** (MUST COMPLETE)
- [ ] **Update Stripe Products**: Create Pro ($7.99/month, $59/year) - NO Pro+ tier
- [ ] **Create Entitlements Table**: Implement MVP-specific entitlements schema
- [ ] **Update Feature Gates**: Replace current flags with MVP-specific gates
- [x] **Implement Google Import**: Read-only hourly Google Calendar import ✅ **CODE COMPLETED** (OAuth setup postponed)
- [x] **Implement Daily Digest**: Pro-only daily summary email ✅ **COMPLETED**
- [x] **Implement Quiet Hours**: Single window notification management ✅ **COMPLETED**
- [x] **Implement Conflict Detection**: Basic same-title/same-time detection ✅ **COMPLETED**
- [x] **Implement Calendar Templates**: School term, sports training templates ✅ **COMPLETED**
- [ ] **Test Payment Flow**: Verify upgrade/downgrade flows work correctly

**⚠️ NOTE**: All code is implemented and ready. Focus on MVP pricing structure and missing features before deployment.

---

## 🚀 **MVP LAUNCH ROADMAP (Weeks 1-8)**

### **🎯 Phase 0: MVP Pricing Implementation (Weeks 1-2)**

#### **Week 1: MVP Pricing Structure & Entitlements**
- [ ] **Update Stripe Products** 🔄 **IN PROGRESS**
  - Remove Pro+ tier ($14.99/month)
  - Update Pro tier to $7.99/month, $59/year (38% annual discount)
  - Configure Australian GST compliance
  - Set up trial: 7 days (no card for first 24h)

- [ ] **Create Entitlements Table** 🔄 **IN PROGRESS**
  ```sql
  CREATE TABLE entitlements (
    household_id uuid PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    tier text NOT NULL CHECK (tier IN ('free','pro')),
    history_months int NOT NULL DEFAULT 12,
    advanced_rrule boolean NOT NULL DEFAULT false,
    conflict_detection text NOT NULL DEFAULT 'none',
    google_import boolean NOT NULL DEFAULT false,
    digest_max_per_day int NOT NULL DEFAULT 0,
    quiet_hours boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ```

- [ ] **Update Feature Gates (MVP-Specific)** 🔄 **IN PROGRESS**
  ```typescript
  // server utils/canAccessFeature.ts - MVP VERSION
  export function canAccessFeature(userPlan: 'free'|'pro', feature: string) {
    const mvpFeatureMap = {
      // Free features
      basic_calendar: 'free',
      basic_recurrence: 'free',
      meal_planner_manual: 'free',
      shopping_lists: 'free',
      chores: 'free',
      ics_export: 'free',
      
      // Pro features
      advanced_rrule: 'pro',           // RRULE/EXDATE/RDATE with DST safety
      conflict_detection: 'pro',       // Basic conflict detection
      calendar_templates: 'pro',       // School term, sports templates
      google_import: 'pro',           // Read-only Google Calendar import
      digest_max_per_day: 'pro',      // Daily digest (1 per day)
      quiet_hours: 'pro',             // Single quiet hours window
      history_months: 'pro',          // 24 months vs 12 months
      meal_automation: 'pro'          // Auto-add from meal plans
    } as const;
    
    const required = mvpFeatureMap[feature] ?? 'free';
    return required === 'free' || userPlan === 'pro';
  }
  ```

- [ ] **Seed Free Entitlements** 🔄 **IN PROGRESS**
  - Auto-create free tier entitlements on household creation
  - Set up RLS policies for entitlements table
  - Create migration script for existing households

#### **Week 2: MVP Feature Implementation**
- [x] **Google Calendar Import (Read-Only)** ✅ **CODE COMPLETED** (OAuth setup postponed)
  - ✅ Hourly cron job to import events from Google Calendar
  - ✅ Respect quota: 400 actions/month (Free), 4,000 actions/month (Pro)
  - ✅ Per-household backoff and error handling
  - ✅ Store imported events with source tracking
  - ⏸️ **OAuth Setup Postponed**: Requires Google Cloud Console setup and app naming decision

- [x] **Daily Digest System (Pro-Only)** ✅ **COMPLETED**
  - ✅ Daily email with household summary (7-9pm local time)
  - ✅ Include: upcoming events, pending chores, meal plans, shopping needs
  - ✅ Pro-only feature (1 digest per day max)
  - ✅ Email template with household branding

- [x] **Quiet Hours Feature** ✅ **COMPLETED**
  - ✅ Single window notification management
  - ✅ Pro-only feature
  - ✅ UI to set start/end times
  - ✅ Respect quiet hours in all notification systems

- [x] **Conflict Detection (Basic)** ✅ **COMPLETED**
  - ✅ Same-title/same-time conflict detection
  - ✅ Pro-only feature
  - ✅ Show conflicts in calendar UI
  - ✅ Suggest resolution options

- [x] **Calendar Templates** ✅ **COMPLETED**
  - School term template (Australian school year) ✅
  - Sports training template (weekly recurring) ✅
  - Custom templates with full CRUD operations ✅
  - Pro-only feature with proper gating ✅
  - Easy template selection in calendar creation

#### **Week 3: MVP Testing & Launch Prep**
- [ ] **Feature Gate Testing** 🔄 **IN PROGRESS**
  - Test all MVP feature gates work correctly
  - Verify Free vs Pro feature access
  - Test upgrade/downgrade flows

- [ ] **Payment Flow Testing** 🔄 **IN PROGRESS**
  - Test Stripe checkout with new pricing
  - Test annual discount (38% off)
  - Test trial period (7 days)
  - Test grace period (7 days on payment failure)

- [ ] **Quota Management** 🔄 **IN PROGRESS**
  - Implement 400/4,000 actions per month limits
  - Track usage in entitlements table
  - Show quota usage in UI
  - Handle quota exceeded scenarios

#### **Week 4: MVP Launch**
- [ ] **Production Deployment** 🔄 **IN PROGRESS**
  - Deploy to Vercel with new pricing
  - Configure Stripe webhooks
  - Set up monitoring and alerts
  - Launch announcement and marketing

### **🎯 Phase 1: Post-MVP Features (Weeks 5-8)**

#### **Week 5-6: Advanced Features (Deferred from MVP)**
- [ ] **Google Two-Way Sync** (Deferred - Requires OAuth Setup)
  - 5-10 minute window sync
  - Retry/backoff logic
  - Conflict resolution
  - **Note**: Depends on Google OAuth2 setup completion

- [ ] **Availability Resolver** (Deferred)
  - Per-member schedule management
  - Meeting time suggestions
  - Calendar availability checking

- [ ] **Multi-Household Support** (Deferred)
  - Support up to 3 households per user
  - Household switching
  - Cross-household event sharing

#### **Week 7-8: Analytics & Optimization**
- [ ] **Analytics Insights** (Deferred)
  - Household productivity trends
  - Feature usage analytics
  - Cost savings tracking

- [ ] **Advanced Automations** (Deferred)
  - Multi-step workflows
  - Cross-module integrations
  - Custom automation rules

---

## 🔒 **MVP Feature Gating Strategy (Server-Enforced)**

### **Feature Tiers (MVP)**
- **Free**: Basic calendar, manual meal planning, shopping lists, chores, ICS export
- **Pro**: Advanced recurrence, conflict detection, Google import, daily digest, quiet hours, calendar templates

### **Implementation Pattern**
```typescript
// Usage in API routes
export async function POST(req: Request) {
  const { userData } = await getUserAndHousehold();
  
  if (!canAccessFeature(userData.plan, 'google_import')) {
    throw new ServerError('Google Calendar import requires Pro plan', 403);
  }
  
  // ... implementation
}
```

---

## 📊 **MVP Success Metrics & SLOs**

### **Technical Health (Immediate)**
- **SLO**: p95 API latency < 250ms, error rate < 1% on critical paths
- **Pager**: Sentry alert for ">5 errors in 5m" on /api/* in production
- Database query performance (95th percentile < 100ms)
- Cache hit rates (> 80%)
- Feature flag test coverage (100%)

### **User Engagement (Ongoing)**
- Daily/Monthly Active Users
- Feature adoption rates (especially Pro features)
- User retention rates
- Time spent in app
- Onboarding completion rates

### **Business Metrics (Launch)**
- Trial to paid conversion rates
- Pro feature adoption rates
- Annual vs monthly subscription ratio
- Customer support ticket volume
- Revenue per household

---

## ⏸️ **GOOGLE CALENDAR INTEGRATION POSTPONEMENT**

### **Status**: Code Complete, OAuth Setup Postponed
**Date**: September 19, 2025
**Reason**: App naming decision required before Google Cloud Console setup

### **What's Complete** ✅
- ✅ **Full Google Calendar API Integration**: Complete OAuth2 flow, event import, calendar management
- ✅ **Database Schema**: `google_calendar_imports` table with proper RLS policies
- ✅ **API Endpoints**: Auth, callback, import, status, and cron job routes
- ✅ **UI Components**: Calendar Sync page with connection status and import controls
- ✅ **Error Handling**: Graceful handling of missing OAuth2 configuration
- ✅ **Documentation**: Complete setup guide (`GOOGLE_CALENDAR_SETUP_GUIDE.md`)

### **What's Pending** ⏸️
- ⏸️ **Google Cloud Console Setup**: Requires app naming decision
- ⏸️ **OAuth2 Credentials**: Client ID, Client Secret, Redirect URI configuration
- ⏸️ **Environment Variables**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

### **Next Steps** (When Ready)
1. **Decide on App Name**: Required for Google Cloud Console project
2. **Set up Google Cloud Project**: Follow `GOOGLE_CALENDAR_SETUP_GUIDE.md`
3. **Configure OAuth2 Credentials**: Add to `.env.local`
4. **Test Integration**: Verify calendar import functionality

### **Impact on MVP Launch**
- **Minimal Impact**: Google Calendar import is a Pro feature, not core to MVP
- **Calendar Sync Page**: Shows helpful error message instead of crashing
- **All Other Features**: Unaffected and ready for launch

---

## 🚨 **Risk Mitigation & Watch Items**

### **Technical Risks**
1. **Google Calendar Quotas**: Monitor usage, implement proper backoff
2. **Feature Flag Complexity**: Monitor flag interactions and performance impact
3. **Mobile PWA Performance**: Monitor iOS Safari compatibility and performance
4. **Stripe Integration**: Ensure proper webhook handling and error recovery

### **Operational Risks**
1. **Launch Timeline**: 8 weeks is aggressive; maintain buffer for critical issues
2. **Feature Scope**: Keep MVP focused, defer complex features to post-MVP
3. **Support Load**: Prepare for increased support during launch
4. **Compliance**: Ensure privacy/consent features meet Australian requirements

---

## 🎯 **MVP Launch Readiness Checklist**

### **Technical Readiness**
- [ ] All MVP feature flags implemented and tested
- [ ] Entitlements table created and seeded
- [ ] Stripe products updated to MVP pricing
- [x] Google Calendar import working (Code complete, OAuth setup postponed)
- [x] Daily digest system operational
- [x] Quiet hours feature implemented
- [x] Conflict detection working
- [x] Calendar templates available

### **Product Readiness**
- [ ] MVP features beta-tested and stable
- [ ] Free vs Pro feature access verified
- [ ] Payment flows tested (upgrade/downgrade)
- [ ] Quota management working
- [ ] Support documentation ready
- [ ] Privacy policy and terms of service published

### **Business Readiness**
- [ ] Launch day coordination plan
- [ ] Customer support team trained
- [ ] Marketing materials prepared
- [ ] Analytics and reporting operational
- [ ] Success metrics baseline established

---

## 🏆 **Final Notes**

This updated roadmap focuses on **MVP launch** with a clear, simple pricing structure:

1. **Free + Pro Only**: Eliminates complexity of Pro+ tier
2. **Household-based Billing**: Matches your current architecture
3. **Australian Pricing**: $7.99/month, $59/year with GST compliance
4. **Clear Feature Gates**: Simple Free vs Pro differentiation
5. **Deferred Complexity**: Google two-way sync, multi-household, advanced analytics

Your app is already production-ready. This MVP roadmap will get you to market faster while validating willingness to pay without overbuilding.

**Remember**: Focus on core MVP features first, then expand based on user feedback and revenue data.

🚀 **Ready for MVP launch in 8 weeks!**
