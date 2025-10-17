import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, handleApiError } from '@/lib/api/errors';
import { logger, createRequestLogger } from '@/lib/logging/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.generated';

type SupabaseClientType = SupabaseClient<Database>;

type RewardRedemptionRow = Database['public']['Tables']['reward_redemptions']['Row'];
type ShoppingListRow = Database['public']['Tables']['shopping_lists']['Row'];
type MealPlanRow = Database['public']['Tables']['meal_plans']['Row'];
type RecipeRow = Database['public']['Tables']['recipes']['Row'];
type BillRow = Database['public']['Tables']['bills']['Row'];

interface UserProfileExport {
  id: string;
  email: string | null;
  name: string | null;
  xp: number | null;
  created_at: string | null;
}

interface UserChoreExport {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string | null;
  completed_at: string | null;
}

interface UserDataExport {
  profile?: UserProfileExport;
  chores?: UserChoreExport[];
  rewards?: RewardRedemptionRow[];
}

interface HouseholdDataExport {
  info?: {
    id: string;
    name: string | null;
    game_mode: string | null;
    created_at: string | null;
  };
  shopping_lists?: ShoppingListRow[];
  meal_plans?: MealPlanRow[];
  recipes?: RecipeRow[];
  bills?: BillRow[];
}

type AuditTrailEntry = Record<string, unknown>;

interface ExportPayload {
  export_date: string;
  user_id: string;
  user_data: UserDataExport;
  household_data: HouseholdDataExport;
  audit_trail: AuditTrailEntry[];
  export_format: 'json';
  privacy_notice: string;
}

export async function GET(req: NextRequest) {
  return withAPISecurity(req, async (_request, user) => {
    const requestId = logger.generateRequestId();
    const log = createRequestLogger(requestId);
    
    try {
      log.apiCall('GET', '/api/user-data/export');
      
      // Get user and household data
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        log.apiError('GET', '/api/user-data/export', new Error('No household found'), { status: 404 });
        return createErrorResponse('No household found', 404);
      }

      const supabase = getDatabaseClient();
      log.info('Starting data export', { userId: user.id, householdId: household.id });

      // Export user's personal data
      const userDataExport = await exportUserData(supabase, user.id);
      
      // Export household data (if user is a member)
      const householdData = await exportHouseholdData(supabase, household.id);
      
      // Export audit trail
      const auditData = await exportAuditData(supabase, user.id);

      const exportData: ExportPayload = {
        export_date: new Date().toISOString(),
        user_id: user.id,
        user_data: userDataExport,
        household_data: householdData,
        audit_trail: auditData,
        export_format: 'json',
        privacy_notice: 'This export contains all your personal data stored in the application.'
      };

      log.apiSuccess('GET', '/api/user-data/export', { 
        userId: user.id, 
        householdId: household.id,
        exportSize: JSON.stringify(exportData).length 
      });

      // Add audit log entry
      await createAuditLog({
        action: 'user_data.exported',
        targetTable: 'users',
        targetId: user.id,
        userId: user.id,
        metadata: { 
          household_id: household.id,
          export_size: JSON.stringify(exportData).length
        }
      });

      // Return as downloadable JSON file
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="user-data-export-${new Date().toISOString().split('T')[0]}.json"`
        }
      });

    } catch (error) {
      return handleApiError(error, {
        route: '/api/user-data/export',
        method: 'GET',
        userId: user?.id ?? '',
      });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

// Export user's personal data
async function exportUserData(
  supabase: SupabaseClientType,
  userId: string,
): Promise<UserDataExport> {
  const userData: UserDataExport = {};

  // User profile
  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (userProfile) {
    const fullName = [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ').trim() || null;
    userData.profile = {
      id: userProfile.id,
      email: userProfile.email,
      name: fullName,
      xp: userProfile.xp,
      created_at: userProfile.created_at,
    };
  }

  // User's chores
  const { data: userChores } = await supabase
    .from('chores')
    .select('*')
    .eq('assigned_to', userId);
  
  if (userChores) {
    userData.chores = userChores.map((chore) => ({
      id: chore.id,
      title: chore.title,
      description: chore.description,
      status: chore.status,
      assigned_to: chore.assigned_to,
      created_at: chore.created_at,
      completed_at: 'completed_at' in chore ? (chore as { completed_at?: string | null }).completed_at ?? null : null,
    }));
  }

  // User's rewards and redemptions
  const { data: userRewards } = await supabase
    .from('reward_redemptions')
    .select('*')
    .eq('user_id', userId);
  
  if (userRewards) {
    userData.rewards = userRewards;
  }

  return userData;
}

// Export household data
async function exportHouseholdData(
  supabase: SupabaseClientType,
  householdId: string,
): Promise<HouseholdDataExport> {
  const householdData: HouseholdDataExport = {};

  // Household info
  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('id', householdId)
    .single();
  
  if (household) {
    householdData.info = {
      id: household.id,
      name: household.name,
      game_mode: household.game_mode,
      created_at: household.created_at
    };
  }

  // Shopping lists
  const { data: shoppingLists } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('household_id', householdId);
  
  if (shoppingLists) {
    householdData.shopping_lists = shoppingLists;
  }

  // Meal plans
  const { data: mealPlans } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('household_id', householdId);
  
  if (mealPlans) {
    householdData.meal_plans = mealPlans;
  }

  // Recipes
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('household_id', householdId);
  
  if (recipes) {
    householdData.recipes = recipes;
  }

  // Bills
  const { data: bills } = await supabase
    .from('bills')
    .select('*')
    .eq('household_id', householdId);
  
  if (bills) {
    householdData.bills = bills;
  }

  return householdData;
}

// Export audit trail
async function exportAuditData(supabase: SupabaseClientType, userId: string): Promise<AuditTrailEntry[]> {
  const { data: auditTrail } = await supabase
    .rpc('get_user_audit_trail', { p_user_id: userId, p_limit: 1000 });
  
  return auditTrail || [];
}
