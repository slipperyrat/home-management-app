// Batch Processing API Route
// This can be easily removed if the batch processing doesn't work

import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { batchProcessor, type BatchRequest } from '@/lib/ai/services/BatchProcessor';
import { logger } from '@/lib/logging/logger';

interface BatchRequestPayload {
  type: keyof BatchRequest;
  context: unknown;
  priority?: BatchRequest['priority'];
  scheduledFor?: string;
  maxRetries?: number;
}

interface BatchRequestBody {
  action: 'create_job' | 'process_job' | 'cancel_job' | 'update_config';
  name?: string;
  description?: string;
  requests?: BatchRequestPayload[];
  jobId?: string;
  config?: Partial<ReturnType<typeof batchProcessor.getConfig>>;
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      if (!user) {
        return createErrorResponse('Unauthorized', 401);
      }
      logger.info('Batch processing POST received', { userId: user.id });

      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const body = (await req.json()) as Partial<BatchRequestBody>;
      const { action } = body;

      switch (action) {
        case 'create_job': {
          const { name, description, requests } = body;

          if (!name || !requests || !Array.isArray(requests)) {
            return createErrorResponse('Name and requests array are required', 400);
          }

          const batchRequests = requests.map((requestItem) => ({
            type: requestItem.type,
            context: requestItem.context,
            priority: requestItem.priority ?? 'medium',
            userId: user.id,
            householdId: household.id,
            scheduledFor: requestItem.scheduledFor ? new Date(requestItem.scheduledFor) : undefined,
            maxRetries: requestItem.maxRetries ?? batchProcessor.getConfig().maxRetries,
          }));

          const batchJob = await batchProcessor.createBatchJob(name, description ?? '', batchRequests);

          return createSuccessResponse(batchJob, 'Batch job created successfully');
        }
        case 'process_job': {
          const { jobId } = body;

          if (!jobId) {
            return createErrorResponse('Job ID is required', 400);
          }

          const processedJob = await batchProcessor.processBatchJob(jobId);

          return createSuccessResponse(processedJob, 'Batch job processed successfully');
        }
        case 'cancel_job': {
          const { jobId } = body;

          if (!jobId) {
            return createErrorResponse('Job ID is required', 400);
          }

          const cancelled = batchProcessor.cancelBatchJob(jobId);

          if (!cancelled) {
            return createErrorResponse('Job not found or cannot be cancelled', 404);
          }

          return createSuccessResponse({}, 'Batch job cancelled successfully');
        }
        case 'update_config': {
          const { config } = body;

          if (!config || typeof config !== 'object') {
            return createErrorResponse('Config object is required', 400);
          }

          batchProcessor.updateConfig(config);

          return createSuccessResponse({}, 'Batch processing config updated successfully');
        }
        default:
          return createErrorResponse('Unknown action', 400);
      }

    } catch (error) {
      return handleApiError(error, { route: '/api/ai/batch', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      if (!user) {
        return createErrorResponse('Unauthorized', 401);
      }
      logger.info('Batch processing GET received', { userId: user.id });

      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action') || 'overview';
      const jobId = searchParams.get('jobId');

      switch (action) {
        case 'overview': {
          const allJobs = batchProcessor.getAllBatchJobs();
          const userJobs = allJobs.filter((job) =>
            job.requests.some((reqItem) => reqItem.userId === user.id),
          );

          return createSuccessResponse({
            totalJobs: userJobs.length,
            activeJobs: userJobs.filter((job) => job.status === 'processing').length,
            pendingJobs: userJobs.filter((job) => job.status === 'pending').length,
            completedJobs: userJobs.filter((job) => job.status === 'completed').length,
            failedJobs: userJobs.filter((job) => job.status === 'failed').length,
            queueSize: batchProcessor.getQueueSize(),
            isProcessing: batchProcessor.isProcessingActive(),
            config: batchProcessor.getConfig(),
          }, 'Batch processing overview retrieved successfully');
        }
        case 'jobs': {
          const jobs = batchProcessor.getAllBatchJobs();
          const userJobsList = jobs.filter((job) =>
            job.requests.some((reqItem) => reqItem.userId === user.id),
          );

          return createSuccessResponse(userJobsList, 'Batch jobs retrieved successfully');
        }
        case 'job': {
          if (!jobId) {
            return createErrorResponse('Job ID is required', 400);
          }

          const job = batchProcessor.getBatchJob(jobId);
          if (!job) {
            return createErrorResponse('Job not found', 404);
          }

          const hasAccess = job.requests.some((reqItem) => reqItem.userId === user.id);
          if (!hasAccess) {
            return createErrorResponse('Access denied to this job', 403);
          }

          return createSuccessResponse(job, 'Batch job retrieved successfully');
        }
        case 'queue': {
          const queue = batchProcessor.getProcessingQueue();
          const userQueue = queue.filter((reqItem) => reqItem.userId === user.id);

          return createSuccessResponse(userQueue, 'Processing queue retrieved successfully');
        }
        case 'config':
          return createSuccessResponse(batchProcessor.getConfig(), 'Batch processing config retrieved successfully');
        default:
          return createErrorResponse('Unknown action', 400);
      }

    } catch (error) {
      return handleApiError(error, { route: '/api/ai/batch', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}
