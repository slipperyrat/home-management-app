// Batch Processing Service for AI Operations
// This can be easily removed if the batch processing doesn't work

import { performanceMonitor } from '@/lib/monitoring/PerformanceMonitor';
import { ShoppingSuggestionsAIService, type ShoppingSuggestionsContext } from './ShoppingSuggestionsAIService';
import { MealPlanningAIService, type MealPlanningContext } from './MealPlanningAIService';
import { logger } from '@/lib/logging/logger';

export interface BatchRequestContextMap {
  shopping_suggestions: ShoppingSuggestionsContext;
  meal_planning: MealPlanningContext;
  chore_assignment: { householdId: string; chores: string[] };
  email_processing: { householdId: string; inbox: string };
}

export interface BatchRequest<TType extends keyof BatchRequestContextMap = keyof BatchRequestContextMap> {
  id: string;
  type: TType;
  context: BatchRequestContextMap[TType];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  userId: string;
  householdId: string;
  createdAt: Date;
  scheduledFor?: Date;
  retryCount: number;
  maxRetries: number;
}

export interface BatchResponse<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
  processingTime: number;
  provider: string;
  fallbackUsed: boolean;
  completedAt: Date;
}

export interface BatchJob {
  id: string;
  name: string;
  description: string;
  requests: BatchRequest[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  estimatedCompletionTime?: Date;
}

export interface BatchProcessingConfig {
  maxConcurrentRequests: number;
  batchSize: number;
  retryDelay: number;
  maxRetries: number;
  timeout: number;
  enableParallelProcessing: boolean;
  enableRetry: boolean;
  enableFallback: boolean;
}

export class BatchProcessor {
  private shoppingAI: ShoppingSuggestionsAIService;
  private mealPlanningAI: MealPlanningAIService;
  private activeJobs: Map<string, BatchJob> = new Map();
  private processingQueue: BatchRequest[] = [];
  private isProcessing = false;
  private config: BatchProcessingConfig;

  constructor() {
    this.shoppingAI = new ShoppingSuggestionsAIService();
    this.mealPlanningAI = new MealPlanningAIService();
    this.config = {
      maxConcurrentRequests: 5,
      batchSize: 10,
      retryDelay: 1000,
      maxRetries: 3,
      timeout: 30000,
      enableParallelProcessing: true,
      enableRetry: true,
      enableFallback: true,
    };
  }

  public async createBatchJob(
    name: string,
    description: string,
    requests: Omit<BatchRequest, 'id' | 'createdAt' | 'retryCount' | 'maxRetries'>[],
  ): Promise<BatchJob> {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const batchRequests: BatchRequest[] = requests.map((req) => ({
      ...req,
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    }));

    const batchJob: BatchJob = {
      id: jobId,
      name,
      description,
      requests: batchRequests,
      status: 'pending',
      createdAt: new Date(),
      totalRequests: batchRequests.length,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
    };

    this.activeJobs.set(jobId, batchJob);
    this.processingQueue.push(...batchRequests);

    logger.info('Created batch job', { jobId, requestCount: batchRequests.length });

    if (!this.isProcessing) {
      void this.startProcessing();
    }

    return batchJob;
  }

