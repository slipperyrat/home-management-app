import { sb } from './supabaseAdmin'

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
function parseQuantity(ingredient: any): ParsedQuantity {
  if (ingredient && typeof ingredient === 'object') {
    // Handle the new format: {id, name, amount, unit, notes}
    if (ingredient.name && typeof ingredient.amount !== 'undefined') {
      const amount = parseFloat(ingredient.amount);
      const unit = String(ingredient.unit || '').trim();
      
      // Handle malformed data where name might be a single letter and unit might contain the real name
      if (ingredient.name.length === 1 && ingredient.unit && ingredient.unit.length > 1) {
        // For malformed data, use the unit as the name and default amount to 1
        return {
          amount: 1,
          unit: null,
          originalText: ingredient.unit.trim()
        };
      }
      
      return {
        amount: isNaN(amount) ? 1 : amount, // Default to 1 if amount is invalid
        unit: unit || null,
        originalText: `${isNaN(amount) ? 1 : amount} ${unit}`.trim()
      };
    }
    // Handle old format: {amount, unit}
    const amount = parseFloat(ingredient.amount);
    const unit = String(ingredient.unit || '').trim();
    return {
      amount: isNaN(amount) ? null : amount,
      unit: unit || null,
      originalText: `${isNaN(amount) ? '' : amount} ${unit}`.trim()
    };
  }
  if (typeof ingredient === 'string') {
    // Attempt to parse quantity from string (e.g., "2 cups flour", "1 lb chicken")
    const match = ingredient.match(/^(\d+(\.\d+)?)\s*([a-zA-Z]+)?\s*(.*)$/);
    if (match && match[1]) {
      const amount = parseFloat(match[1]);
      const unit = match[3] || null;
      return {
        amount: isNaN(amount) ? null : amount,
        unit: unit ? unit.toLowerCase() : null,
        originalText: ingredient
      };
    }
    // If no quantity pattern found, treat as just an ingredient name
    return { 
      amount: 1, // Default to 1 for simple ingredient names
      unit: null, 
      originalText: ingredient 
    };
  }
  return { amount: 1, unit: null, originalText: String(ingredient || '') };
}

