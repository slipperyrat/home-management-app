// Base AI Service Class
// Provides common functionality for all AI services with easy fallback

import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources/chat/completions';
import { AIConfig, getAIConfig } from '../config/aiConfig';
import { performanceMonitor } from '@/lib/monitoring/PerformanceMonitor';
import { logger } from '@/lib/logging/logger';

export interface AIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  provider: 'openai' | 'mock' | 'disabled';
  processingTime: number;
  fallbackUsed?: boolean;
}

export abstract class BaseAIService {
  protected config: AIConfig;
  protected openai?: OpenAI;
  protected featureName: string;

  constructor(featureName: keyof import('../config/aiConfig').FeatureConfig) {
    this.featureName = featureName;
    this.config = getAIConfig(featureName);
    
    if (this.config.provider === 'openai' && this.config.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.config.apiKey,
        timeout: this.config.timeout
      });
    }
  }

  protected async executeWithFallback<T>(
    aiFunction: () => Promise<T>,
    mockFunction: () => Promise<T>
  ): Promise<AIResponse<T>> {
    const startTime = Date.now();
    
    // Check if AI is disabled
    if (!this.config.enabled) {
      const result = {
        success: false,
        error: `${this.featureName} AI is disabled`,
        provider: 'disabled' as const,
        processingTime: Date.now() - startTime
      };
      
      // Record performance metric
      performanceMonitor.recordAIProcessing(
        this.featureName,
        result.processingTime,
        result.success,
        result.provider,
        false
      );
      
      return result;
    }

    // Try AI provider first
    if (this.config.provider === 'openai' && this.openai) {
      try {
        logger.info('AI service using OpenAI provider', { feature: this.featureName });
        const result = await this.withRetry(aiFunction, this.config.retryAttempts);
        const response = {
          success: true,
          data: result,
          provider: 'openai' as const,
          processingTime: Date.now() - startTime
        };
        
        // Record performance metric
        performanceMonitor.recordAIProcessing(
          this.featureName,
          response.processingTime,
          response.success,
          response.provider,
          false
        );
        
        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        logger.warn('OpenAI provider failed', { feature: this.featureName, error: err.message });
        
        // Try fallback if enabled
        if (this.config.fallbackToMock) {
          logger.info('Falling back to mock provider', { feature: this.featureName });
          try {
            const mockResult = await mockFunction();
            const response = {
              success: true,
              data: mockResult,
              provider: 'mock' as const,
              processingTime: Date.now() - startTime,
              fallbackUsed: true
            };
            
            // Record performance metric
            performanceMonitor.recordAIProcessing(
              this.featureName,
              response.processingTime,
              response.success,
              response.provider,
              true
            );
            
            return response;
          } catch (mockError) {
            const mockErr = mockError instanceof Error ? mockError : new Error('Unknown error');
            logger.error('Mock fallback failed', mockErr, { feature: this.featureName });
            return {
              success: false,
              error: `Both AI and mock failed: ${err.message}`,
              provider: 'openai',
              processingTime: Date.now() - startTime
            };
          }
        } else {
          return {
            success: false,
            error: `OpenAI failed: ${err.message}`,
            provider: 'openai',
            processingTime: Date.now() - startTime
          };
        }
      }
    }

    // Use mock provider
    if (this.config.provider === 'mock') {
      try {
        logger.info('AI service using mock provider', { feature: this.featureName });
        const result = await mockFunction();
        return {
          success: true,
          data: result,
          provider: 'mock',
          processingTime: Date.now() - startTime
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        logger.error('Mock provider failed', err, { feature: this.featureName });
        return {
          success: false,
          error: `Mock failed: ${err.message}`,
          provider: 'mock',
          processingTime: Date.now() - startTime
        };
      }
    }

    return {
      success: false,
      error: `No valid provider configured for ${this.featureName}`,
      provider: 'disabled',
      processingTime: Date.now() - startTime
    };
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    retries: number
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (i < retries) {
          const delay = Math.pow(2, i) * 1000; // Exponential backoff
          logger.info('Retrying AI provider call', {
            feature: this.featureName,
            attempt: i + 1,
            retries,
            delay,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError ?? new Error('Unknown error');
  }

  protected createOpenAIPrompt(systemPrompt: string, userPrompt: string): ChatCompletionMessageParam[] {
    const systemMessage: ChatCompletionSystemMessageParam = {
      role: 'system',
      content: systemPrompt,
    };

    const userMessage: ChatCompletionUserMessageParam = {
      role: 'user',
      content: userPrompt,
    };

    return [systemMessage, userMessage] satisfies ChatCompletionMessageParam[];
  }

  protected parseAIResponse<T>(response: string, fallback: T): T {
    try {
      // Clean the response (remove markdown if present)
      const cleanContent = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanContent);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      logger.warn('Failed to parse AI response', {
        feature: this.featureName,
        error: err.message,
      });
      return fallback;
    }
  }

  // Abstract method to be implemented by subclasses
  protected abstract getMockResponse(context?: unknown): Promise<unknown>;
}
