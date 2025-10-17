import OpenAI from 'openai';
import { AIConfig, getAIConfig } from './config/aiConfig';
import { AISuggestionProcessor, type AISuggestion } from './suggestionProcessor';
import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import { logger } from '@/lib/logging/logger';
import type { Database, Json } from '@/types/supabase.generated';

// Types for AI email processing
export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailData {
  subject: string;
  body: string;
  from: string;
  date: string;
  attachments?: EmailAttachment[];
}

export interface ParsedItem {
  itemType: 'bill' | 'receipt' | 'event' | 'appointment' | 'delivery' | 'other';
  confidenceScore: number;
  extractedData: Record<string, unknown>;
  // Review status based on confidence
  reviewStatus: 'auto_approved' | 'needs_review' | 'manual_review';
  reviewReason?: string;
  billAmount?: number;
  billDueDate?: string;
  billProvider?: string;
  billCategory?: string;
  receiptTotal?: number;
  receiptDate?: string;
  receiptStore?: string;
  receiptItems?: Array<Record<string, unknown>>;
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
  eventDescription?: string;
  // Delivery-specific fields
  deliveryDate?: string;
  deliveryProvider?: string;
  deliveryTrackingNumber?: string;
  deliveryStatus?: string;
}

export interface AIProcessingResult {
  success: boolean;
  parsedItems: ParsedItem[];
  suggestions: Array<Record<string, unknown>>;
  processingTime: number;
  error?: string;
}

export class AIEmailProcessor {
  private openai?: OpenAI;
  private supabase = createSupabaseAdminClient();
  private suggestionProcessor: AISuggestionProcessor;
  private readonly config: AIConfig;

  // Confidence thresholds for AI extraction quality
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 0.9;
  private static readonly MEDIUM_CONFIDENCE_THRESHOLD = 0.75;

  /**
   * Calculate confidence statistics for logging and monitoring
   */
  private calculateConfidenceStats(parsedItems: ParsedItem[]): {
    totalItems: number;
    averageConfidence: number;
    confidenceDistribution: { high: number; medium: number; low: number };
    reviewDistribution: { auto_approved: number; needs_review: number };
    lowConfidenceItems: Array<{ itemType: string; confidence: number; reason: string }>;
  } {
    if (parsedItems.length === 0) {
      return {
        totalItems: 0,
        averageConfidence: 0,
        confidenceDistribution: { high: 0, medium: 0, low: 0 },
        reviewDistribution: { auto_approved: 0, needs_review: 0 },
        lowConfidenceItems: []
      };
    }

    const totalConfidence = parsedItems.reduce((sum, item) => sum + item.confidenceScore, 0);
    const averageConfidence = totalConfidence / parsedItems.length;

    const confidenceDistribution = {
      high: parsedItems.filter(item => item.confidenceScore >= AIEmailProcessor.HIGH_CONFIDENCE_THRESHOLD).length,
      medium: parsedItems.filter(item => 
        item.confidenceScore >= AIEmailProcessor.MEDIUM_CONFIDENCE_THRESHOLD && 
        item.confidenceScore < AIEmailProcessor.HIGH_CONFIDENCE_THRESHOLD
      ).length,
      low: parsedItems.filter(item => item.confidenceScore < AIEmailProcessor.MEDIUM_CONFIDENCE_THRESHOLD).length
    };

    const reviewDistribution = {
      auto_approved: parsedItems.filter(item => item.reviewStatus === 'auto_approved').length,
      needs_review: parsedItems.filter(item => item.reviewStatus === 'needs_review').length
    };

    const lowConfidenceItems = parsedItems
      .filter(item => item.reviewStatus === 'needs_review')
      .map(item => ({
        itemType: item.itemType,
        confidence: item.confidenceScore,
        reason: item.reviewReason || 'Low confidence'
      }));

    return {
      totalItems: parsedItems.length,
      averageConfidence: Math.round(averageConfidence * 1000) / 1000, // Round to 3 decimal places
      confidenceDistribution,
      reviewDistribution,
      lowConfidenceItems
    };
  }

