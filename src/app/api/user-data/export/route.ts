import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { logger, createRequestLogger } from '@/lib/logging/logger';

export async function GET(req: NextRequest) {
  return withAPISecurity(req, async (request, user) => {
    const requestId = logger.generateRequestId();
    const log = createRequestLogger(requestId);
    
    try {
      log.apiCall('GET', '/api/user-data/export');
      
      console.log('🚀 GET: Exporting user data for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        log.apiError('GET', '/api/user-data/export', new Error('No household found'), { status: 404 });
        return createErrorResponse('No household found', 404);
      }

      const supabase = getDatabaseClient();
      log.info('Starting data export', { userId: user.id, householdId: household.id });

      // Export user's personal data
      const userDataExport = await exportUserData(supabase, user.id, household.id);
      
      // Export household data (if user is a member)
      const householdData = await exportHouseholdData(supabase, household.id);
      
      // Export audit trail
      const auditData = await exportAuditData(supabase, user.id);

      const exportData = {
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
      return handleApiError(error, { route: '/api/user-data/export', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

// Export user's personal data
async function exportUserData(supabase: any, userId: string, householdId: string | null) {
  const userData: any = {};

  // User profile
  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (userProfile) {
    userData.profile = {
      id: userProfile.id,
      email: userProfile.email,
      name: userProfile.name,
      xp: userProfile.xp,
      created_at: userProfile.created_at
    };
  }

  // User's chores
  const { data: userChores } = await supabase
    .from('chores')
    .select('*')
    .eq('assigned_to', userId);
  
  if (userChores) {
    userData.chores = userChores.map((chore: any) => ({
      id: chore.id,
      title: chore.title,
      description: chore.description,
      status: chore.status,
      assigned_to: chore.assigned_to,
      created_at: chore.created_at,
      completed_at: chore.completed_at
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
async function exportHouseholdData(supabase: any, householdId: string) {
  const householdData: any = {};

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
async function exportAuditData(supabase: any, userId: string) {
  const { data: auditTrail } = await supabase
    .rpc('get_user_audit_trail', { p_user_id: userId, p_limit: 1000 });
  
  return auditTrail || [];
}
