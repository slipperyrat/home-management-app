// Centralized Zod validation schemas
// Use these in all API routes for consistent validation

import { z } from 'zod';

// Common field validators
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const nonEmptyStringSchema = z.string().min(1).max(500);
export const positiveNumberSchema = z.number().positive();
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

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
  assigned_to: uuidSchema.nullable().optional(), // Allow null values
  due_at: z.string().optional(), // Allow any string format, we'll validate in the API
  category: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  household_id: uuidSchema.optional(), // Made optional since it comes from user context
  // Recurrence fields
  rrule: z.string().optional(), // iCal RRULE string
  dtstart: z.string().optional(), // Allow any string format, we'll validate in the API
  // AI and assignment fields
  ai_difficulty_rating: z.number().min(0).max(100).optional(),
  ai_estimated_duration: z.number().min(1).max(1440).optional(), // minutes
  ai_preferred_time: z.string().max(50).optional(),
  ai_energy_level: z.enum(['low', 'medium', 'high']).optional(),
  ai_skill_requirements: z.array(z.string()).optional(),
  assignment_strategy: z.enum(['auto', 'round_robin', 'fairness', 'manual']).optional(),
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
  title: nonEmptyStringSchema.max(100),
  amount: positiveNumberSchema,
  currency: z.string().length(3).default('AUD'),
  due_date: dateStringSchema,
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  household_id: uuidSchema,
  provider: z.string().max(100).optional(),
  bill_number: z.string().max(50).optional(),
});