  /**
   * Assess confidence level and determine review status
   */
  private assessConfidence(confidenceScore: number): { reviewStatus: 'auto_approved' | 'needs_review' | 'manual_review'; reviewReason: string } {
    if (confidenceScore >= AIEmailProcessor.HIGH_CONFIDENCE_THRESHOLD) {
      return {
        reviewStatus: 'auto_approved',
        reviewReason: `High confidence (${(confidenceScore * 100).toFixed(1)}%) - Auto-approved`
      };
    } else if (confidenceScore >= AIEmailProcessor.MEDIUM_CONFIDENCE_THRESHOLD) {
      return {
        reviewStatus: 'auto_approved',
        reviewReason: `Medium confidence (${(confidenceScore * 100).toFixed(1)}%) - Auto-approved`
      };
    } else {
      return {
        reviewStatus: 'needs_review',
        reviewReason: `Low confidence (${(confidenceScore * 100).toFixed(1)}%) - Needs human review`
      };
    }
  }

  /**
   * Parse various delivery date formats and return ISO string or null
   */
  private parseDeliveryDate(dateString: string | undefined): string | null {
    if (!dateString || dateString.trim() === '') {
      return null;
    }

    const trimmed = dateString.trim();
    
    // Handle "Expected: Wed 21 Aug" format
    if (trimmed.match(/Expected:\s*(.+)/i)) {
      const datePart = trimmed.replace(/Expected:\s*/i, '').trim();
      return this.parseRelativeDate(datePart);
    }

    // Handle "Delivery by August 21" format
    if (trimmed.match(/Delivery\s+by\s+(.+)/i)) {
      const datePart = trimmed.replace(/Delivery\s+by\s+/i, '').trim();
      return this.parseRelativeDate(datePart);
    }

    // Handle "Arriving: 21 Aug" format
    if (trimmed.match(/Arriving:\s*(.+)/i)) {
      const datePart = trimmed.replace(/Arriving:\s*/i, '').trim();
      return this.parseRelativeDate(datePart);
    }

    // Handle "ETA: 21 Aug" format
    if (trimmed.match(/ETA:\s*(.+)/i)) {
      const datePart = trimmed.replace(/ETA:\s*/i, '').trim();
      return this.parseRelativeDate(datePart);
    }

    // Handle "Scheduled: 21 Aug" format
    if (trimmed.match(/Scheduled:\s*(.+)/i)) {
      const datePart = trimmed.replace(/Scheduled:\s*/i, '').trim();
      return this.parseRelativeDate(datePart);
    }

    // Try to parse the date directly
    return this.parseRelativeDate(trimmed);
  }

  /**
   * Parse relative dates like "Wed 21 Aug", "August 21", "21 Aug", etc.
   */
  private parseRelativeDate(dateString: string): string | null {
    try {
      // Handle "Wed 21 Aug" format
      if (dateString.match(/^\w{3}\s+\d{1,2}\s+\w{3}$/i)) {
        const currentYear = new Date().getFullYear();
        const date = new Date(`${dateString} ${currentYear}`);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }

      // Handle "August 21" or "21 Aug" format
      if (dateString.match(/^(\w+\s+\d{1,2}|\d{1,2}\s+\w+)$/i)) {
        const currentYear = new Date().getFullYear();
        const date = new Date(`${dateString} ${currentYear}`);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }

      // Handle "21/08" or "08/21" format
      if (dateString.match(/^\d{1,2}\/\d{1,2}$/)) {
        const parts = dateString.split('/');
        if (parts.length === 2 && parts[0] && parts[1]) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          if (!isNaN(day) && !isNaN(month)) {
            const currentYear = new Date().getFullYear();
            const date = new Date(currentYear, month - 1, day);
            if (!isNaN(date.getTime())) {
              return date.toISOString();
            }
          }
        }
      }

      // Handle "21-08" or "08-21" format
      if (dateString.match(/^\d{1,2}-\d{1,2}$/)) {
        const parts = dateString.split('-');
        if (parts.length === 2 && parts[0] && parts[1]) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          if (!isNaN(day) && !isNaN(month)) {
            const currentYear = new Date().getFullYear();
            const date = new Date(currentYear, month - 1, day);
            if (!isNaN(date.getTime())) {
              return date.toISOString();
            }
          }
        }
      }

