// Batch Processing Service for AI Operations
// This can be easily removed if the batch processing doesn't work

import { performanceMonitor } from '@/lib/monitoring/PerformanceMonitor';
import { ShoppingSuggestionsAIService } from './ShoppingSuggestionsAIService';
import { MealPlanningAIService } from './MealPlanningAIService';

export interface BatchRequest {
  id: string;
  type: 'shopping_suggestions' | 'meal_planning' | 'chore_assignment' | 'email_processing';
  context: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  userId: string;
  householdId: string;
  createdAt: Date;
  scheduledFor?: Date;
  retryCount: number;
  maxRetries: number;
}

export interface BatchResponse {
  id: string;
  success: boolean;
  data?: any;
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
  private isProcessing: boolean = false;
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
      enableFallback: true
    };
  }

  public async createBatchJob(
    name: string,
    description: string,
    requests: Omit<BatchRequest, 'id' | 'createdAt' | 'retryCount'>[]
  ): Promise<BatchJob> {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batchRequests: BatchRequest[] = requests.map(req => ({
      ...req,
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: this.config.maxRetries
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
      averageProcessingTime: 0
    };

    this.activeJobs.set(jobId, batchJob);
    this.processingQueue.push(...batchRequests);

    console.log(`📦 Created batch job ${jobId} with ${batchRequests.length} requests`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
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

    console.log(`🚀 Starting batch job ${jobId} with ${job.requests.length} requests`);

    try {
      const results = await this.processRequests(job.requests);
      
      // Update job with results
      job.successfulRequests = results.filter(r => r.success).length;
      job.failedRequests = results.filter(r => !r.success).length;
      job.averageProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
      job.completedAt = new Date();
      job.status = job.failedRequests === 0 ? 'completed' : 'failed';

      console.log(`✅ Batch job ${jobId} completed: ${job.successfulRequests}/${job.totalRequests} successful`);

      return job;

    } catch (error: any) {
      console.error(`❌ Batch job ${jobId} failed:`, error);
      job.status = 'failed';
      job.completedAt = new Date();
      throw error;
    }
  }

  private async processRequests(requests: BatchRequest[]): Promise<BatchResponse[]> {
    const results: BatchResponse[] = [];
    
    if (this.config.enableParallelProcessing) {
      // Process requests in parallel with concurrency limit
      const chunks = this.chunkArray(requests, this.config.maxConcurrentRequests);
      
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(req => this.processRequest(req))
        );
        results.push(...chunkResults);
      }
    } else {
      // Process requests sequentially
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
      let result: any;
      let provider = 'mock';
      let fallbackUsed = false;

      switch (request.type) {
        case 'shopping_suggestions':
          const shoppingResult = await this.shoppingAI.generateSuggestions(request.context);
          result = shoppingResult.data;
          provider = shoppingResult.provider;
          fallbackUsed = shoppingResult.fallbackUsed || false;
          break;

        case 'meal_planning':
          const mealResult = await this.mealPlanningAI.generateMealSuggestions(request.context);
          result = mealResult.data;
          provider = mealResult.provider;
          fallbackUsed = mealResult.fallbackUsed || false;
          break;

        case 'chore_assignment':
          result = await this.processChoreAssignment(request.context);
          provider = 'mock';
          fallbackUsed = true;
          break;

        case 'email_processing':
          result = await this.processEmailProcessing(request.context);
          provider = 'mock';
          fallbackUsed = true;
          break;

        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      const processingTime = Date.now() - startTime;

      // Record performance metric
      performanceMonitor.recordAIProcessing(
        request.type,
        processingTime,
        true,
        provider,
        fallbackUsed,
        request.userId,
        request.householdId,
        request.id
      );

      return {
        id: request.id,
        success: true,
        data: result,
        processingTime,
        provider,
        fallbackUsed,
        completedAt: new Date()
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      // Record performance metric
      performanceMonitor.recordAIProcessing(
        request.type,
        processingTime,
        false,
        'error',
        false,
        request.userId,
        request.householdId,
        request.id
      );

      // Retry logic
      if (this.config.enableRetry && request.retryCount < request.maxRetries) {
        request.retryCount++;
        console.log(`🔄 Retrying request ${request.id} (attempt ${request.retryCount}/${request.maxRetries})`);
        
        // Add back to queue with delay
        setTimeout(() => {
          this.processingQueue.push(request);
        }, this.config.retryDelay * request.retryCount);

        return {
          id: request.id,
          success: false,
          error: `Retrying: ${error.message}`,
          processingTime,
          provider: 'error',
          fallbackUsed: false,
          completedAt: new Date()
        };
      }

      return {
        id: request.id,
        success: false,
        error: error.message,
        processingTime,
        provider: 'error',
        fallbackUsed: false,
        completedAt: new Date()
      };
    }
  }

  private async processChoreAssignment(context: any): Promise<any> {
    // Mock chore assignment processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      assignments: [
        {
          choreId: 'chore_1',
          assignedTo: 'user_1',
          dueDate: new Date().toISOString(),
          priority: 'medium',
          estimatedTime: 30,
          reasoning: 'Based on workload and preferences'
        }
      ],
      totalChores: 1,
      estimatedTotalTime: 30
    };
  }

  private async processEmailProcessing(context: any): Promise<any> {
    // Mock email processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      processedEmails: 1,
      extractedData: {
        bills: 0,
        receipts: 1,
        events: 0,
        deliveries: 0
      },
      confidence: 85
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
    console.log('🚀 Starting batch processing');

    while (this.processingQueue.length > 0) {
      const batch = this.processingQueue.splice(0, this.config.batchSize);
      
      if (this.config.enableParallelProcessing) {
        await Promise.all(batch.map(req => this.processRequest(req)));
      } else {
        for (const request of batch) {
          await this.processRequest(request);
        }
      }
    }

    this.isProcessing = false;
    console.log('✅ Batch processing completed');
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
    console.log('🧹 Processing queue cleared');
  }

  public cancelBatchJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    if (job.status === 'pending' || job.status === 'processing') {
      job.status = 'cancelled';
      job.completedAt = new Date();
      
      // Remove job requests from queue
      this.processingQueue = this.processingQueue.filter(req => 
        !job.requests.some(jobReq => jobReq.id === req.id)
      );
      
      console.log(`❌ Batch job ${jobId} cancelled`);
      return true;
    }

    return false;
  }

  public updateConfig(newConfig: Partial<BatchProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Batch processing config updated');
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

// Singleton instance
export const batchProcessor = new BatchProcessor();
