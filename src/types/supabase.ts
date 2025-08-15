// Basic Supabase types for the home management app
// This is a simplified version - you can generate the full types from your Supabase schema later

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
      };
      household_events: {
        Row: {
          id: string;
          household_id: string;
          type: string;
          source: string;
          payload: any;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          type: string;
          source: string;
          payload?: any;
          occurred_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          type?: string;
          source?: string;
          payload?: any;
          occurred_at?: string;
          created_at?: string;
        };
      };
      automation_rules: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          description?: string;
          trigger_types: string[];
          conditions: any;
          actions: any[];
          enabled: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          description?: string;
          trigger_types: string[];
          conditions?: any;
          actions: any[];
          enabled?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          description?: string;
          trigger_types?: string[];
          conditions?: any;
          actions?: any[];
          enabled?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      automation_jobs: {
        Row: {
          id: string;
          household_id: string;
          rule_id?: string;
          event_id?: string;
          action: string;
          params: any;
          dedupe_key?: string;
          status: string;
          attempts: number;
          max_attempts: number;
          last_error?: string;
          created_at: string;
          processed_at?: string;
          scheduled_for?: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          rule_id?: string;
          event_id?: string;
          action: string;
          params?: any;
          dedupe_key?: string;
          status?: string;
          attempts?: number;
          max_attempts?: number;
          last_error?: string;
          created_at?: string;
          processed_at?: string;
          scheduled_for?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          rule_id?: string;
          event_id?: string;
          action?: string;
          params?: any;
          dedupe_key?: string;
          status?: string;
          attempts?: number;
          max_attempts?: number;
          last_error?: string;
          created_at?: string;
          processed_at?: string;
          scheduled_for?: string;
        };
      };
      bills: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          amount: number;
          currency: string;
          due_date: string;
          status: string;
          category?: string;
          description?: string;
          source: string;
          source_data?: any;
          assigned_to?: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          paid_at?: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          amount: number;
          currency?: string;
          due_date: string;
          status?: string;
          category?: string;
          description?: string;
          source?: string;
          source_data?: any;
          assigned_to?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          paid_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          amount?: number;
          currency?: string;
          due_date?: string;
          status?: string;
          category?: string;
          description?: string;
          source?: string;
          source_data?: any;
          assigned_to?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          paid_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          category?: string;
          read: boolean;
          action_url?: string;
          created_at: string;
          read_at?: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          title: string;
          message: string;
          type?: string;
          category?: string;
          read?: boolean;
          action_url?: string;
          created_at?: string;
          read_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string;
          category?: string;
          read?: boolean;
          action_url?: string;
          created_at?: string;
          read_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          clerk_id: string;
          household_id?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          clerk_id: string;
          household_id?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          clerk_id?: string;
          household_id?: string;
          created_at?: string;
        };
      };
    };
  };
}
