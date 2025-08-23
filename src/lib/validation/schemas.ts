// Centralized Zod validation schemas
// Use these in all API routes for consistent validation

import { z } from 'zod';

// Common field validators
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const nonEmptyStringSchema = z.string().min(1).max(500);
export const positiveNumberSchema = z.number().positive();
export const dateStringSchema = z.string().datetime();

// Shopping Lists
export const createShoppingListSchema = z.object({
  name: nonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  household_id: uuidSchema,
});

export const updateShoppingListSchema = z.object({
  id: uuidSchema,
  name: nonEmptyStringSchema.max(100).optional(),
  description: z.string().max(500).optional(),
});

export const deleteShoppingListSchema = z.object({
  id: uuidSchema,
});

// Shopping Items
export const createShoppingItemSchema = z.object({
  list_id: uuidSchema,
  name: nonEmptyStringSchema.max(100),
  quantity: z.number().min(1).max(999).optional(),
  unit: z.string().max(20).optional(),
  category: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

export const updateShoppingItemSchema = z.object({
  id: uuidSchema,
  name: nonEmptyStringSchema.max(100).optional(),
  quantity: z.number().min(1).max(999).optional(),
  unit: z.string().max(20).optional(),
  category: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  is_complete: z.boolean().optional(),
});

export const toggleShoppingItemSchema = z.object({
  id: uuidSchema,
  is_complete: z.boolean(),
});

// Chores
export const createChoreSchema = z.object({
  title: nonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  assigned_to: uuidSchema.optional(),
  due_at: dateStringSchema.optional(),
  category: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  household_id: uuidSchema,
  // Recurrence fields
  rrule: z.string().optional(), // iCal RRULE string
  dtstart: dateStringSchema.optional(), // Start date for recurrence
});

export const updateChoreSchema = z.object({
  id: uuidSchema,
  title: nonEmptyStringSchema.max(100).optional(),
  description: z.string().max(500).optional(),
  assigned_to: uuidSchema.optional(),
  due_at: dateStringSchema.optional(),
  category: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'skipped']).optional(),
  rrule: z.string().optional(),
  dtstart: dateStringSchema.optional(),
});

export const completeChoreSchema = z.object({
  id: uuidSchema,
  completed_by: uuidSchema,
  completion_notes: z.string().max(500).optional(),
});

// Bills
export const createBillSchema = z.object({
  name: nonEmptyStringSchema.max(100),
  amount: positiveNumberSchema,
  currency: z.string().length(3).default('AUD'),
  due_date: dateStringSchema,
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  household_id: uuidSchema,
  provider: z.string().max(100).optional(),
  bill_number: z.string().max(50).optional(),
});

export const updateBillSchema = z.object({
  id: uuidSchema,
  name: nonEmptyStringSchema.max(100).optional(),
  amount: positiveNumberSchema.optional(),
  currency: z.string().length(3).optional(),
  due_date: dateStringSchema.optional(),
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  provider: z.string().max(100).optional(),
  bill_number: z.string().max(50).optional(),
});

export const markBillPaidSchema = z.object({
  id: uuidSchema,
  paid_amount: positiveNumberSchema.optional(),
  paid_date: dateStringSchema.optional(),
  payment_method: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
});

// Meal Planning
export const createMealPlanSchema = z.object({
  week_start: dateStringSchema,
  household_id: uuidSchema,
  meals: z.array(z.object({
    day: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
    meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    recipe_id: uuidSchema.optional(),
    notes: z.string().max(500).optional(),
  })),
});

export const assignRecipeSchema = z.object({
  week: dateStringSchema,
  day: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
  slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  recipe_id: uuidSchema,
  alsoAddToList: z.boolean().optional(),
});

// Recipes
export const createRecipeSchema = z.object({
  title: nonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  ingredients: z.array(z.object({
    name: nonEmptyStringSchema.max(100),
    amount: positiveNumberSchema,
    unit: z.string().max(20),
    category: z.string().max(50).optional(),
  })),
  instructions: z.array(nonEmptyStringSchema.max(500)),
  prep_time: z.number().min(0).max(480), // 0-8 hours in minutes
  cook_time: z.number().min(0).max(480),
  servings: z.number().min(1).max(50),
  tags: z.array(z.string().max(50)).optional(),
  household_id: uuidSchema,
});

export const updateRecipeSchema = z.object({
  id: uuidSchema,
  title: nonEmptyStringSchema.max(100).optional(),
  description: z.string().max(500).optional(),
  ingredients: z.array(z.object({
    name: nonEmptyStringSchema.max(100),
    amount: positiveNumberSchema,
    unit: z.string().max(20),
    category: z.string().max(50).optional(),
  })).optional(),
  instructions: z.array(nonEmptyStringSchema.max(500)).optional(),
  prep_time: z.number().min(0).max(480).optional(),
  cook_time: z.number().min(0).max(480).optional(),
  servings: z.number().min(1).max(50).optional(),
  tags: z.array(z.string().max(50)).optional(),
});

// User and Household
export const updateUserRoleSchema = z.object({
  user_id: uuidSchema,
  role: z.enum(['owner', 'member']),
  household_id: uuidSchema,
});

export const createHouseholdSchema = z.object({
  name: nonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  plan: z.enum(['free', 'premium', 'pro']).default('free'),
  game_mode: z.enum(['single', 'couple', 'family', 'roommates', 'custom']).default('family'),
});

// AI and Automation
export const createAutomationRuleSchema = z.object({
  name: nonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  trigger_types: z.array(z.string()),
  actions: z.array(z.object({
    name: z.string(),
    params: z.record(z.any()),
  })),
  is_active: z.boolean().default(true),
  household_id: uuidSchema,
});

// Generic query parameters
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const householdFilterSchema = z.object({
  household_id: uuidSchema,
});

// Export all schemas
export const schemas = {
  // Shopping
  createShoppingList: createShoppingListSchema,
  updateShoppingList: updateShoppingListSchema,
  deleteShoppingList: deleteShoppingListSchema,
  createShoppingItem: createShoppingItemSchema,
  updateShoppingItem: updateShoppingItemSchema,
  toggleShoppingItem: toggleShoppingItemSchema,
  
  // Chores
  createChore: createChoreSchema,
  updateChore: updateChoreSchema,
  completeChore: completeChoreSchema,
  
  // Bills
  createBill: createBillSchema,
  updateBill: updateBillSchema,
  markBillPaid: markBillPaidSchema,
  
  // Meal Planning
  createMealPlan: createMealPlanSchema,
  assignRecipe: assignRecipeSchema,
  
  // Recipes
  createRecipe: createRecipeSchema,
  updateRecipe: updateRecipeSchema,
  
  // User and Household
  updateUserRole: updateUserRoleSchema,
  createHousehold: createHouseholdSchema,
  
  // AI and Automation
  createAutomationRule: createAutomationRuleSchema,
  
  // Generic
  pagination: paginationSchema,
  householdFilter: householdFilterSchema,
};