  public async processBatchJob(jobId: string): Promise<BatchJob> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Batch job ${jobId} not found`);
    }

    if (job.status !== 'pending') {
      throw new Error(`Batch job ${jobId} is not in pending status`);
    }

    job.status = 'processing';
    job.startedAt = new Date();

    logger.info('Starting batch job', { jobId, requestCount: job.requests.length });

    try {
      const results = await this.processRequests(job.requests);

      job.successfulRequests = results.filter((r) => r.success).length;
      job.failedRequests = results.filter((r) => !r.success).length;
      job.averageProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
      job.completedAt = new Date();
      job.status = job.failedRequests === 0 ? 'completed' : 'failed';

      logger.info('Batch job completed', {
        jobId,
        successful: job.successfulRequests,
        total: job.totalRequests,
      });

      return job;
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      logger.error('Batch job failed', error as Error, { jobId });
      throw error;
    }
  }

  private async processRequests(requests: BatchRequest[]): Promise<BatchResponse[]> {
    const results: BatchResponse[] = [];

    if (this.config.enableParallelProcessing) {
      const chunks = this.chunkArray(requests, this.config.maxConcurrentRequests);

      for (const chunk of chunks) {
        const chunkResults = await Promise.all(chunk.map((req) => this.processRequest(req)));
        results.push(...chunkResults);
      }
    } else {
      for (const request of requests) {
        const result = await this.processRequest(request);
        results.push(result);
      }
    }

    return results;
  }

  private async processRequest(request: BatchRequest): Promise<BatchResponse> {
    const startTime = Date.now();

    try {
      let provider = 'mock';
      let fallbackUsed = false;
      let data: unknown;

      switch (request.type) {
        case 'shopping_suggestions': {
          const { data: shoppingData, provider: shoppingProvider, fallbackUsed: shoppingFallback } = await this.shoppingAI.generateSuggestions(request.context as ShoppingSuggestionsContext);
          data = shoppingData;
          provider = shoppingProvider;
          fallbackUsed = shoppingFallback ?? false;
          break;
        }
        case 'meal_planning': {
          const { data: mealData, provider: mealProvider, fallbackUsed: mealFallback } = await this.mealPlanningAI.generateMealSuggestions(request.context as MealPlanningContext);
          data = mealData;
          provider = mealProvider;
          fallbackUsed = mealFallback ?? false;
          break;
        }
        case 'chore_assignment': {
          const choreContext = request.context as BatchRequestContextMap['chore_assignment'];
          data = await this.processChoreAssignment(choreContext);
          provider = 'mock';
          fallbackUsed = true;
          break;
        }
        case 'email_processing': {
          const emailContext = request.context as BatchRequestContextMap['email_processing'];
          data = await this.processEmailProcessing(emailContext);
          provider = 'mock';
          fallbackUsed = true;
          break;
        }
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      const processingTime = Date.now() - startTime;

      performanceMonitor.recordAIProcessing(
        request.type,
        processingTime,
        true,
        provider,
        fallbackUsed,
        request.userId,
        request.householdId,
        request.id,
      );

      return {
        id: request.id,
        success: true,
        data,
        processingTime,
        provider,
        fallbackUsed,
        completedAt: new Date(),
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      performanceMonitor.recordAIProcessing(
        request.type,
        processingTime,
        false,
        'error',
        false,
        request.userId,
        request.householdId,
        request.id,
      );

      if (this.config.enableRetry && request.retryCount < request.maxRetries) {
        request.retryCount += 1;
        logger.warn('Retrying batch request', error as Error, {
          requestId: request.id,
          attempt: request.retryCount,
          maxRetries: request.maxRetries,
        });

        setTimeout(() => {
          this.processingQueue.push(request);
          if (!this.isProcessing) {
            void this.startProcessing();
          }
        }, this.config.retryDelay * request.retryCount);

        return {
          id: request.id,
          success: false,
          error: `Retrying: ${(error as Error).message}`,
          processingTime,
          provider: 'error',
          fallbackUsed: false,
          completedAt: new Date(),
        };
      }

      logger.error('Batch request failed', error as Error, { requestId: request.id });

      return {
        id: request.id,
        success: false,
        error: (error as Error).message,
        processingTime,
        provider: 'error',
        fallbackUsed: false,
        completedAt: new Date(),
      };
    }
  }

  private async processChoreAssignment({ householdId, chores }: BatchRequestContextMap['chore_assignment']) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      assignments: chores.map((choreId) => ({
        choreId,
        assignedTo: householdId,
        dueDate: new Date().toISOString(),
        priority: 'medium' as const,
        estimatedTime: 30,
        reasoning: 'Based on workload and preferences',
      })),
      totalChores: chores.length,
      estimatedTotalTime: chores.length * 30,
    };
  }

  private async processEmailProcessing({ householdId, inbox }: BatchRequestContextMap['email_processing']) {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      processedEmails: 1,
      extractedData: {
        bills: 0,
        receipts: 1,
        events: 0,
        deliveries: 0,
      },
      confidence: 85,
      householdId,
      inbox,
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    logger.info('Starting batch processing');

    while (this.processingQueue.length > 0) {
      const batch = this.processingQueue.splice(0, this.config.batchSize);

      if (this.config.enableParallelProcessing) {
        await Promise.all(batch.map((req) => this.processRequest(req)));
      } else {
        for (const request of batch) {
          await this.processRequest(request);
        }
      }
    }

    this.isProcessing = false;
    logger.info('Batch processing completed');
  }

  public getBatchJob(jobId: string): BatchJob | undefined {
    return this.activeJobs.get(jobId);
  }

  public getAllBatchJobs(): BatchJob[] {
    return Array.from(this.activeJobs.values());
  }

  public getProcessingQueue(): BatchRequest[] {
    return [...this.processingQueue];
  }

  public getQueueSize(): number {
    return this.processingQueue.length;
  }

  public clearQueue(): void {
    this.processingQueue = [];
    logger.info('Processing queue cleared');
  }

  public cancelBatchJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    if (job.status === 'pending' || job.status === 'processing') {
      job.status = 'cancelled';
      job.completedAt = new Date();

      this.processingQueue = this.processingQueue.filter(
        (req) => !job.requests.some((jobReq) => jobReq.id === req.id),
      );

      logger.warn('Batch job cancelled', { jobId });
      return true;
    }

    return false;
  }

  public updateConfig(newConfig: Partial<BatchProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Batch processing config updated', { config: this.config });
  }

  public getConfig(): BatchProcessingConfig {
    return { ...this.config };
  }

  public isProcessingActive(): boolean {
    return this.isProcessing;
  }

  public getActiveJobsCount(): number {
    return this.activeJobs.size;
  }
}

export const batchProcessor = new BatchProcessor();
