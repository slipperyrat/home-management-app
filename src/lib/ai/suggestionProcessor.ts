import { createClient } from '@supabase/supabase-js';

interface ProcessedSuggestion {
  id: string;
  suggestion_type: string;
  suggestion_data: any;
  household_id: string;
  user_id: string;
  success: boolean;
  error?: string;
  created_record_id?: string;
}

export class AISuggestionProcessor {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Process AI suggestions and automatically insert them into appropriate tables
   */
  async processSuggestions(suggestions: any[], householdId: string, userId: string): Promise<ProcessedSuggestion[]> {
    const results: ProcessedSuggestion[] = [];

    for (const suggestion of suggestions) {
      try {
        const result = await this.processSingleSuggestion(suggestion, householdId, userId);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process suggestion ${suggestion.id}:`, error);
        results.push({
          id: suggestion.id,
          suggestion_type: suggestion.suggestion_type,
          suggestion_data: suggestion.suggestion_data,
          household_id: householdId,
          user_id: userId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Process a single AI suggestion based on its type
   */
  private async processSingleSuggestion(suggestion: any, householdId: string, userId: string): Promise<ProcessedSuggestion> {
    const { id, suggestion_type, suggestion_data } = suggestion;

    switch (suggestion_type) {
      case 'bill_action':
        return await this.processBillSuggestion(suggestion, householdId, userId);
      
      case 'calendar_event':
        return await this.processCalendarEventSuggestion(suggestion, householdId, userId);
      
      case 'shopping_list_update':
        return await this.processShoppingListSuggestion(suggestion, householdId, userId);
      
      case 'chore_creation':
        return await this.processChoreSuggestion(suggestion, householdId, userId);
      
      default:
        console.warn(`Unknown suggestion type: ${suggestion_type}`);
        return {
          id,
          suggestion_type,
          suggestion_data,
          household_id: householdId,
          user_id: userId,
          success: false,
          error: `Unknown suggestion type: ${suggestion_type}`
        };
    }
  }

  /**
   * Process bill suggestions - insert into bills table
   */
  private async processBillSuggestion(suggestion: any, householdId: string, userId: string): Promise<ProcessedSuggestion> {
    const { id, suggestion_data } = suggestion;
    
    try {
      // Extract bill data from suggestion
      const billData = {
        household_id: householdId,
        name: suggestion_data.description || 'Bill from AI suggestion',
        amount: suggestion_data.bill_amount || 0,
        currency: 'AUD',
        due_date: suggestion_data.bill_due_date || new Date().toISOString().split('T')[0],
        status: 'pending',
        category: suggestion_data.bill_category || 'general',
        description: suggestion_data.description,
        source: 'ai_email',
        source_data: {
          ai_suggestion_id: id,
          original_suggestion: suggestion
        },
        created_by: userId
      };

      const { data: bill, error } = await this.supabase
        .from('bills')
        .insert(billData)
        .select()
        .single();

      if (error) throw error;

      return {
        id,
        suggestion_type: 'bill_action',
        suggestion_data,
        household_id: householdId,
        user_id: userId,
        success: true,
        created_record_id: bill.id
      };

    } catch (error) {
      throw new Error(`Failed to create bill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process calendar event suggestions - insert into household_events table
   */
  private async processCalendarEventSuggestion(suggestion: any, householdId: string, userId: string): Promise<ProcessedSuggestion> {
    const { id, suggestion_data } = suggestion;
    
    try {
      // Extract event data from suggestion
      const eventData = {
        household_id: householdId,
        type: 'appointment.scheduled',
        source: 'ai_email',
        payload: {
          title: suggestion_data.event_title || 'Appointment from AI suggestion',
          date: suggestion_data.event_date,
          location: suggestion_data.event_location,
          description: suggestion_data.description,
          ai_suggestion_id: id,
          original_suggestion: suggestion
        }
      };

      const { data: event, error } = await this.supabase
        .from('household_events')
        .insert(eventData)
        .select()
        .single();

      if (error) throw error;

      return {
        id,
        suggestion_type: 'calendar_event',
        suggestion_data,
        household_id: householdId,
        user_id: userId,
        success: true,
        created_record_id: event.id
      };

    } catch (error) {
      throw new Error(`Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process shopping list suggestions - update shopping lists
   */
  private async processShoppingListSuggestion(suggestion: any, householdId: string, userId: string): Promise<ProcessedSuggestion> {
    const { id, suggestion_data } = suggestion;
    
    try {
      // Get or create default shopping list
      let shoppingList = await this.getOrCreateDefaultShoppingList(householdId, userId);

      // Add items to shopping list
      if (suggestion_data.items && Array.isArray(suggestion_data.items)) {
        for (const item of suggestion_data.items) {
          await this.supabase
            .from('shopping_items')
            .insert({
              list_id: shoppingList.id,
              name: item.name || item,
              quantity: item.quantity || '1',
              completed: false
            });
        }
      } else if (suggestion_data.description) {
        // Single item from description
        await this.supabase
          .from('shopping_items')
          .insert({
            list_id: shoppingList.id,
            name: suggestion_data.description,
            quantity: '1',
            completed: false
          });
      }

      return {
        id,
        suggestion_type: 'shopping_list_update',
        suggestion_data,
        household_id: householdId,
        user_id: userId,
        success: true,
        created_record_id: shoppingList.id
      };

    } catch (error) {
      throw new Error(`Failed to update shopping list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process chore suggestions - insert into household_events table
   */
  private async processChoreSuggestion(suggestion: any, householdId: string, userId: string): Promise<ProcessedSuggestion> {
    const { id, suggestion_data } = suggestion;
    
    try {
      // Extract chore data from suggestion
      const choreData = {
        household_id: householdId,
        type: 'chore.created',
        source: 'ai_email',
        payload: {
          title: suggestion_data.description || 'Chore from AI suggestion',
          assigned_to: suggestion_data.assigned_to || userId,
          priority: suggestion_data.priority || 'medium',
          due_date: suggestion_data.due_date,
          ai_suggestion_id: id,
          original_suggestion: suggestion
        }
      };

      const { data: chore, error } = await this.supabase
        .from('household_events')
        .insert(choreData)
        .select()
        .single();

      if (error) throw error;

      return {
        id,
        suggestion_type: 'chore_creation',
        suggestion_data,
        household_id: householdId,
        user_id: userId,
        success: true,
        created_record_id: chore.id
      };

    } catch (error) {
      throw new Error(`Failed to create chore: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create a default shopping list for the household
   */
  private async getOrCreateDefaultShoppingList(householdId: string, userId: string) {
    // Try to get existing default list
    let { data: existingList } = await this.supabase
      .from('shopping_lists')
      .select('*')
      .eq('household_id', householdId)
      .eq('title', 'AI Generated Items')
      .single();

    if (existingList) {
      return existingList;
    }

    // Create new default list
    const { data: newList, error } = await this.supabase
      .from('shopping_lists')
      .insert({
        title: 'AI Generated Items',
        created_by: userId,
        household_id: householdId
      })
      .select()
      .single();

    if (error) throw error;
    return newList;
  }

  /**
   * Log processing results for monitoring and debugging
   */
  async logProcessingResults(results: ProcessedSuggestion[], householdId: string) {
    try {
      const logData = {
        household_id: householdId,
        processing_type: 'ai_suggestion_auto_insert',
        results_summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          errors: results.filter(r => !r.success).map(r => r.error)
        },
        detailed_results: results,
        processed_at: new Date().toISOString()
      };

      await this.supabase
        .from('ai_processing_logs')
        .insert(logData);

    } catch (error) {
      console.error('Failed to log processing results:', error);
    }
  }
}
