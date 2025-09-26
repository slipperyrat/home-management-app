# System Restoration Plan

## 🚨 **CRITICAL SYSTEMS TEMPORARILY DISABLED**

During troubleshooting, we disabled several important systems to get the app working. Here's the comprehensive plan to restore them:

## 📋 **Systems That Need Restoration**

### 1. **Rate Limiting System** ⚠️ HIGH PRIORITY
- **Status**: Disabled in `src/lib/security/apiProtection.ts`
- **Issue**: Missing `rate_limits` table causing database errors
- **Solution**: 
  - Create `rate_limits` table in Supabase
  - Re-enable rate limiting with proper error handling
  - Add fallback behavior for missing tables

### 2. **Performance Monitoring** ⚠️ HIGH PRIORITY
- **Status**: Disabled in `src/lib/monitoring/index.ts`
- **Issue**: Causing ECONNRESET errors
- **Solution**:
  - Fix periodic flush mechanism
  - Add proper error handling
  - Reduce monitoring frequency

### 3. **Heartbeat System** ⚠️ MEDIUM PRIORITY
- **Status**: Disabled in `src/components/HeartbeatProvider.tsx`
- **Issue**: Event listener cleanup problems
- **Solution**:
  - Fix event listener references
  - Add proper cleanup
  - Reduce heartbeat frequency

### 4. **Sentry Error Tracking** ⚠️ MEDIUM PRIORITY
- **Status**: Disabled in `src/instrumentation.ts` and `src/instrumentation-client.ts`
- **Issue**: Causing timeout errors
- **Solution**:
  - Re-enable with proper configuration
  - Add error boundaries
  - Configure for development vs production

### 5. **Vercel Analytics** ⚠️ LOW PRIORITY
- **Status**: Disabled in `src/app/layout.tsx`
- **Issue**: Additional monitoring calls
- **Solution**:
  - Re-enable with proper configuration
  - Add development mode checks

### 6. **Today View** ⚠️ MEDIUM PRIORITY
- **Status**: Disabled in `src/components/TodayView.tsx`
- **Issue**: API calls causing issues
- **Solution**:
  - Re-enable with proper error handling
  - Add loading states
  - Implement retry logic

### 7. **Content Security Policy** ⚠️ HIGH PRIORITY
- **Status**: Disabled in `src/middleware.ts`
- **Issue**: Blocking Clerk scripts
- **Solution**:
  - Re-enable with proper Clerk domains
  - Add `clerk.accounts.dev` to allowed domains
  - Test thoroughly

### 8. **Automation Dispatch** ⚠️ LOW PRIORITY
- **Status**: Disabled in `src/lib/postEvent.ts`
- **Issue**: Additional API calls
- **Solution**:
  - Re-enable with proper error handling
  - Add rate limiting
  - Implement queue system

## 🔧 **Restoration Strategy**

### **Phase 1: Critical Security & Performance** (Immediate)
1. **Rate Limiting**: Create database table, re-enable with fallbacks
2. **CSP**: Re-enable with proper Clerk domains
3. **Performance Monitoring**: Fix and re-enable with error handling

### **Phase 2: Core Functionality** (Next)
1. **Today View**: Re-enable with proper error handling
2. **Heartbeat System**: Fix event listeners and re-enable
3. **Sentry**: Re-enable with proper configuration

### **Phase 3: Analytics & Automation** (Later)
1. **Vercel Analytics**: Re-enable with dev/prod checks
2. **Automation Dispatch**: Re-enable with queue system

## 🛠️ **Implementation Steps**

### **Step 1: Database Setup**
```sql
-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint, window_start)
);
```

### **Step 2: Re-enable Rate Limiting**
- Uncomment rate limiting code in `apiProtection.ts`
- Add fallback behavior for missing tables
- Test with proper error handling

### **Step 3: Re-enable CSP**
- Uncomment CSP code in `middleware.ts`
- Ensure `clerk.accounts.dev` is in allowed domains
- Test authentication flow

### **Step 4: Re-enable Monitoring**
- Uncomment monitoring code in `monitoring/index.ts`
- Add proper error handling
- Reduce monitoring frequency

### **Step 5: Re-enable Heartbeat**
- Uncomment heartbeat code in `HeartbeatProvider.tsx`
- Fix event listener cleanup
- Add proper error handling

### **Step 6: Re-enable Sentry**
- Uncomment Sentry code in instrumentation files
- Configure for development environment
- Add error boundaries

### **Step 7: Re-enable Today View**
- Uncomment Today View code
- Add proper error handling and loading states
- Implement retry logic

### **Step 8: Re-enable Analytics & Automation**
- Uncomment Vercel Analytics
- Uncomment automation dispatch
- Add proper error handling

## 🧪 **Testing Strategy**

### **After Each Step:**
1. Test authentication flow
2. Test digest preferences page
3. Check browser console for errors
4. Monitor server logs
5. Verify no ECONNRESET errors

### **Final Integration Test:**
1. All systems enabled
2. Full user journey test
3. Performance monitoring
4. Error tracking
5. Rate limiting verification

## ⚠️ **Risk Mitigation**

- **Gradual Restoration**: Enable one system at a time
- **Fallback Behavior**: Each system should have fallbacks
- **Error Handling**: Proper error handling for all systems
- **Monitoring**: Watch for issues after each restoration
- **Rollback Plan**: Ability to quickly disable problematic systems

## 📊 **Success Criteria**

- ✅ All systems re-enabled and working
- ✅ No ECONNRESET errors
- ✅ Authentication working perfectly
- ✅ Digest preferences working
- ✅ Performance monitoring active
- ✅ Error tracking functional
- ✅ Rate limiting protecting APIs
- ✅ CSP protecting the app

## 🎯 **Timeline**

- **Phase 1**: 1-2 hours (Critical systems)
- **Phase 2**: 2-3 hours (Core functionality)
- **Phase 3**: 1-2 hours (Analytics & automation)
- **Total**: 4-7 hours for complete restoration

This plan ensures we restore all systems safely while maintaining the working state we achieved.
