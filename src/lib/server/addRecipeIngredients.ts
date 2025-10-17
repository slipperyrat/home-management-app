import { sb } from './supabaseAdmin';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/supabase.generated';
import type { RecipeRow } from '@/types/database';

type ShoppingItemRow = Database['public']['Tables']['shopping_items']['Row'];
type ShoppingItemInsert = Database['public']['Tables']['shopping_items']['Insert'];

// Helper to normalize ingredient names for comparison
function normalizeName(name: string): string {
  let normalized = name.toLowerCase().trim();
  // Remove common prefixes/suffixes that don't affect the core item
  normalized = normalized.replace(/^(fresh|dried|chopped|diced|minced|ground|whole|canned|frozen|organic|unsalted|salted)\s+/, '');
  normalized = normalized.replace(/\s+(fresh|dried|chopped|diced|minced|ground|whole|canned|frozen|organic|unsalted|salted)$/, '');
  // Remove parenthetical descriptions
  normalized = normalized.replace(/\s*\(.*\)/, '');
  // Remove trailing 's' for basic pluralization (e.g., "tomatoes" -> "tomato")
  if (normalized.endsWith('s') && !normalized.endsWith('ss')) { // Avoid "grass" -> "gras"
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
  if (
    ingredient &&
    typeof ingredient === 'object' &&
    'amount' in ingredient &&
    'unit' in ingredient
  ) {
    const { amount, unit } = ingredient as { amount: unknown; unit?: unknown };
    const numericAmount = parseFloat(String(amount));
    const normalizedUnit = String(unit ?? '').trim();
    return {
      amount: Number.isNaN(numericAmount) ? null : numericAmount,
      unit: normalizedUnit || null,
      originalText: `${Number.isNaN(numericAmount) ? '' : numericAmount} ${normalizedUnit}`.trim(),
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
        originalText: ingredient
      };
    }
  }
  return { amount: null, unit: null, originalText: String(ingredient || '') };
}

// Helper to extract item name from ingredient
function getIngredientName(ingredient: unknown): string {
  if (
    ingredient &&
    typeof ingredient === 'object' &&
    'name' in ingredient &&
    typeof (ingredient as { name: unknown }).name === 'string'
  ) {
    return (ingredient as { name: string }).name;
  }
  if (typeof ingredient === 'string') {
    // For string ingredients like "2 cups flour", extract the name part
    const match = ingredient.match(/^(\d+(\.\d+)?)\s*([a-zA-Z]+)?\s*(.*)$/);
    if (match && match[4]) {
      return match[4].trim();
    }
    return ingredient;
  }
  return String(ingredient || '');
}

/**
 * Adds ingredients from a recipe to the household's "Groceries" shopping list
 * @param userId - The user ID making the request
 * @param householdId - The household ID
 * @param recipeId - The recipe ID to get ingredients from
 * @returns Object with success status and counts
 */
type RecipeWithIngredients = RecipeRow & { ingredients: unknown };

