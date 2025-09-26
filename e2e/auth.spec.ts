import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display sign-in page when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Give time for redirects
    
    // Should either redirect to sign-in or show sign-in elements
    const currentUrl = page.url();
    if (currentUrl.includes('/sign-in')) {
      await expect(page).toHaveURL(/sign-in/);
    } else {
      // If not redirected, look for Clerk sign-in elements on the page
      await expect(page.locator('[data-clerk-element="signIn"], .cl-signIn')).toBeVisible();
    }
  });

  test('should display home page for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Give time for redirects
    
    // Should show loading state initially
    await expect(page.locator('text=Loading...')).toBeVisible();
    
    // Wait a bit for potential redirect
    await page.waitForTimeout(2000);
    
    // Check if we're redirected to sign-in or still on home page
    const currentUrl = page.url();
    if (currentUrl.includes('/sign-in')) {
      await expect(page).toHaveURL(/sign-in/);
    } else {
      // If not redirected, the home page should show loading state
      await expect(page.locator('text=Loading...')).toBeVisible();
    }
  });

  test('should handle navigation correctly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load and any redirects
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    // Should have proper meta tags
    await expect(page).toHaveTitle(/Home Management/);
    
    // Check if we're on sign-in page (expected for unauthenticated users)
    const currentUrl = page.url();
    if (currentUrl.includes('/sign-in')) {
      // On sign-in page, look for Clerk elements
      await expect(page.locator('[data-clerk-element="signIn"], .cl-signIn')).toBeVisible();
    } else {
      // On home page, look for navigation
      await expect(page.locator('nav')).toBeVisible();
    }
  });
});
