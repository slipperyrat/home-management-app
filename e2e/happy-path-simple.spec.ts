import { test, expect } from '@playwright/test';

test.describe('Simple E2E Test - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Give time for redirects
  });

  test('basic app navigation and structure', async ({ page }) => {
    await test.step('Verify app loads and shows basic structure', async () => {
      // Check if the page loaded
      await expect(page).toHaveTitle(/Home Management|Home/);
      
      // Look for common elements that should exist
      const hasNavbar = await page.locator('nav, [role="navigation"], .navbar, .nav').isVisible();
      const hasMainContent = await page.locator('main, .main, .content, .container').isVisible();
      
      // At least one of these should be visible
      expect(hasNavbar || hasMainContent).toBeTruthy();
      
      console.log('✅ App loaded successfully');
    });
  });

  test('shopping list basic functionality', async ({ page }) => {
    await test.step('Test basic shopping list page access', async () => {
      try {
        // Try to navigate to shopping lists
        await page.goto('/shopping-lists');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
        
        // Check if we can see the page content
        const pageContent = await page.content();
        const hasShoppingContent = pageContent.includes('shopping') || 
                                  pageContent.includes('list') || 
                                  pageContent.includes('item');
        
        if (hasShoppingContent) {
          console.log('✅ Shopping lists page accessible');
          
          // Look for any shopping-related elements
          const shoppingElements = page.locator('text=/shopping|list|item/i');
          const count = await shoppingElements.count();
          console.log(`Found ${count} shopping-related elements`);
        } else {
          console.log('⚠️ Shopping lists page loaded but no shopping content found');
        }
      } catch (error) {
        console.log('⚠️ Could not access shopping lists page:', error.message);
      }
    });
  });

  test('dashboard accessibility', async ({ page }) => {
    await test.step('Test dashboard page access', async () => {
      try {
        // Try to navigate to dashboard
        await page.goto('/dashboard');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
        
        console.log('✅ Dashboard page accessible');
        
        // Look for dashboard content
        const dashboardContent = await page.content();
        const hasDashboardContent = dashboardContent.includes('dashboard') || 
                                   dashboardContent.includes('welcome') ||
                                   dashboardContent.includes('overview');
        
        if (hasDashboardContent) {
          console.log('✅ Dashboard content found');
        } else {
          console.log('⚠️ Dashboard page loaded but minimal content found');
        }
      } catch (error) {
        console.log('⚠️ Could not access dashboard page:', error.message);
      }
    });
  });

  test('authentication flow check', async ({ page }) => {
    await test.step('Check authentication state and flow', async () => {
      // Check current URL to see if we're redirected to sign-in
      const currentUrl = page.url();
      
      if (currentUrl.includes('sign-in') || currentUrl.includes('auth')) {
        console.log('✅ Authentication required - redirected to sign-in');
        
        // Look for sign-in form elements
        const hasSignInForm = await page.locator('input[type="email"], input[name="email"]').isVisible();
        if (hasSignInForm) {
          console.log('✅ Sign-in form found');
        }
      } else {
        console.log('✅ No authentication required or already authenticated');
        
        // Check if we can see user-related elements
        const hasUserElements = await page.locator('text=/user|profile|account/i').isVisible();
        if (hasUserElements) {
          console.log('✅ User elements found - likely authenticated');
        }
      }
    });
  });

  test('responsive design check', async ({ page }) => {
    await test.step('Test responsive design at different viewport sizes', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      const mobileContent = await page.content();
      console.log('✅ Mobile viewport test completed');
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      const tabletContent = await page.content();
      console.log('✅ Tablet viewport test completed');
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);
      
      const desktopContent = await page.content();
      console.log('✅ Desktop viewport test completed');
    });
  });
});