      // Try to parse as ISO string
      const isoDate = new Date(dateString);
      if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString();
      }

      // If all else fails, return null
      return null;
    } catch (error) {
      logger.warn('Failed to parse delivery date', { dateString, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  constructor() {
    this.config = getAIConfig('emailProcessing');

    if (this.config.enabled && this.config.provider === 'openai') {
      if (!this.config.apiKey) {
        throw new Error('OpenAI API key is not configured for email processing');
      }

      this.openai = new OpenAI({
        apiKey: this.config.apiKey,
        timeout: this.config.timeout
      });
    }

    this.supabase = createSupabaseAdminClient();
    
    this.suggestionProcessor = new AISuggestionProcessor();
  }

  /**
   * Process an email through AI to extract structured data
   */
  async processEmail(emailData: EmailData, householdId: string): Promise<AIProcessingResult> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        success: false,
        parsedItems: [],
        suggestions: [],
        processingTime: 0,
        error: 'Email processing AI is disabled'
      };
    }

    if (this.config.provider !== 'openai' || !this.openai) {
      return {
        success: false,
        parsedItems: [],
        suggestions: [],
        processingTime: 0,
        error: 'Email processing AI provider is not configured'
      };
    }

    try {
      // Log the processing start
      await this.logProcessing(householdId, 'info', 'Starting AI email processing', {
        emailSubject: emailData.subject,
        emailFrom: emailData.from,
        step: 'start'
      });

      // Create the AI prompt for email analysis
      const prompt = this.createAnalysisPrompt(emailData);
      
      // Process with OpenAI
      const aiResponse = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that analyzes household emails to extract bills, receipts, events, and other important information. 
            You must respond with valid JSON only. Be precise and accurate in your analysis.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const aiContent = aiResponse.choices[0]?.message?.content;
      if (!aiContent) {
        throw new Error('No response from OpenAI');
      }

      // Parse AI response
      const parsedResponse = this.parseAIResponse(aiContent);
      
      // Generate suggestions based on parsed data
      const suggestions = await this.generateSuggestions(parsedResponse, householdId);
      
      // Enhanced logging with confidence details
      const confidenceStats = this.calculateConfidenceStats(parsedResponse);
      await this.logProcessing(householdId, 'info', 'AI email processing completed successfully', {
        emailSubject: emailData.subject,
        parsedItemsCount: parsedResponse.length,
        suggestionsCount: suggestions.length,
        confidenceStats,
        step: 'complete'
      });

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        parsedItems: parsedResponse,
        suggestions,
        processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Log the error
      await this.logProcessing(householdId, 'error', 'AI email processing failed', {
        emailSubject: emailData.subject,
        error: error instanceof Error ? error.message : 'Unknown error',
        step: 'error'
      });

      return {
        success: false,
        parsedItems: [],
        suggestions: [],
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a detailed prompt for AI analysis
   */
  private createAnalysisPrompt(emailData: EmailData): string {
    return `Analyze this email and extract structured information. Return ONLY valid JSON.

Email Details:
Subject: ${emailData.subject}
From: ${emailData.from}
Date: ${emailData.date}
Body: ${emailData.body.substring(0, 2000)}${emailData.body.length > 2000 ? '...' : ''}

Instructions:
1. Identify if this email contains bills, receipts, events, appointments, deliveries, or other important information
2. Extract key details like amounts, dates, providers, stores, locations, etc.
3. Assign a confidence score (0.0 to 1.0) for each identified item - be honest about uncertainty
4. Categorize the content appropriately
5. If you're unsure about any details, use a lower confidence score (below 0.75)

Return format (JSON array):
[
  {
    "itemType": "bill|receipt|event|appointment|delivery|other",
    "confidenceScore": 0.95,
    "extractedData": {
      // All extracted information in a structured format
    },
    "billAmount": 125.50,
    "billDueDate": "2024-02-15",
    "billProvider": "Origin Energy",
    "billCategory": "electricity",
    "receiptTotal": 45.20,
    "receiptDate": "2024-01-15",
    "receiptStore": "Coles",
    "receiptItems": [
      {"name": "Milk", "quantity": 2, "price": 3.50},
      {"name": "Bread", "quantity": 1, "price": 4.20}
    ],
    "eventTitle": "Dentist Appointment",
    "eventDate": "2024-02-20T14:00:00Z",
    "eventLocation": "123 Dental Clinic",
    "eventDescription": "Regular checkup appointment",
    "deliveryDate": "Expected: Wed 21 Aug",
    "deliveryProvider": "Amazon",
    "deliveryTrackingNumber": "1Z999AA1234567890",
    "deliveryStatus": "In Transit"
  }
]

Only include fields that are relevant to the item type. Be as accurate as possible.`;
  }

  /**
   * Parse the AI response into structured data
   */
  private parseAIResponse(aiContent: string): ParsedItem[] {
    try {
      // Parse JSON (responses constrained to JSON)
      const parsed = JSON.parse(aiContent);
      
      if (!Array.isArray(parsed)) {
        throw new Error('AI response is not an array');
      }

      const transformed = parsed.map(item => this.validateAndTransformItem(item));
      logger.debug?.('AI email items transformed', { count: transformed.length });
      return transformed;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      logger.error('Failed to parse AI response', err);
      throw new Error(`Failed to parse AI response: ${err.message}`);
    }
  }

  private validateAndTransformItem(item: Record<string, unknown>): ParsedItem {
    const itemType = (typeof item.itemType === 'string' ? item.itemType : 'other') as ParsedItem['itemType'];
    const validTypes: ParsedItem['itemType'][] = ['bill', 'receipt', 'event', 'appointment', 'delivery', 'other'];
    const normalizedType = validTypes.includes(itemType) ? itemType : 'other';

    const confidence = typeof item.confidenceScore === 'number' && item.confidenceScore >= 0 && item.confidenceScore <= 1
      ? item.confidenceScore
      : 0;

    const extractedData = typeof item.extractedData === 'object' && item.extractedData !== null
      ? (item.extractedData as Record<string, unknown>)
      : {};

      const confidenceAssessment = this.assessConfidence(confidence);

    return {
      itemType: normalizedType,
      confidenceScore: confidence,
      extractedData,
      reviewStatus: confidenceAssessment.reviewStatus,
      reviewReason: confidenceAssessment.reviewReason,
      billAmount: typeof item.billAmount === 'number' ? item.billAmount : 0,
      billDueDate: typeof item.billDueDate === 'string' ? item.billDueDate : '',
      billProvider: typeof item.billProvider === 'string' ? item.billProvider : '',
      billCategory: typeof item.billCategory === 'string' ? item.billCategory : '',
      receiptTotal: typeof item.receiptTotal === 'number' ? item.receiptTotal : 0,
      receiptDate: typeof item.receiptDate === 'string' ? item.receiptDate : '',
      receiptStore: typeof item.receiptStore === 'string' ? item.receiptStore : '',
      receiptItems: Array.isArray(item.receiptItems) ? (item.receiptItems as Array<Record<string, unknown>>) : [],
      eventTitle: typeof item.eventTitle === 'string' ? item.eventTitle : '',
      eventDate: typeof item.eventDate === 'string' ? item.eventDate : '',
      eventLocation: typeof item.eventLocation === 'string' ? item.eventLocation : '',
      eventDescription: typeof item.eventDescription === 'string' ? item.eventDescription : '',
      deliveryDate:
        item.itemType === 'delivery'
          ? this.parseDeliveryDate(typeof item.deliveryDate === 'string' ? item.deliveryDate : undefined) ?? ''
          : '',
      deliveryProvider: typeof item.deliveryProvider === 'string' ? item.deliveryProvider : '',
      deliveryTrackingNumber: typeof item.deliveryTrackingNumber === 'string' ? item.deliveryTrackingNumber : '',
      deliveryStatus: typeof item.deliveryStatus === 'string' ? item.deliveryStatus : '',
    };
  }

  private async generateSuggestions(parsedItems: ParsedItem[], _householdId: string): Promise<Array<Record<string, unknown>>> {
    const suggestions: Array<Record<string, unknown>> = [];

    for (const item of parsedItems) {
      switch (item.itemType) {
        case 'bill':
          suggestions.push({
            type: 'bill_action',
            data: {
              action: 'schedule_payment',
              billAmount: item.billAmount,
              dueDate: item.billDueDate,
              provider: item.billProvider,
              category: item.billCategory,
            },
            reasoning: `Detected bill from ${item.billProvider} for $${item.billAmount} due ${item.billDueDate}. Suggest scheduling payment.`
          });
          break;
        case 'receipt':
          suggestions.push({
            type: 'shopping_list_update',
            data: {
              action: 'update_pantry',
              store: item.receiptStore,
              items: item.receiptItems,
              total: item.receiptTotal,
            },
            reasoning: `Receipt from ${item.receiptStore} totaling $${item.receiptTotal}. Update pantry inventory?`
          });
          break;
        case 'event':
        case 'appointment':
          suggestions.push({
            type: 'calendar_event',
            data: {
              title: item.eventTitle,
              date: item.eventDate,
              location: item.eventLocation,
              description: item.eventDescription,
            },
            reasoning: `Detected an event (${item.eventTitle}) on ${item.eventDate}. Add to calendar?`
          });
          break;
        case 'delivery':
          suggestions.push({
            type: 'delivery_tracking',
            data: {
              provider: item.deliveryProvider,
              trackingNumber: item.deliveryTrackingNumber,
              status: item.deliveryStatus,
              expectedDelivery: item.deliveryDate,
            },
            reasoning: `Delivery update from ${item.deliveryProvider ?? 'unknown provider'} (${item.deliveryStatus ?? 'unknown status'}). Track package?`
          });
          break;
        default:
          suggestions.push({
            type: 'general_insight',
            data: {
              summary: item.extractedData ?? {},
            },
            reasoning: 'General AI insight generated from email content.',
          });
      }
    }

    return suggestions;
  }

  /**
   * Log processing information for debugging and monitoring
   */
  private async logProcessing(
    householdId: string, 
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      const logData: Database['public']['Tables']['ai_processing_logs']['Insert'] = {
        household_id: householdId,
        email_queue_id: data.emailQueueId as string | null ?? null,
        log_level: level,
        log_message: message,
        log_data: data as Json,
        processing_step: (data.step as string) || 'unknown',
      };
      await this.supabase
        .from('ai_processing_logs')
        .insert(logData);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      logger.warn('Failed to log AI processing', {
        householdId,
        error: err.message,
      });
    }
  }

  /**
   * Store parsed items in the database
   */
  async storeParsedItems(
    emailQueueId: string,
    householdId: string,
    parsedItems: ParsedItem[],
    aiModelUsed: string = getAIConfig('emailProcessing').model,
    processingTimeMs: number
  ): Promise<string[]> {
    const itemIds: string[] = [];

    for (const item of parsedItems) {
      try {
        const insertedRecord: Database['public']['Tables']['ai_parsed_items']['Insert'] = {
          email_queue_id: emailQueueId,
          household_id: householdId,
          item_type: item.itemType,
          confidence_score: item.confidenceScore,
          review_status: item.reviewStatus,
          review_reason: item.reviewReason ?? null,
          extracted_data: item.extractedData as Json,
          bill_amount: item.billAmount ?? null,
          bill_due_date: item.billDueDate ?? null,
          bill_provider: item.billProvider ?? null,
          bill_category: item.billCategory ?? null,
          receipt_total: item.receiptTotal ?? null,
          receipt_date: item.receiptDate ?? null,
          receipt_store: item.receiptStore ?? null,
          receipt_items: (item.receiptItems ?? []) as Json,
          event_title: item.eventTitle ?? null,
          event_date: item.eventDate ?? null,
          event_location: item.eventLocation ?? null,
          event_description: item.eventDescription ?? null,
          delivery_date: item.deliveryDate ?? null,
          delivery_provider: item.deliveryProvider ?? null,
          delivery_tracking_number: item.deliveryTrackingNumber ?? null,
          delivery_status: item.deliveryStatus ?? null,
          ai_model_used: aiModelUsed ?? null,
          processing_time_ms: processingTimeMs,
        };

        const { data, error } = await this.supabase
          .from('ai_parsed_items')
          .insert(insertedRecord)
          .select('id')
          .single();

        if (error) {
          const err = error instanceof Error ? error : new Error('Unknown error');
          logger.warn('Failed to store parsed item', {
            emailQueueId,
            householdId,
            error: err.message,
          });
          continue;
        }

        if (data?.id) {
          itemIds.push(data.id);
        }

      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        logger.warn('Error storing parsed item', {
          emailQueueId,
          householdId,
          error: err.message,
        });
      }
    }

    return itemIds;
  }

  /**
   * Store AI suggestions in the database and automatically process them
   */
  async storeSuggestions(
    householdId: string,
    parsedItemIds: string[],
    suggestions: Array<Record<string, unknown>>,
    userId?: string
  ): Promise<void> {
    logger.debug?.('Storing AI suggestions', {
      householdId,
      parsedItemCount: parsedItemIds.length,
      suggestionCount: suggestions.length,
      ...(userId ? { userId } : {}),
    });
    const storedSuggestions: AISuggestion[] = [];

    // First, store all suggestions
    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      const parsedItemId = parsedItemIds[i] || null;

      if (!suggestion) {
        continue;
      }

      try {
        const { data: storedSuggestion, error } = await this.supabase
          .from('ai_suggestions')
          .insert({
            parsed_item_id: parsedItemId,
            suggestion_type: String(suggestion.suggestion_type ?? suggestion.type ?? 'other'),
            suggestion_data: (suggestion.suggestion_data ?? suggestion.data ?? {}) as Json,
            ai_reasoning: typeof (suggestion.suggestion_data as Record<string, unknown> | undefined)?.reasoning === 'string'
              ? (suggestion.suggestion_data as { reasoning: string }).reasoning
              : null,
            user_feedback: 'pending',
            household_id: householdId,
          })
          .select()
          .single();

        if (error) {
          const err = error instanceof Error ? error : new Error('Unknown error');
          logger.warn('Failed to store suggestion', {
            householdId,
            suggestionType: suggestion.type,
            error: err.message,
          });
          continue;
        }

        if (storedSuggestion) {
          storedSuggestions.push(storedSuggestion as AISuggestion);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        logger.warn('Error storing suggestion', {
          householdId,
          suggestionType: suggestion.type,
          error: err.message,
        });
      }
    }

    // Then, automatically process suggestions if we have a user ID
    if (userId && storedSuggestions.length > 0) {
      try {
        logger.info('Auto-processing AI suggestions', {
          householdId,
          count: storedSuggestions.length,
        });

        const processingResults = await this.suggestionProcessor.processSuggestions(
          storedSuggestions,
          householdId,
          userId
        );

        await this.suggestionProcessor.logProcessingResults(processingResults, householdId);

        const successfulCount = processingResults.filter(r => r.success).length;
        const failedCount = processingResults.filter(r => !r.success).length;

        logger.info('AI suggestions auto-processed', {
          householdId,
          successfulCount,
          failedCount,
        });

        if (failedCount > 0) {
          logger.warn('Some AI suggestions failed during auto-processing', {
            householdId,
            failedCount,
          });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        logger.warn('Failed to auto-process suggestions', {
          householdId,
          error: err.message,
        });
      }
    }
  }
}
