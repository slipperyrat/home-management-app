import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, verifyHouseholdAccess, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createAutomationRuleSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      logger.info('Creating automation rule', { userId: user.id });

      // Parse and validate request body using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        validatedData = createAutomationRuleSchema.parse(body);
      } catch (validationError: unknown) {
        if (validationError instanceof Error && 'errors' in validationError) {
          return createErrorResponse('Invalid input', 400, (validationError as { errors: unknown }).errors);
        }
        return createErrorResponse('Invalid input', 400);
      }

      const { household_id, name, description, trigger_types, actions } = validatedData;

      // Verify user has access to this household
      const { hasAccess, role } = await verifyHouseholdAccess(user.id, household_id);

      if (!hasAccess) {
        return createErrorResponse('Access denied to household', 403);
      }

      // Check if user has permission to create rules (owner or admin)
      if (role !== 'owner' && role !== 'admin') {
        return createErrorResponse('Insufficient permissions to create automation rules', 403);
      }

      // Create the automation rule
      const supabase = getDatabaseClient();
      const { data: rule, error: ruleError } = await supabase
        .from('automation_rules')
        .insert({
          household_id,
          name,
          description: description || '',
          trigger_types,
          actions,
          enabled: true,
          created_by: user.id
        })
        .select()
        .single();

      if (ruleError) {
        logger.error('Error creating automation rule', ruleError, { householdId: household_id, userId: user.id });
        return createErrorResponse('Failed to create automation rule', 500, ruleError.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'automation_rule.created',
        targetTable: 'automation_rules',
        targetId: rule.id,
        userId: user.id,
        metadata: { 
          rule_name: name,
          household_id,
          trigger_types,
          actions_count: actions.length
        }
      });

      logger.info('Automation rule created', { householdId: household_id, userId: user.id, ruleId: rule.id });

      return createSuccessResponse({
        rule: {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          trigger_types: rule.trigger_types,
          actions: rule.actions,
          enabled: rule.enabled
        }
      }, 'Automation rule created successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/automation/create-rule', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
