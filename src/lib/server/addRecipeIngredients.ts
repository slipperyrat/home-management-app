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
  if (normalized.endsWith('s') && !normalized.endsWith('ss')) { // Avoid removing 's' from words like 'grass'
    normalized = normalized.slice(0, -1);
  }
  return normalized.trim();
}

interface ParsedQuantity {
  amount: number | null;
  unit: string | null;
  originalText: string;
}

// Helper to parse quantity from various formats
function parseQuantity(ingredient: any): ParsedQuantity {
  if (ingredient && typeof ingredient === 'object') {
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
  }
  return { amount: null, unit: null, originalText: String(ingredient || '') };
}

// Helper to extract item name from ingredient
function getIngredientName(ingredient: any): string {
  if (ingredient && typeof ingredient === 'object' && ingredient.name) {
    return ingredient.name;
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

// Helper to merge quantities
function mergeQuantities(q1: ParsedQuantity, q2: ParsedQuantity): ParsedQuantity {
  if (q1.unit && q1.unit === q2.unit && q1.amount !== null && q2.amount !== null) {
    // If units are the same and both are numbers, sum them
    return {
      amount: q1.amount + q2.amount,
      unit: q1.unit,
      originalText: `${q1.amount + q2.amount} ${q1.unit}`.trim()
    };
  } else {
    // Otherwise, concatenate them
    const combinedText = [q1.originalText, q2.originalText].filter(Boolean).join(' + ');
    return {
      amount: null, // Cannot sum different units reliably
      unit: null,
      originalText: combinedText
    };
  }
}

/**
 * Adds ingredients from a recipe to the household's "Groceries" shopping list
 * @param userId - The user ID making the request
 * @param householdId - The household ID
 * @param recipeId - The recipe ID to get ingredients from
 * @returns Object with success status and counts
 */
export async function addRecipeIngredientsToGroceries(
  userId: string,
  householdId: string, 
  recipeId: string
): Promise<{ ok: boolean; added: number; updated: number; listId?: string; error?: string }> {
  try {
    const supabase = sb()

    // Get recipe
    const { data: recipe, error: rErr } = await supabase
      .from('recipes').select('id, ingredients, title')
      .eq('id', recipeId).eq('household_id', householdId).single()
    if (rErr) return { ok: false, added: 0, updated: 0, error: rErr.message }

    // Get or create Groceries list
    const { data: list, error: lErr } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('household_id', householdId)
      .eq('title', 'Groceries')
      .maybeSingle()
    if (lErr) return { ok: false, added: 0, updated: 0, error: lErr.message }

    let listId = list?.id
    if (!listId) {
      const { data: created, error: cErr } = await supabase
        .from('shopping_lists')
        .insert([{ household_id: householdId, title: 'Groceries', created_by: userId }])
        .select('id')
        .single()
      if (cErr) return { ok: false, added: 0, updated: 0, error: cErr.message }
      listId = created.id
    }

    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
    console.log(`🔍 Recipe "${recipe.title}" ingredients:`, ingredients)
    if (!ingredients.length) {
      console.log('❌ No ingredients found in recipe')
      return { ok: true, added: 0, updated: 0, listId }
    }

    // Get existing shopping items for this list
    const { data: existingItems, error: existingErr } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', listId)
      .eq('completed', false) // Only consider incomplete items for merging
    if (existingErr) return { ok: false, added: 0, updated: 0, error: existingErr.message }

    // Create a map of existing items by normalized name
    const existingItemsMap = new Map()
    existingItems?.forEach(item => {
      existingItemsMap.set(normalizeName(item.name), item)
    })

    let addedCount = 0
    let updatedCount = 0

    for (const ingredient of ingredients) {
      const parsedIngredient = parseQuantity(ingredient);
      const name = getIngredientName(ingredient);
      const normalizedIngName = normalizeName(name);
      
      const existingItem = existingItemsMap.get(normalizedIngName);

      if (existingItem) {
        // Update existing item
        const currentQuantity = parseQuantity(existingItem.quantity);
        const mergedQuantity = mergeQuantities(currentQuantity, parsedIngredient);

        const { error: updateErr } = await supabase
          .from('shopping_items')
          .update({ quantity: mergedQuantity.originalText })
          .eq('id', existingItem.id)
        
        if (updateErr) {
          console.error('Error updating shopping item:', updateErr)
        } else {
          updatedCount++
          console.log(`✅ Updated "${name}" quantity: ${existingItem.quantity} → ${mergedQuantity.originalText}`)
        }
      } else {
        // Insert new item
        const { error: insertErr } = await supabase
          .from('shopping_items')
          .insert([{
            list_id: listId,
            name: name.trim(),
            quantity: parsedIngredient.originalText,
            completed: false
          }])
        
        if (insertErr) {
          console.error('Error inserting shopping item:', insertErr)
        } else {
          addedCount++
          console.log(`➕ Added new item: "${name}" with quantity "${parsedIngredient.originalText}"`)
        }
      }
    }

    console.log(`📝 Recipe "${recipe.title}" ingredients processed: ${addedCount} added, ${updatedCount} updated`)
    return { ok: true, added: addedCount, updated: updatedCount, listId }
    
  } catch (error: any) {
    console.error('❌ Error in addRecipeIngredientsToGroceries:', error)
    return { ok: false, added: 0, updated: 0, error: error.message }
  }
}