export async function addRecipeIngredientsToGroceries(
  userId: string,
  householdId: string,
  recipeId: string
): Promise<{ ok: boolean; added: number; updated: number; listId?: string; error?: string }> {
  try {
    const supabase = sb();

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('id, ingredients, title')
      .eq('id', recipeId)
      .eq('household_id', householdId)
      .single();

    if (recipeError) {
      return { ok: false, added: 0, updated: 0, error: recipeError.message };
    }

    const typedRecipe = recipe as RecipeWithIngredients;

    const { data: list, error: listError } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('household_id', householdId)
      .eq('title', 'Groceries')
      .maybeSingle();

    if (listError) {
      return { ok: false, added: 0, updated: 0, error: listError.message };
    }

    let listId = list?.id;
    if (!listId) {
      const { data: created, error: createError } = await supabase
        .from('shopping_lists')
        .insert([{ household_id: householdId, title: 'Groceries', created_by: userId }])
        .select('id')
        .single();

      if (createError || !created) {
        return { ok: false, added: 0, updated: 0, error: createError?.message ?? 'Failed to create shopping list' };
      }

      listId = created.id;
    }

    const ingredients = Array.isArray(typedRecipe.ingredients) ? typedRecipe.ingredients : [];
    logger.info('Processing recipe ingredients', {
      recipeId: typedRecipe.id,
      title: typedRecipe.title,
      ingredientCount: ingredients.length,
    });

    if (ingredients.length === 0) {
      logger.warn('No ingredients found in recipe', { recipeId: typedRecipe.id, title: typedRecipe.title });
      return { ok: true, added: 0, updated: 0, listId };
    }

    type ExistingItem = Pick<ShoppingItemRow, 'id' | 'name' | 'quantity' | 'auto_added' | 'pending_confirmation'>;

    const { data: existingItems, error: existingError } = await supabase
      .from('shopping_items')
      .select('id, name, quantity, auto_added, pending_confirmation')
      .eq('list_id', listId)
      .eq('is_complete', false);

    if (existingError) {
      return { ok: false, added: 0, updated: 0, error: existingError.message };
    }

    const existingItemsMap = new Map<string, ExistingItem>();
    existingItems?.forEach(item => {
      existingItemsMap.set(normalizeName(item.name), item as ExistingItem);
    });

    let addedCount = 0;
    let updatedCount = 0;

    for (const ingredient of ingredients) {
      const parsedIngredient = parseQuantity(ingredient);
      const name = getIngredientName(ingredient);
      const normalizedIngName = normalizeName(name);

      const existingItem = existingItemsMap.get(normalizedIngName);

      if (existingItem) {
        let quantityValue: string | null;

        if (parsedIngredient.amount !== null) {
          const base = `${parsedIngredient.amount}${parsedIngredient.unit ? ` ${parsedIngredient.unit}` : ''}`.trim();
          if (existingItem.quantity) {
            quantityValue = `${existingItem.quantity.trim()} + ${base}`;
          } else {
            quantityValue = base;
          }
        } else {
          const currentQuantity = existingItem.quantity?.trim() ?? '';
          const newQuantityText = parsedIngredient.originalText.trim();
          quantityValue = [currentQuantity, newQuantityText].filter(Boolean).join(' + ') || null;
        }

        const { error: updateErr } = await supabase
          .from('shopping_items')
          .update({ quantity: quantityValue })
          .eq('id', existingItem.id);

        if (updateErr) {
          logger.error('Error updating shopping item quantity', updateErr, { itemId: existingItem.id, name });
        } else {
          updatedCount += 1;
          logger.info('Updated shopping item quantity', {
            name,
            previousQuantity: existingItem.quantity,
            newQuantity: quantityValue,
          });
        }
      } else {
        const quantityText = parsedIngredient.amount !== null
          ? `${parsedIngredient.amount}${parsedIngredient.unit ? ` ${parsedIngredient.unit}` : ''}`.trim()
          : parsedIngredient.originalText.trim();

        const newItem: ShoppingItemInsert = {
          list_id: listId,
          name: name.trim(),
          quantity: quantityText || null,
          is_complete: false,
          auto_added: true,
          pending_confirmation: true,
          source_recipe_id: recipeId,
          category: null,
          auto_added_at: new Date().toISOString(),
          created_by: userId,
        };

        const { error: insertErr } = await supabase
          .from('shopping_items')
          .insert(newItem);

        if (insertErr) {
          logger.error('Error inserting shopping item from recipe', insertErr, { name, listId });

          if (insertErr.message.includes('quantity')) {
            const fallbackItem: ShoppingItemInsert = {
              list_id: listId,
              name: name.trim(),
              quantity: parsedIngredient.amount !== null ? String(parsedIngredient.amount) : '1',
              is_complete: false,
              auto_added: true,
              pending_confirmation: true,
              source_recipe_id: recipeId,
              category: null,
              auto_added_at: new Date().toISOString(),
              created_by: userId,
            };

            const { error: retryErr } = await supabase
              .from('shopping_items')
              .insert(fallbackItem);

            if (!retryErr) {
              addedCount += 1;
              logger.info('Added shopping item from recipe with fallback quantity', { name, listId });
            } else {
              logger.error('Fallback insert for shopping item from recipe failed', retryErr, { name, listId });
            }
          }
        } else {
          addedCount += 1;
          logger.info('Added new shopping item from recipe', { name, quantity: quantityText, listId });
        }
      }
    }

    logger.info('Recipe ingredients processed', {
      recipeId: typedRecipe.id,
      addedCount,
      updatedCount,
      listId,
    });

    return { ok: true, added: addedCount, updated: updatedCount, listId };
  } catch (error) {
    logger.error('Error in addRecipeIngredientsToGroceries', error as Error, {
      userId,
      householdId,
      recipeId,
    });
    return {
      ok: false,
      added: 0,
      updated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
