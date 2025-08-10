import { z } from 'zod';

// Recipe validation schemas
export const IngredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required').max(50, 'Ingredient name too long'),
  amount: z.number().positive('Amount must be positive'),
  unit: z.string().max(20, 'Unit name too long'),
  category: z.string().max(30, 'Category name too long').optional(),
});

export const CreateRecipeSchema = z.object({
  title: z.string().min(1, 'Recipe title is required').max(100, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
  ingredients: z.array(IngredientSchema).min(1, 'At least one ingredient is required'),
  instructions: z.array(z.string().min(1, 'Instruction cannot be empty')).min(1, 'At least one instruction is required'),
  prep_time: z.number().int().min(0).max(1440, 'Prep time must be between 0-1440 minutes'),
  cook_time: z.number().int().min(0).max(1440, 'Cook time must be between 0-1440 minutes'),
  servings: z.number().int().min(1).max(50, 'Servings must be between 1-50'),
  tags: z.array(z.string()).optional(),
  image_url: z.string().url().optional(),
});

export const UpdateRecipeSchema = CreateRecipeSchema.partial();

// Meal planner validation schemas
export const AssignMealSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid week format (YYYY-MM-DD)'),
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  slot: z.enum(['breakfast', 'lunch', 'dinner']),
  recipe_id: z.string().uuid('Invalid recipe ID').nullable(),
  alsoAddToList: z.boolean().optional(),
});

export const GetMealPlanSchema = z.object({
  household_id: z.string().uuid('Invalid household ID').optional(),
  week_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

// Planner validation schemas
export const CreatePlannerItemSchema = z.object({
  category: z.string().min(1, 'Category is required').max(50, 'Category too long'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  status: z.enum(['planning', 'in_progress', 'completed', 'cancelled']).default('planning'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
});

export const UpdatePlannerItemSchema = CreatePlannerItemSchema.partial();

// Shopping list validation schemas
export const AddRecipeIngredientsSchema = z.object({
  recipe_id: z.string().uuid('Invalid recipe ID'),
});

// Generic validation helpers
export const UUIDSchema = z.string().uuid('Invalid UUID format');
export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

// Validation middleware helper
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError && error.issues) {
      const errorMessage = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return { success: false, error: errorMessage };
    }
    return { success: false, error: 'Validation failed' };
  }
}

// API response helpers
export function createValidationErrorResponse(error: string) {
  return Response.json(
    { error: 'Validation Error', details: error },
    { status: 400 }
  );
}

export function createSuccessResponse<T>(data: T, status: number = 200) {
  return Response.json(data, { status });
}
