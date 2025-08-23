import { test, expect } from '@playwright/test';

// Test the critical user flow: sign in → create household → add shopping list → add item → complete item → verify XP
test.describe('Happy Path - Core User Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('Complete user onboarding and shopping flow', async ({ page }) => {
    // Step 1: Sign in (you'll need to set up test credentials)
    await page.goto('/sign-in');
    
    // TODO: Add your test user credentials here
    // await page.fill('[data-testid="email-input"]', 'test@example.com');
    // await page.fill('[data-testid="password-input"]', 'testpassword');
    // await page.click('[data-testid="sign-in-button"]');
    
    // Wait for sign in to complete
    await page.waitForURL('/dashboard');
    
    // Step 2: Create household if not exists
    // This might be part of onboarding or a separate flow
    const householdExists = await page.locator('[data-testid="household-name"]').isVisible();
    
    if (!householdExists) {
      await page.click('[data-testid="create-household-button"]');
      await page.fill('[data-testid="household-name-input"]', 'Test Household');
      await page.selectOption('[data-testid="game-mode-select"]', 'family');
      await page.click('[data-testid="create-household-submit"]');
      
      // Wait for household creation
      await page.waitForSelector('[data-testid="household-name"]');
    }
    
    // Step 3: Navigate to shopping lists
    await page.click('[data-testid="nav-shopping"]');
    await page.waitForURL('/shopping-lists');
    
    // Step 4: Create new shopping list
    await page.click('[data-testid="new-list-button"]');
    await page.fill('[data-testid="list-name-input"]', 'Test Groceries');
    await page.fill('[data-testid="list-description-input"]', 'Weekly groceries');
    await page.click('[data-testid="create-list-submit"]');
    
    // Wait for list creation and redirect
    await page.waitForSelector('[data-testid="shopping-list-title"]');
    
    // Step 5: Add item to shopping list
    await page.fill('[data-testid="add-item-input"]', 'Milk');
    await page.keyboard.press('Enter');
    
    // Verify item was added
    await expect(page.locator('[data-testid="shopping-item"]').filter({ hasText: 'Milk' })).toBeVisible();
    
    // Step 6: Complete the shopping item
    await page.locator('[data-testid="shopping-item"]').filter({ hasText: 'Milk' }).locator('[data-testid="complete-checkbox"]').check();
    
    // Wait for completion animation/update
    await page.waitForTimeout(1000);
    
    // Step 7: Verify XP was awarded
    // Navigate back to dashboard to check XP
    await page.click('[data-testid="nav-dashboard"]');
    await page.waitForURL('/dashboard');
    
    const xpElement = page.locator('[data-testid="xp-total"]');
    await expect(xpElement).toBeVisible();
    
    const xpText = await xpElement.innerText();
    const xpValue = parseInt(xpText, 10);
    
    // XP should be greater than 0 after completing a task
    expect(xpValue).toBeGreaterThan(0);
    
    // Step 8: Verify audit log was created
    // This would require checking the database or an admin endpoint
    // For now, we'll just verify the UI shows the completed state
    
    // Navigate back to shopping list to verify item is marked complete
    await page.click('[data-testid="nav-shopping"]');
    await page.waitForURL('/shopping-lists');
    
    // Click on the test list
    await page.click('[data-testid="shopping-list-title"]');
    
    // Verify the milk item shows as completed
    const milkItem = page.locator('[data-testid="shopping-item"]').filter({ hasText: 'Milk' });
    await expect(milkItem.locator('[data-testid="complete-checkbox"]')).toBeChecked();
  });

  test('Shopping list item completion with undo', async ({ page }) => {
    // This test verifies the undo functionality for completed items
    
    // TODO: Set up test data and user authentication
    await page.goto('/shopping-lists');
    
    // Create or navigate to an existing list
    // Add an item
    // Complete it
    // Undo the completion
    // Verify the item is back to incomplete state
  });

  test('Chore creation and assignment', async ({ page }) => {
    // This test verifies chore creation and assignment flow
    
    // TODO: Set up test data and user authentication
    await page.goto('/chores');
    
    // Create a new chore
    // Assign it to a user
    // Verify assignment
    // Complete the chore
    // Verify XP award
  });

  test('Meal planning basic flow', async ({ page }) => {
    // This test verifies basic meal planning functionality
    
    // TODO: Set up test data and user authentication
    await page.goto('/meal-planner');
    
    // Create a meal plan for the week
    // Add recipes to specific days/meals
    // Verify the plan is saved
    // Test grocery list generation (if premium feature)
  });
});

// Test configuration
test.describe.configure({ mode: 'serial' }); // Run tests in sequence to avoid conflicts

// Test setup and teardown
test.beforeAll(async ({ browser }) => {
  // Set up test data, create test user, etc.
  console.log('Setting up test environment...');
});

test.afterAll(async ({ browser }) => {
  // Clean up test data
  console.log('Cleaning up test environment...');
});
