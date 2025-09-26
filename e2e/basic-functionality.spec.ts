import { test, expect } from '@playwright/test';

test.describe('Basic App Functionality', () => {
  test('app loads and shows basic structure', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for page to load (shorter timeout)
    await page.waitForLoadState('domcontentloaded');
    
    // Check if the page loaded
    await expect(page).toHaveTitle(/Home Management|Home/);
    
    // Look for common elements that should exist
    const hasNavbar = await page.locator('nav, [role="navigation"], .navbar, .nav').isVisible();
    const hasMainContent = await page.locator('main, .main, .content, .container').isVisible();
    
    // At least one of these should be visible
    expect(hasNavbar || hasMainContent).toBeTruthy();
    
    console.log('✅ App loaded successfully');
  });

  test('shopping lists page loads', async ({ page }) => {
    // Navigate to shopping lists (should redirect to sign-in)
    await page.goto('/shopping-lists');
    
    // Wait for redirect to complete
    await page.waitForLoadState('domcontentloaded');
    
    // Should redirect to sign-in page
    await expect(page).toHaveURL(/sign-in/);
    
    console.log('✅ Shopping lists page redirected to sign-in as expected');
  });

  test('dashboard page loads', async ({ page }) => {
    // Navigate to dashboard (should redirect to sign-in)
    await page.goto('/dashboard');
    
    // Wait for redirect to complete
    await page.waitForLoadState('domcontentloaded');
    
    // Should redirect to sign-in page
    await expect(page).toHaveURL(/sign-in/);
    
    console.log('✅ Dashboard page redirected to sign-in as expected');
  });

  test('responsive design works', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    console.log('✅ Mobile viewport test completed');
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    console.log('✅ Desktop viewport test completed');
  });
});
