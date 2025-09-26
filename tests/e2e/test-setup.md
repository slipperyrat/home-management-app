# 🧪 E2E Test Setup Guide

## 📋 **Prerequisites**

1. **Playwright is installed** (should already be in your package.json)
2. **Test environment variables are set**
3. **Test data is seeded in Supabase**

## 🚀 **Setup Steps**

### **Step 1: Set Environment Variables**

Create a `.env.test` file in your project root:

```bash
# Test user credentials
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-test-password

# Test database connection (if needed)
TEST_SUPABASE_URL=your-supabase-url
TEST_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### **Step 2: Seed Test Data**

1. **Open Supabase SQL Editor**
2. **Run the seed script**: Copy and paste the contents of `scripts/seed-test-data.sql`
3. **Verify data was created**: The script will show counts for each table

### **Step 3: Run E2E Tests**

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e tests/e2e/happy-path.spec.ts

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run tests with UI
npm run test:e2e:ui
```

## 🧪 **Test Structure**

### **Main Test: Happy Path**
- **Sign in** → **Navigate to shopping lists** → **Create list** → **Add item** → **Complete item** → **Verify XP update**

### **Additional Tests**
- **Shopping list CRUD operations**
- **Household management flow**

## 🔧 **Troubleshooting**

### **Common Issues**

1. **"Element not found" errors**
   - Check if your app's UI elements match the selectors in the test
   - Update selectors to match your actual UI

2. **Authentication failures**
   - Verify test user credentials
   - Check if Clerk test mode is enabled

3. **Test data not found**
   - Re-run the seed script
   - Check if RLS policies allow test user access

### **Debug Mode**

Run tests in headed mode to see what's happening:

```bash
npm run test:e2e:headed
```

## 📊 **Test Results**

Tests will output:
- ✅ **Passed**: All steps completed successfully
- ❌ **Failed**: Step failed (with screenshot and error details)
- ⚠️ **Skipped**: Step not applicable (e.g., already signed in)

## 🎯 **Next Steps After Setup**

1. **Run the happy path test** to verify everything works
2. **Add more specific tests** for your app's features
3. **Integrate with CI/CD** for automated testing
4. **Add visual regression tests** for UI consistency

## 📝 **Customizing Tests**

### **Add Your Own Test**

```typescript
test('my custom feature test', async ({ page }) => {
  await test.step('Step description', async () => {
    // Your test logic here
    await page.goto('/your-feature');
    // ... more steps
  });
});
```

### **Update Selectors**

If your UI elements have different names or attributes, update the selectors in the test file to match your actual implementation.
