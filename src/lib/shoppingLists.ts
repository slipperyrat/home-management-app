import { supabase } from './supabaseClient';

interface ShoppingItem {
  id: string;
  list_id: string;
  name: string;
  quantity: string | null;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
}

// Get all shopping lists for a household
export async function getShoppingLists(householdId: string) {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select(`
      *,
      shopping_items (*)
    `)
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get shopping lists: ${error.message}`);
  }

  return data;
}

// Create a new shopping list
export async function createShoppingList(title: string, userId: string, householdId: string) {
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({
      title,
      created_by: userId,
      household_id: householdId
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create shopping list: ${error.message}`);
  }

  return data;
}

// Get all shopping items for a specific list
export async function getShoppingItems(listId: string): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get shopping items: ${error.message}`);
  }

  return data as ShoppingItem[];
}

// Add a new shopping item to a list
export async function addShoppingItem(listId: string, name: string, quantity: string | null = "1"): Promise<ShoppingItem> {
  const { data, error } = await supabase
    .from('shopping_items')
    .insert({
      list_id: listId,
      name,
      quantity,
      completed: false
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add shopping item: ${error.message}`);
  }

  return data as ShoppingItem;
}

// Toggle the completion status of a shopping item with XP and coin rewards
export async function toggleShoppingItemComplete(itemId: string, userId: string): Promise<ShoppingItem> {
  console.log(`🔄 toggleShoppingItemComplete called with itemId: ${itemId}, userId: ${userId}`);
  
  // First get the current item to check its completion status
  const { data: currentItem, error: fetchError } = await supabase
    .from('shopping_items')
    .select('completed')
    .eq('id', itemId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch shopping item: ${fetchError.message}`);
  }

  console.log(`📦 Current item completion status:`, currentItem);

  // Check if item was previously incomplete (to award rewards only once)
  const wasIncomplete = !currentItem.completed;

  console.log(`🔄 Item was incomplete: ${wasIncomplete}`);

  // If item was incomplete and we're completing it, use transaction to award rewards
  if (wasIncomplete) {
    console.log(`🎁 Awarding rewards for completing item`);
    return await completeShoppingItemWithRewards(itemId, userId);
  } else {
    // If item was complete and we're uncompleting it, just toggle without rewards
    const { data, error } = await supabase
      .from('shopping_items')
      .update({
        completed: false,
        completed_by: null,
        completed_at: null
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to uncomplete shopping item: ${error.message}`);
    }

    return data;
  }
}

// Complete shopping item with XP and coin rewards using a transaction
async function completeShoppingItemWithRewards(itemId: string, userId: string): Promise<ShoppingItem> {
  console.log(`🔄 Completing shopping item ${itemId} for user ${userId}`);
  
  // First, let's check if the user exists at all
  console.log(`🔍 Checking if user exists in database...`);
      const { data: allUsers } = await supabase
    .from('users')
    .select('id, clerk_id, xp, coins')
    .limit(10);
  
  console.log(`📊 All users in database:`, allUsers);
  console.log(`📊 Looking for clerk_id: ${userId}`);
  
  // Check if our specific user exists in the results
  const foundUser = allUsers?.find(u => u.clerk_id === userId);
  console.log(`🔍 Found user in allUsers:`, foundUser);
  
  // First, get the current user's XP and coins using clerk_id
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('xp, coins')
    .eq('clerk_id', userId);

  console.log(`👤 User data query result:`, { userData, userError });

  if (userError) {
    console.error(`❌ Error fetching user data:`, userError);
    throw new Error(`Failed to fetch user data: ${userError.message}`);
  }

  if (!userData || userData.length === 0) {
    console.error(`❌ No user data found for clerk_id: ${userId}`);
    throw new Error(`User not found with clerk_id: ${userId}`);
  }

  const user = userData[0];
  console.log(`✅ Found user:`, user);

  // Update the shopping item completion status
  const { data: updatedItem, error: itemError } = await supabase
    .from('shopping_items')
    .update({
      completed: true,
      completed_by: userId,
      completed_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .select()
    .single();

  if (itemError) {
    console.error(`❌ Error updating shopping item:`, itemError);
    throw new Error(`Failed to update shopping item: ${itemError.message}`);
  }

  // Update user XP and coins using clerk_id
  const currentXp = user?.xp ?? 0;
  const currentCoins = user?.coins ?? 0;
  const newXp = currentXp + 10;
  const newCoins = currentCoins + 1;
  
  console.log(`💰 Updating user rewards: XP ${currentXp} → ${newXp}, Coins ${currentCoins} → ${newCoins}`);
  
  const { error: updateError } = await supabase
    .from('users')
    .update({
      xp: newXp,
      coins: newCoins
    })
    .eq('clerk_id', userId);

  if (updateError) {
    console.error(`❌ Error updating user rewards:`, updateError);
    throw new Error(`Failed to update user rewards: ${updateError.message}`);
  }

  console.log(`✅ Successfully completed shopping item and awarded rewards`);
  return updatedItem as ShoppingItem;
} 