export const updateBillSchema = z.object({
  id: uuidSchema,
  title: nonEmptyStringSchema.max(100).optional(),
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

// Recipe input schema for frontend (accepts strings that get parsed)
export const createRecipeInputSchema = z.object({
  title: nonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  ingredients: z.string().min(1), // Accept string input from frontend
  instructions: z.string().min(1), // Accept string input from frontend
  prep_time: z.number().min(0).max(480), // 0-8 hours in minutes
  cook_time: z.number().min(0).max(480),
  servings: z.number().min(1).max(50),
  tags: z.array(z.string().max(50)).optional(),
  household_id: uuidSchema.optional(), // Made optional since it comes from user context
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
  plan: z.enum(['free', 'pro', 'pro_plus']).default('free'),
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

// Missing schemas for API routes
export const addRecipeIngredientsSchema = z.object({
  recipe_id: uuidSchema,
  household_id: uuidSchema,
  list_id: uuidSchema.optional(), // If not provided, will create new list
});

export const addRecipeIngredientsAutoSchema = z.object({
  recipe_id: uuidSchema,
  household_id: uuidSchema,
  auto_confirm: z.boolean().optional(),
  source_meal_plan: z.object({
    week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    day: z.string(),
    slot: z.enum(['breakfast', 'lunch', 'dinner'])
  }).optional(),
});

export const confirmAutoAddedSchema = z.object({
  item_ids: z.array(uuidSchema).min(1),
  action: z.enum(['confirm', 'remove']),
});

export const mealPlannerAssignSchema = z.object({
  week: dateStringSchema, // Changed from week_start to week to match frontend
  day: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
  slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']), // Changed from meal_type to slot to match frontend
  recipe_id: uuidSchema.optional(),
  notes: z.string().max(500).optional(),
  alsoAddToList: z.boolean().optional(),
  autoConfirm: z.boolean().optional(),
  household_id: uuidSchema,
});

export const mealPlannerCopySchema = z.object({
  from_week: dateStringSchema,
  to_week: dateStringSchema,
  household_id: uuidSchema,
});

export const mealPlannerClearSchema = z.object({
  week_start: dateStringSchema,
  household_id: uuidSchema,
});

export const claimRewardSchema = z.object({
  reward_id: uuidSchema,
  household_id: uuidSchema,
  quantity: z.number().min(1).max(10).default(1),
});

export const createRewardSchema = z.object({
  name: nonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  points_cost: positiveNumberSchema,
  household_id: uuidSchema,
  created_by: uuidSchema,
  max_redemptions: z.number().min(1).max(1000).optional(),
  is_active: z.boolean().default(true),
});

export const updatePlanSchema = z.object({
  plan: z.enum(['free', 'pro', 'pro_plus']),
  household_id: uuidSchema,
});

export const updateGameModeSchema = z.object({
  game_mode: z.enum(['single', 'couple', 'family', 'roommates', 'custom']),
  household_id: uuidSchema,
});

export const notificationSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  household_id: uuidSchema,
});

export const notificationSendSchema = z.object({
  user_id: uuidSchema,
  title: nonEmptyStringSchema.max(100),
  body: nonEmptyStringSchema.max(500),
  data: z.record(z.any()).optional(),
  household_id: uuidSchema,
});

export const notificationSettingsSchema = z.object({
  email_notifications: z.boolean().default(true),
  push_notifications: z.boolean().default(true),
  household_id: uuidSchema,
});

export const automationDispatchSchema = z.object({
  rule_id: uuidSchema,
  trigger_data: z.record(z.any()),
  household_id: uuidSchema,
});

export const aiProcessEmailSchema = z.object({
  email_content: nonEmptyStringSchema.max(10000),
  email_metadata: z.object({
    from: emailSchema,
    subject: z.string().max(200).optional(),
    date: dateStringSchema.optional(),
  }).optional(),
  household_id: uuidSchema,
});

export const aiCorrectionSchema = z.object({
  suggestion_id: uuidSchema,
  correction_type: z.enum(['reject', 'modify', 'accept']),
  feedback: z.string().max(1000).optional(),
  corrected_data: z.record(z.any()).optional(),
  household_id: uuidSchema,
});

export const aiChoreAssignmentSchema = z.object({
  chore_id: uuidSchema,
  assigned_to: uuidSchema,
  reason: z.string().max(500).optional(),
  household_id: uuidSchema,
});

export const onboardingHouseholdSchema = z.object({
  name: nonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  plan: z.enum(['free', 'pro', 'pro_plus']).default('free'),
  game_mode: z.enum(['single', 'couple', 'family', 'roommates', 'custom']).default('family'),
});

export const onboardingCompleteSchema = z.object({
  household_id: uuidSchema,
  onboarding_steps: z.array(z.string()),
});

export const setRoleSchema = z.object({
  user_id: uuidSchema,
  role: z.enum(['owner', 'member']),
  household_id: uuidSchema,
});

export const syncUserSchema = z.object({
  user_id: uuidSchema,
  household_id: uuidSchema,
  sync_data: z.record(z.any()),
});

export const plannerCreateSchema = z.object({
  title: nonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  date: dateStringSchema,
  household_id: uuidSchema,
  category: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export const plannerUpdateSchema = z.object({
  id: uuidSchema,
  title: nonEmptyStringSchema.max(100).optional(),
  description: z.string().max(500).optional(),
  date: dateStringSchema.optional(),
  category: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
});

export const calendarEventSchema = z.object({
  title: nonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  start_date: dateStringSchema,
  end_date: dateStringSchema.optional(),
  household_id: uuidSchema,
  category: z.string().max(50).optional(),
  rrule: z.string().optional(),
  dtstart: dateStringSchema.optional(),
});

export const calendarEventUpdateSchema = z.object({
  id: uuidSchema,
  title: nonEmptyStringSchema.max(100).optional(),
  description: z.string().max(500).optional(),
  start_date: dateStringSchema.optional(),
  end_date: dateStringSchema.optional(),
  category: z.string().max(50).optional(),
  rrule: z.string().optional(),
  dtstart: dateStringSchema.optional(),
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
  addRecipeIngredients: addRecipeIngredientsSchema,
  
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
  mealPlannerAssign: mealPlannerAssignSchema,
  mealPlannerCopy: mealPlannerCopySchema,
  mealPlannerClear: mealPlannerClearSchema,
  
  // Recipes
  createRecipe: createRecipeSchema,
  updateRecipe: updateRecipeSchema,
  
  // User and Household
  updateUserRole: updateUserRoleSchema,
  createHousehold: createHouseholdSchema,
  onboardingHousehold: onboardingHouseholdSchema,
  onboardingComplete: onboardingCompleteSchema,
  setRole: setRoleSchema,
  syncUser: syncUserSchema,
  
  // Rewards
  claimReward: claimRewardSchema,
  createReward: createRewardSchema,
  
  // Plans and Game Mode
  updatePlan: updatePlanSchema,
  updateGameMode: updateGameModeSchema,
  
  // Notifications
  notificationSubscribe: notificationSubscribeSchema,
  notificationSend: notificationSendSchema,
  notificationSettings: notificationSettingsSchema,
  
  // AI and Automation
  createAutomationRule: createAutomationRuleSchema,
  automationDispatch: automationDispatchSchema,
  aiProcessEmail: aiProcessEmailSchema,
  aiCorrection: aiCorrectionSchema,
  aiChoreAssignment: aiChoreAssignmentSchema,
  
  // Planner
  plannerCreate: plannerCreateSchema,
  plannerUpdate: plannerUpdateSchema,
  
  // Calendar
  calendarEvent: calendarEventSchema,
  calendarEventUpdate: calendarEventUpdateSchema,
  
  // Generic
  pagination: paginationSchema,
  householdFilter: householdFilterSchema,
};
