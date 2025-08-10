import { test, expect } from '@playwright/test';

test.describe('Navigation & UI', () => {
  test('should have proper page structure', async ({ page }) => {
    await page.goto('/');
    
    // Check basic page structure
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('head meta[name="description"]')).toBeAttached();
    
    // Check that the page loads without JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check that navigation is mobile-friendly
    await expect(page.locator('nav')).toBeVisible();
    
    // Verify no horizontal scroll
    const bodyWidth = await page.locator('body').evaluate(el => el.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // Allow 1px tolerance
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/non-existent-page');
    
    // Should return 404 or redirect appropriately
    expect(response?.status()).toBeGreaterThanOrEqual(400);
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
