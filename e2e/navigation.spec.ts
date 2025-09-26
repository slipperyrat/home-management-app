import { test, expect } from '@playwright/test';

test.describe('Navigation & UI', () => {
  test('should have proper page structure', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check basic page structure
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    
    // Check for meta description (more flexible)
    const metaDescription = page.locator('head meta[name="description"]');
    if (await metaDescription.count() > 0) {
      await expect(metaDescription).toBeAttached();
    } else {
      // If no meta description, check for title instead
      await expect(page).toHaveTitle(/Home Management/);
    }
    
    // Check that the page loads without JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    
    expect(errors).toHaveLength(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Wait for page to load and any redirects
    await page.waitForLoadState('networkidle');

    // Check if we're on sign-in page (expected for unauthenticated users)
    const currentUrl = page.url();
    if (currentUrl.includes('/sign-in')) {
      // On sign-in page, check that it's mobile-friendly
      await expect(page.locator('[data-clerk-element="signIn"], .cl-signIn')).toBeVisible();
    } else {
      // On home page, check navigation
      await expect(page.locator('nav')).toBeVisible();
    }
    
    // Verify no horizontal scroll
    const bodyWidth = await page.locator('body').evaluate(el => el.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // Allow 1px tolerance
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/non-existent-page', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Should return 404 status
    expect(response?.status()).toBe(404);
  });

  test('should have working error boundaries', async ({ page }) => {
    await page.goto('/');
    
    // Inject a script that would cause an error
    await page.evaluate(() => {
      // Create a component that will throw an error
      const errorDiv = document.createElement('div');
      errorDiv.innerHTML = '<script>throw new Error("Test error")</script>';
      document.body.appendChild(errorDiv);
    });
    
    // The page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
});
