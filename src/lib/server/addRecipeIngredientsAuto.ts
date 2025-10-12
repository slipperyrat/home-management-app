import { sb } from './supabaseAdmin';
import { logger } from '@/lib/logging/logger';

// Helper to normalize ingredient names for comparison
function normalizeName(name: string): string {
  let normalized = name.toLowerCase().trim();
  // Remove common prefixes/suffixes that don't affect the core item
  normalized = normalized.replace(/^(fresh|dried|chopped|diced|minced|ground|whole|canned|frozen|organic|unsalted|salted)\s+/, '');
  normalized = normalized.replace(/\s+(fresh|dried|chopped|diced|minced|ground|whole|canned|frozen|organic|unsalted|salted)$/, '');
  // Remove parenthetical descriptions
  normalized = normalized.replace(/\s*\(.*\)/, '');
  // Remove trailing 's' for basic pluralization (e.g., "tomatoes" -> "tomato")
  if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

interface ParsedQuantity {
  amount: number | null;
  unit: string | null;
  originalText: string;
}

// Helper to parse quantity from various formats
function parseQuantity(ingredient: unknown): ParsedQuantity {
  if (ingredient && typeof ingredient === 'object') {
    const ingredientRecord = ingredient as Record<string, unknown>;
    // Handle the new format: {id, name, amount, unit, notes}
    if ('name' in ingredientRecord && typeof ingredientRecord.name === 'string' && 'amount' in ingredientRecord) {
      const amount = parseFloat(String(ingredientRecord.amount));
      const unit = String(ingredientRecord.unit ?? '').trim();

      // Handle malformed data where name might be a single letter and unit might contain the real name
      if (ingredientRecord.name.length === 1 && typeof ingredientRecord.unit === 'string' && ingredientRecord.unit.length > 1) {
        // For malformed data, use the unit as the name and default amount to 1
        return {
          amount: 1,
          unit: null,
          originalText: ingredientRecord.unit.trim(),
        };
      }

      return {
        amount: Number.isNaN(amount) ? 1 : amount, // Default to 1 if amount is invalid
        unit: unit || null,
        originalText: `${Number.isNaN(amount) ? 1 : amount} ${unit}`.trim(),
      };
    }

    // Handle old format: {amount, unit}
    const amount = parseFloat(String(ingredientRecord.amount));
    const unit = String(ingredientRecord.unit ?? '').trim();
    return {
      amount: Number.isNaN(amount) ? null : amount,
      unit: unit || null,
      originalText: `${Number.isNaN(amount) ? '' : amount} ${unit}`.trim(),
    };
  }

  if (typeof ingredient === 'string') {
    // Attempt to parse quantity from string (e.g., "2 cups flour", "1 lb chicken")
    const match = ingredient.match(/^(\d+(\.\d+)?)\s*([a-zA-Z]+)?\s*(.*)$/);
    if (match && match[1]) {
      const amount = parseFloat(match[1]);
      const unit = match[3] || null;
      return {
        amount: Number.isNaN(amount) ? null : amount,
        unit: unit ? unit.toLowerCase() : null,
        originalText: ingredient,
      };
    }

    // If no quantity pattern found, treat as just an ingredient name
    return {
      amount: 1, // Default to 1 for simple ingredient names
      unit: null,
      originalText: ingredient,
    };
  }

  return { amount: 1, unit: null, originalText: String(ingredient || '') };
}

// Helper to extract item name from ingredient
function getIngredientName(ingredient: unknown): string {
  if (ingredient && typeof ingredient === 'object' && 'name' in ingredient) {
    const ingredientRecord = ingredient as Record<string, unknown>;
    // Handle malformed data where name might be a single letter and unit might contain the real name
    if (
      typeof ingredientRecord.name === 'string' &&
      ingredientRecord.name.length === 1 &&
      typeof ingredientRecord.unit === 'string' &&
      ingredientRecord.unit.length > 1
    ) {
      // If name is a single letter and unit is longer, use the unit as the name
      return ingredientRecord.unit.trim();
    }
    if (typeof ingredientRecord.name === 'string') {
      return ingredientRecord.name.trim();
    }
  }

  if (typeof ingredient === 'string') {
    // For string ingredients like "2 cups flour", extract the name part
    const match = ingredient.match(/^(\d+(\.\d+)?)\s*([a-zA-Z]+)?\s*(.*)$/);
    if (match && match[4]) {
      return match[4].trim();
    }
    // If no quantity pattern found, return the whole string as the ingredient name
    return ingredient.trim();
  }

  return String(ingredient || '');
}

/**
 * Enhanced version that adds ingredients from a recipe to the household's "Groceries" shopping list
 * with auto-added tracking and confirmation system
 * @param userId - The user ID making the request
 * @param householdId - The household ID
 * @param recipeId - The recipe ID to get ingredients from
 * @param autoConfirm - Whether to auto-confirm the items (default: false)
 * @param sourceMealPlan - Information about where this recipe was assigned
 * @returns Object with success status and detailed counts
 */
export async function addRecipeIngredientsToGroceriesAuto(
  userId: string,
  householdId: string,
  recipeId: string,
  autoConfirm = false,
  sourceMealPlan?: { week: string; day: string; slot: string }
): Promise<{ ok: boolean; added: number; updated: number; pending: number; listId?: string; error?: string }> {
  try {
    logger.info('addRecipeIngredientsToGroceriesAuto called', {
      userId,
      householdId,
      recipeId,
      autoConfirm,
      sourceMealPlan,
    });

    const supabase = sb();
    logger.debug('Supabase client initialized for auto addition');

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('id, ingredients, title')
      .eq('id', recipeId)
      .eq('household_id', householdId)
      .single();

    if (recipeError) {
      logger.error('Error fetching recipe', recipeError, { recipeId, householdId });
      return { ok: false, added: 0, updated: 0, pending: 0, error: recipeError.message };
    }

    logger.info('Recipe fetched for auto addition', { recipeId: recipe.id, title: recipe.title });

    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    logger.debug('Recipe ingredients', { count: ingredients.length, ingredients });
    if (!ingredients.length) {
      logger.warn('No ingredients found in recipe during auto addition', { recipeId: recipe.id });
      return { ok: true, added: 0, updated: 0, pending: 0 };
    }

    const { data: list, error: listError } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('household_id', householdId)
      .eq('title', 'Groceries')
      .maybeSingle();

    if (listError) {
      return { ok: false, added: 0, updated: 0, pending: 0, error: listError.message };
    }

    let listId = list?.id;
    if (!listId) {
      const { data: created, error: createError } = await supabase
        .from('shopping_lists')
        .insert([{ household_id: householdId, title: 'Groceries', created_by: userId, auto_added_items_pending: 0 }])
        .select('id')
        .single();

      if (createError) {
        return { ok: false, added: 0, updated: 0, pending: 0, error: createError.message };
      }

      listId = created.id;
    }

    // Get existing shopping items for this list
    const { data: existingItems, error: existingItemsError } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', listId)
      .eq('is_complete', false);

    if (existingItemsError) {
      return { ok: false, added: 0, updated: 0, pending: 0, error: existingItemsError.message };
    }

    // Create a map of existing items by normalized name
    const existingItemsMap = new Map<string, ShoppingItem>();
    existingItems?.forEach((item) => {
      existingItemsMap.set(normalizeName(item.name), item as ShoppingItem);
    });

    let addedCount = 0;
    let updatedCount = 0;
    let autoAddedCount = 0;
    let pendingConfirmationsCount = 0;

    for (const ingredient of ingredients) {
      logger.debug('Processing ingredient', { ingredient });
      logger.debug('Ingredient type', { type: typeof ingredient });
    logger.debug('Ingredient keys', { keys: Object.keys(ingredient || {}) });
    logger.debug('Ingredient.name', { name: (ingredient as Record<string, unknown>)?.name });
    logger.debug('Ingredient.unit', { unit: (ingredient as Record<string, unknown>)?.unit });
    logger.debug('Ingredient.amount', { amount: (ingredient as Record<string, unknown>)?.amount });

      const parsedIngredient = parseQuantity(ingredient);
      const name = getIngredientName(ingredient);
      const normalizedIngredientName = normalizeName(name);
      logger.debug('Parsed ingredient details', {
        name,
        quantity: parsedIngredient.amount,
        unit: parsedIngredient.unit,
      });
      logger.debug('Normalized ingredient name', { normalizedIngredientName });

      const existingItem = existingItemsMap.get(normalizedIngredientName);

      if (existingItem) {
        if (sourceMealPlan) {
          logger.debug('Merging with existing shopping item for meal planner assignment', {
            name,
            sourceMealPlan,
          });
        }

        let quantityValue: number | string;

        // Shared logic for quantity math
        if (parsedIngredient.amount !== null && typeof existingItem.quantity === 'number') {
          quantityValue = existingItem.quantity + parsedIngredient.amount;
        } else if (parsedIngredient.amount !== null) {
          quantityValue = parsedIngredient.amount;
        } else {
          quantityValue = 1;
        }

        if (existingItem.auto_added && existingItem.pending_confirmation) {
          const { error: updateError } = await supabase
            .from('shopping_items')
            .update({
              quantity: quantityValue,
              auto_added_at: new Date().toISOString(),
              pending_confirmation: !autoConfirm,
            })
            .eq('id', existingItem.id);

          if (updateError) {
            logger.error('Error updating auto-added shopping item', updateError);
          } else {
            updatedCount += 1;
            autoAddedCount += 1;
            if (!autoConfirm) {
              pendingConfirmationsCount += 1;
            }
            logger.debug('Updated auto-added ingredient quantity', {
              name,
              previousQuantity: existingItem.quantity,
              newQuantity: quantityValue,
            });
          }
        } else {
          const { error: updateError } = await supabase
            .from('shopping_items')
            .update({ quantity: quantityValue })
            .eq('id', existingItem.id);

          if (updateError) {
            logger.error('Error updating shopping item', updateError);
          } else {
            updatedCount += 1;
            logger.debug('Updated shopping item quantity', {
              name,
              previousQuantity: existingItem.quantity,
              newQuantity: quantityValue,
            });
          }
        }

        continue;
      }

      // Insert new auto-added item
      let quantityValue: number | string = 1;
      if (parsedIngredient.amount !== null) {
        quantityValue = parsedIngredient.amount;
      }

      const { error: insertError } = await supabase
        .from('shopping_items')
        .insert([
          {
            list_id: listId,
            name: name.trim(),
            quantity: quantityValue,
            is_complete: false,
            auto_added: true,
            source_recipe_id: recipeId,
            pending_confirmation: !autoConfirm,
            auto_added_at: new Date().toISOString(),
            created_by: userId,
          },
        ]);

      if (insertError) {
        logger.error('Error inserting auto-added shopping item', insertError);

        // If the insert fails due to quantity type mismatch, try with default value
        if (insertError.message.includes('quantity')) {
          const { error: retryError } = await supabase
            .from('shopping_items')
            .insert([
              {
                list_id: listId,
                name: name.trim(),
                quantity: 1,
                is_complete: false,
                auto_added: true,
                source_recipe_id: recipeId,
                pending_confirmation: !autoConfirm,
                auto_added_at: new Date().toISOString(),
                created_by: userId,
              },
            ]);

          if (!retryError) {
            addedCount += 1;
            autoAddedCount += 1;
            if (!autoConfirm) {
              pendingConfirmationsCount += 1;
            }
            logger.debug('Added auto-added item with default quantity', {
              name,
              quantity: 1,
            });
          } else {
            logger.error('Retry insert also failed', retryError);
          }
        }
      } else {
        addedCount += 1;
        autoAddedCount += 1;
        if (!autoConfirm) {
          pendingConfirmationsCount += 1;
        }
        logger.debug('Added auto-added item', {
          name,
          quantity: quantityValue,
        });
      }
    }

    logger.info(
      `Recipe "${recipe.title}" ingredients processed: ${addedCount} added, ${updatedCount} updated, ${autoAddedCount} auto-added, ${pendingConfirmationsCount} pending confirmation`
    );

    return {
      ok: true,
      added: addedCount,
      updated: updatedCount,
      pending: pendingConfirmationsCount,
      listId,
    };
  } catch (error) {
    logger.error('Error in addRecipeIngredientsToGroceriesAuto', error as Error);

    return {
      ok: false,
      added: 0,
      updated: 0,
      pending: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