// Helper to extract item name from ingredient
function getIngredientName(ingredient: any): string {
  if (ingredient && typeof ingredient === 'object' && ingredient.name) {
    // Handle malformed data where name might be a single letter and unit might contain the real name
    if (ingredient.name.length === 1 && ingredient.unit && ingredient.unit.length > 1) {
      // If name is a single letter and unit is longer, use the unit as the name
      return ingredient.unit.trim();
    }
    return ingredient.name.trim();
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
  autoConfirm: boolean = false,
  sourceMealPlan?: { week: string; day: string; slot: string }
): Promise<{ 
  ok: boolean; 
  added: number; 
  updated: number; 
  autoAdded: number;
  pendingConfirmations: number;
  listId?: string; 
  error?: string 
}> {
  console.log('🚀 addRecipeIngredientsToGroceriesAuto called with:', {
    userId,
    householdId,
    recipeId,
    autoConfirm,
    sourceMealPlan
  });
  
  try {
    const supabase = sb()
    console.log('✅ Supabase client initialized');

    // Get recipe details
    console.log('🔍 Fetching recipe with ID:', recipeId, 'for household:', householdId);
    const { data: recipe, error: rErr } = await supabase
      .from('recipes').select('id, ingredients, title')
      .eq('id', recipeId).eq('household_id', householdId).single()
    
    if (rErr) {
      console.error('❌ Error fetching recipe:', rErr);
      return { 
        ok: false, 
        added: 0, 
        updated: 0, 
        autoAdded: 0,
        pendingConfirmations: 0,
        error: rErr.message 
      }
    }
    
    console.log('✅ Recipe fetched:', recipe);

    // Get or create Groceries list
    const { data: list, error: lErr } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('household_id', householdId)
      .eq('title', 'Groceries')
      .maybeSingle()
    if (lErr) return { 
      ok: false, 
      added: 0, 
      updated: 0, 
      autoAdded: 0,
      pendingConfirmations: 0,
      error: lErr.message 
    }

    let listId = list?.id
    if (!listId) {
      const { data: created, error: cErr } = await supabase
        .from('shopping_lists')
        .insert([{ household_id: householdId, title: 'Groceries', created_by: userId }])
        .select('id')
        .single()
      if (cErr) return { 
        ok: false, 
        added: 0, 
        updated: 0, 
        autoAdded: 0,
        pendingConfirmations: 0,
        error: cErr.message 
      }
      listId = created.id
    }

    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
    console.log(`🔍 Recipe "${recipe.title}" ingredients:`, ingredients)
    if (!ingredients.length) {
      console.log('❌ No ingredients found in recipe')
      return { 
        ok: true, 
        added: 0, 
        updated: 0, 
        autoAdded: 0,
        pendingConfirmations: 0,
        listId 
      }
    }

    // Get existing shopping items for this list
    const { data: existingItems, error: existingErr } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', listId)
      .eq('is_complete', false) // Only consider incomplete items for merging
    if (existingErr) return { 
      ok: false, 
      added: 0, 
      updated: 0, 
      autoAdded: 0,
      pendingConfirmations: 0,
      error: existingErr.message 
    }

    // Create a map of existing items by normalized name
    const existingItemsMap = new Map()
    existingItems?.forEach(item => {
      existingItemsMap.set(normalizeName(item.name), item)
    })

    let addedCount = 0
    let updatedCount = 0
    let autoAddedCount = 0
    let pendingConfirmationsCount = 0

    for (const ingredient of ingredients) {
      console.log(`🔍 Processing ingredient:`, ingredient);
      console.log(`🔍 Ingredient type:`, typeof ingredient);
      console.log(`🔍 Ingredient keys:`, Object.keys(ingredient || {}));
      console.log(`🔍 Ingredient.name:`, ingredient?.name);
      console.log(`🔍 Ingredient.unit:`, ingredient?.unit);
      console.log(`🔍 Ingredient.amount:`, ingredient?.amount);
      
      const parsedIngredient = parseQuantity(ingredient);
      const name = getIngredientName(ingredient);
      const normalizedIngName = normalizeName(name);
      console.log(`🔍 Parsed ingredient - name: "${name}", quantity: ${parsedIngredient.amount}, unit: ${parsedIngredient.unit}`);
      console.log(`🔍 Normalized name: "${normalizedIngName}"`);
      
      const existingItem = existingItemsMap.get(normalizedIngName);

      if (existingItem) {
        // Merge with existing items for both regular and meal planner assignments
        // This prevents duplicate items while still requiring confirmation for meal planner items
        if (sourceMealPlan) {
          console.log(`🔄 Merging with existing item "${name}" for meal planner assignment`)
        }
        
        // Check if this is an auto-added item that's still pending confirmation
        if (existingItem.auto_added && existingItem.pending_confirmation) {
            // Update the auto-added item
            let quantityValue: number | string;
            
            if (parsedIngredient.amount !== null && typeof existingItem.quantity === 'number') {
              quantityValue = existingItem.quantity + parsedIngredient.amount;
            } else if (parsedIngredient.amount !== null) {
              // If we have a numeric amount, use it
              quantityValue = parsedIngredient.amount;
            } else {
              // For simple ingredient names, just use 1
              quantityValue = 1;
            }

            const { error: updateErr } = await supabase
              .from('shopping_items')
              .update({ 
                quantity: quantityValue,
                auto_added_at: new Date().toISOString(),
                pending_confirmation: !autoConfirm
              })
              .eq('id', existingItem.id)
            
            if (updateErr) {
              console.error('Error updating auto-added shopping item:', updateErr)
            } else {
              updatedCount++
              autoAddedCount++
              if (!autoConfirm) pendingConfirmationsCount++
              console.log(`✅ Updated auto-added "${name}" quantity: ${existingItem.quantity} → ${quantityValue}`)
            }
          } else {
            // Regular update for non-auto-added items
            let quantityValue: number | string;
            
            if (parsedIngredient.amount !== null && typeof existingItem.quantity === 'number') {
              quantityValue = existingItem.quantity + parsedIngredient.amount;
            } else if (parsedIngredient.amount !== null) {
              // If we have a numeric amount, use it
              quantityValue = parsedIngredient.amount;
            } else {
              // For simple ingredient names, just use 1
              quantityValue = 1;
            }

            const { error: updateErr } = await supabase
              .from('shopping_items')
              .update({ quantity: quantityValue })
              .eq('id', existingItem.id)
            
            if (updateErr) {
              console.error('Error updating shopping item:', updateErr)
            } else {
              updatedCount++
              console.log(`✅ Updated "${name}" quantity: ${existingItem.quantity} → ${quantityValue}`)
            }
          }
        }
      }
      
      // Create new item only if no existing item found
      if (!existingItem) {
        // Insert new auto-added item
        let quantityValue: number | string;
        
        if (parsedIngredient.amount !== null) {
          quantityValue = parsedIngredient.amount;
        } else {
          // For simple ingredient names, default to 1
          quantityValue = 1;
        }

        const { error: insertErr } = await supabase
          .from('shopping_items')
          .insert([{
            list_id: listId,
            name: name.trim(),
            quantity: quantityValue,
            is_complete: false,
            auto_added: true,
            source_recipe_id: recipeId,
            pending_confirmation: !autoConfirm,
            auto_added_at: new Date().toISOString(),
            created_by: userId
          }])
        
        if (insertErr) {
          console.error('Error inserting auto-added shopping item:', insertErr)
          // If the insert fails due to quantity type mismatch, try with default value
          if (insertErr.message.includes('quantity')) {
            const { error: retryErr } = await supabase
              .from('shopping_items')
              .insert([{
                list_id: listId,
                name: name.trim(),
                quantity: 1, // Default to 1 if quantity parsing fails
                is_complete: false,
                auto_added: true,
                source_recipe_id: recipeId,
                pending_confirmation: !autoConfirm,
                auto_added_at: new Date().toISOString(),
                created_by: userId
              }])
            
            if (!retryErr) {
              addedCount++
              autoAddedCount++
              if (!autoConfirm) pendingConfirmationsCount++
              console.log(`➕ Added new auto-added item: "${name}" with default quantity 1`)
            } else {
              console.error('Retry insert also failed:', retryErr)
            }
          }
        } else {
          addedCount++
          autoAddedCount++
          if (!autoConfirm) pendingConfirmationsCount++
          console.log(`➕ Added new auto-added item: "${name}" with quantity "${quantityValue}"`)
        }
      }
    }

    console.log(`📝 Recipe "${recipe.title}" ingredients processed: ${addedCount} added, ${updatedCount} updated, ${autoAddedCount} auto-added, ${pendingConfirmationsCount} pending confirmation`)
    return { 
      ok: true, 
      added: addedCount, 
      updated: updatedCount, 
      autoAdded: autoAddedCount,
      pendingConfirmations: pendingConfirmationsCount,
      listId 
    }
    
  } catch (error: any) {
    console.error('❌ Error in addRecipeIngredientsToGroceriesAuto:', error)
    return { 
      ok: false, 
      added: 0, 
      updated: 0, 
      autoAdded: 0,
      pendingConfirmations: 0,
      error: error.message 
    }
  }
}
