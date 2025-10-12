import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { logger } from '@/lib/logging/logger';

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {

    logger.info('Database check request', { userId: user.id });

    // Check what tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      logger.error('Error fetching tables', tablesError);
      return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
    }

    const tableNames = tables?.map(t => t.table_name) || [];
    logger.info('Available tables', { tableNames });

    // Check if key tables exist
    const hasUsers = tableNames.includes('users');
    const hasHouseholds = tableNames.includes('households');
    const hasHouseholdMembers = tableNames.includes('household_members');

    // If users table exists, check its columns
    let userColumns: string[] = [];
    if (hasUsers) {
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'users');

      if (!columnsError) {
        userColumns = columns?.map(c => c.column_name) || [];
      }
    }

    // Check if user exists in users table
    let userExists = false;
    if (hasUsers) {
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      userExists = !userError && !!userRow;
    }

    // Check if user exists in household_members
    let householdMemberExists = false;
    let userHouseholdId: string | null = null;
    if (hasHouseholdMembers) {
      const { data: member, error: memberError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .single();

      householdMemberExists = !memberError && !!member;
      userHouseholdId = member?.household_id || null;
    }

    const result: {
      success: boolean;
      tables: {
        available: string[];
        hasUsers: boolean;
        hasHouseholds: boolean;
        hasHouseholdMembers: boolean;
      };
      userColumns: string[];
      userStatus: {
        exists: boolean;
        householdMemberExists: boolean;
        householdId: string | null;
      };
      missingTables: string[];
      missingColumns: string[];
    } = {
      success: true,
      tables: {
        available: tableNames,
        hasUsers,
        hasHouseholds,
        hasHouseholdMembers
      },
      userColumns,
      userStatus: {
        exists: userExists,
        householdMemberExists,
        householdId: userHouseholdId
      },
      missingTables: [],
      missingColumns: []
    };

    // Identify what's missing
    if (!hasUsers) result.missingTables.push('users');
    if (!hasHouseholds) result.missingTables.push('households');
    if (!hasHouseholdMembers) result.missingTables.push('household_members');

    if (hasUsers) {
      if (!userColumns.includes('xp')) result.missingColumns.push('users.xp');
      if (!userColumns.includes('email')) result.missingColumns.push('users.email');
      if (!userColumns.includes('role')) result.missingColumns.push('users.role');
    }

    logger.info('Database check result', result);

    return NextResponse.json(result);

  } catch (error) {
    logger.error('Unexpected error in check-db API', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}
