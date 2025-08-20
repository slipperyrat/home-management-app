// Shared actions registry for automation worker
// This file defines all available automation actions

import { supabase } from './supabaseClient.ts';

export interface ActionContext {
  household_id: string;
  rule_id?: string;
  event_id?: string;
  params: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

// Action handler type
export type ActionHandler = (context: ActionContext) => Promise<ActionResult>;

// Action registry
export const actions: Record<string, ActionHandler> = {
  // Bill-related actions
  create_bill: async (context: ActionContext): Promise<ActionResult> => {
    try {
      const { household_id, params } = context;
      
      // Extract bill data from params
      const {
        title,
        description,
        amount,
        due_date,
        category = 'General',
        priority = 'medium',
        source = 'automation',
        external_id
      } = params;

      // Validate required fields
      if (!title || !amount || !due_date) {
        return {
          success: false,
          message: 'Missing required bill fields: title, amount, due_date'
        };
      }

      // Create bill using Supabase client
      const { data: bill, error } = await supabase
        .from('bills')
        .insert({
          household_id,
          title,
          description,
          amount: parseFloat(amount),
          due_date,
          category,
          priority,
          source,
          external_id,
          created_by: 'automation'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating bill:', error);
        return {
          success: false,
          message: `Failed to create bill: ${error.message}`
        };
      }

      return {
        success: true,
        message: `Bill created successfully: ${title}`,
        data: { bill_id: bill.id }
      };
    } catch (error) {
      console.error('Exception in create_bill action:', error);
      return {
        success: false,
        message: `Exception creating bill: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },

  check_due_bills: async (context: ActionContext): Promise<ActionResult> => {
    try {
      const { household_id, params } = context;
      const { reminder_days = [7, 3, 1] } = params;

      // Get bills due within the reminder days
      const dueBills = [];
      
      for (const days of reminder_days) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + days);
        
        const { data: bills, error } = await supabase
          .from('bills')
          .select('*')
          .eq('household_id', household_id)
          .eq('status', 'pending')
          .eq('due_date', targetDate.toISOString().split('T')[0]);

        if (error) {
          console.error(`Error checking bills due in ${days} days:`, error);
          continue;
        }

        if (bills && bills.length > 0) {
          dueBills.push(...bills.map(bill => ({ ...bill, reminder_days: days })));
        }
      }

      if (dueBills.length === 0) {
        return {
          success: true,
          message: 'No bills due for reminders',
          data: { bills_checked: 0 }
        };
      }

      // Create reminders for due bills
      const reminders = dueBills.map(bill => ({
        bill_id: bill.id,
        household_id,
        reminder_type: bill.reminder_days === 1 ? 'due_soon' : 'due_soon',
        scheduled_for: new Date().toISOString(),
        sent_to: [] // Will be populated with household member IDs
      }));

      const { error: reminderError } = await supabase
        .from('bill_reminders')
        .insert(reminders);

      if (reminderError) {
        console.error('Error creating reminders:', reminderError);
        return {
          success: false,
          message: `Failed to create reminders: ${reminderError.message}`
        };
      }

      return {
        success: true,
        message: `Created ${reminders.length} bill reminders`,
        data: { 
          bills_checked: dueBills.length,
          reminders_created: reminders.length
        }
      };
    } catch (error) {
      console.error('Exception in check_due_bills action:', error);
      return {
        success: false,
        message: `Exception checking due bills: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },

  mark_overdue_bills: async (context: ActionContext): Promise<ActionResult> => {
    try {
      const { household_id } = context;

      // Update bills that are past due date to overdue status
      const { data: overdueBills, error } = await supabase
        .from('bills')
        .update({ status: 'overdue' })
        .eq('household_id', household_id)
        .eq('status', 'pending')
        .lt('due_date', new Date().toISOString().split('T')[0])
        .select();

      if (error) {
        console.error('Error marking overdue bills:', error);
        return {
          success: false,
          message: `Failed to mark overdue bills: ${error.message}`
        };
      }

      if (!overdueBills || overdueBills.length === 0) {
        return {
          success: true,
          message: 'No bills marked as overdue',
          data: { bills_updated: 0 }
        };
      }

      return {
        success: true,
        message: `Marked ${overdueBills.length} bills as overdue`,
        data: { 
          bills_updated: overdueBills.length,
          overdue_bills: overdueBills
        }
      };
    } catch (error) {
      console.error('Exception in mark_overdue_bills action:', error);
      return {
        success: false,
        message: `Exception marking overdue bills: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },

  // Existing actions (stubs for now)
  notify: async (context: ActionContext): Promise<ActionResult> => {
    try {
      const { params } = context;
      const { message, type = 'info' } = params;

      // For now, just log the notification
      console.log(`[NOTIFICATION] ${type.toUpperCase()}: ${message}`);

      return {
        success: true,
        message: 'Notification logged successfully',
        data: { message, type }
      };
    } catch (error) {
      console.error('Exception in notify action:', error);
      return {
        success: false,
        message: `Exception in notify action: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },

  update_shopping_list: async (context: ActionContext): Promise<ActionResult> => {
    try {
      // Stub for shopping list updates
      return {
        success: true,
        message: 'Shopping list update action (not yet implemented)',
        data: { action: 'update_shopping_list' }
      };
    } catch (error) {
      console.error('Exception in update_shopping_list action:', error);
      return {
        success: false,
        message: `Exception in update_shopping_list action: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },

  assign_chore: async (context: ActionContext): Promise<ActionResult> => {
    try {
      // Stub for chore assignment
      return {
        success: true,
        message: 'Chore assignment action (not yet implemented)',
        data: { action: 'assign_chore' }
      };
    } catch (error) {
      console.error('Exception in assign_chore action:', error);
      return {
        success: false,
        message: `Exception in assign_chore action: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

// Helper function to get available actions
export function getAvailableActions(): string[] {
  return Object.keys(actions);
}

// Helper function to validate action parameters
export function validateActionParams(actionName: string, params: Record<string, any>): boolean {
  switch (actionName) {
    case 'create_bill':
      return !!(params.title && params.amount && params.due_date);
    case 'check_due_bills':
      return Array.isArray(params.reminder_days) || params.reminder_days === undefined;
    case 'mark_overdue_bills':
      return true; // No required params
    case 'notify':
      return !!(params.message);
    default:
      return true; // Other actions don't have strict validation
  }
}
