import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import type { Database, ShoppingListRow } from '@/types/database';
import { logger } from '@/lib/logging/logger';

type SuggestionType = 'bill_action' | 'calendar_event' | 'shopping_list_update' | 'chore_creation';

interface AISuggestion {
  id: string;
  suggestion_type: SuggestionType;
  suggestion_data: Record<string, unknown>;
}

interface ProcessedSuggestion {
  id: string;
  suggestion_type: SuggestionType;
  suggestion_data: Record<string, unknown>;
  household_id: string;
  user_id: string;
  success: boolean;
  error?: string;
  created_record_id?: string;
}

export class AISuggestionProcessor {
  private supabase = createSupabaseAdminClient();

  /**
   * Process AI suggestions and automatically insert them into appropriate tables
   */
  async processSuggestions(suggestions: AISuggestion[], householdId: string, userId: string): Promise<ProcessedSuggestion[]> {
    const results: ProcessedSuggestion[] = [];

    for (const suggestion of suggestions) {
      try {
        const result = await this.processSingleSuggestion(suggestion, householdId, userId);
        results.push(result);
      } catch (error) {
        logger.error('Failed to process AI suggestion', error as Error, {
          suggestionId: suggestion.id,
          householdId,
          userId,
        });
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
  private async processSingleSuggestion(suggestion: AISuggestion, householdId: string, userId: string): Promise<ProcessedSuggestion> {
    const { id, suggestion_type, suggestion_data } = suggestion;

    switch (suggestion_type) {
      case 'bill_action':
        return this.processBillSuggestion(suggestion, householdId, userId);
      
      case 'calendar_event':
        return this.processCalendarEventSuggestion(suggestion, householdId, userId);
      
      case 'shopping_list_update':
        return this.processShoppingListSuggestion(suggestion, householdId, userId);
      
      case 'chore_creation':
        return this.processChoreSuggestion(suggestion, householdId, userId);
      
      default:
        logger.warn('Unknown AI suggestion type', {
          suggestionId: id,
          suggestionType: suggestion_type,
        });
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
  private async processBillSuggestion(suggestion: AISuggestion, householdId: string, userId: string): Promise<ProcessedSuggestion> {
    const { id, suggestion_data } = suggestion;
    
    try {
      // Extract bill data from suggestion
      const billData: Database['public']['Tables']['bills']['Row'] & { source: string; source_data: Record<string, unknown> } = {
        household_id: householdId,
        title: (suggestion_data.description as string) || 'Bill from AI suggestion',
        amount: Number(suggestion_data.bill_amount) || 0,
        currency: 'AUD',
        due_date: (suggestion_data.bill_due_date as string) || new Date().toISOString().split('T')[0],
        status: 'pending',
        category: (suggestion_data.bill_category as string) || 'general',
        description: (suggestion_data.description as string) ?? null,
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
  private async processCalendarEventSuggestion(suggestion: AISuggestion, householdId: string, userId: string): Promise<ProcessedSuggestion> {
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
  private async processShoppingListSuggestion(suggestion: AISuggestion, householdId: string, userId: string): Promise<ProcessedSuggestion> {
    const { id, suggestion_data } = suggestion;
    
    try {
      // Get or create default shopping list
      const shoppingList = await this.getOrCreateDefaultShoppingList(householdId, userId);

      // Add items to shopping list
      const items = suggestion_data.items as Array<{ name?: string; quantity?: string }> | undefined;
      if (items && Array.isArray(items)) {
        for (const item of items) {
          await this.supabase
            .from('shopping_items')
            .insert({
              list_id: shoppingList.id,
              name: item.name || 'Item',
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
  private async processChoreSuggestion(suggestion: AISuggestion, householdId: string, userId: string): Promise<ProcessedSuggestion> {
    const { id, suggestion_data } = suggestion;
    
    try {
      // Extract chore data from suggestion
      const choreData = {
        household_id: householdId,
        type: 'chore.created',
        source: 'ai_email',
        payload: {
          title: (suggestion_data.description as string) || 'Chore from AI suggestion',
          assigned_to: (suggestion_data.assigned_to as string) || userId,
          priority: (suggestion_data.priority as string) || 'medium',
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
  private async getOrCreateDefaultShoppingList(householdId: string, userId: string): Promise<ShoppingListRow> {
    // Try to get existing default list
    const { data: existingList } = await this.supabase
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
      logger.error('Failed to log AI processing results', error as Error, { householdId });
    }
  }
}
