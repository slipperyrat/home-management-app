import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display sign-in page when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/);
    await expect(page.locator('text=Sign in')).toBeVisible();
  });

  test('should display home page for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    
    // Should show the main landing page
    await expect(page.locator('text=Home Management')).toBeVisible();
  });

  test('should handle navigation correctly', async ({ page }) => {
    await page.goto('/');
    
    // Test navigation menu
    await expect(page.locator('nav')).toBeVisible();
    
    // Should have proper meta tags
    await expect(page).toHaveTitle(/Home Management/);
  });
});
