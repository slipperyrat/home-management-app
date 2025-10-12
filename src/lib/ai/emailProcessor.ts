import OpenAI from 'openai';
import { AIConfig, getAIConfig } from './config/aiConfig';
import { AISuggestionProcessor } from './suggestionProcessor';
import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import { logger } from '@/lib/logging/logger';

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
  deliveryDate?: string | null;
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
      logger.warn('Failed to parse delivery date', error as Error, { dateString });
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
      logger.error('Failed to parse AI response', error as Error);
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateAndTransformItem(item: Record<string, unknown>): ParsedItem {
    if (!item.itemType || !item.confidenceScore || !item.extractedData) {
      throw new Error('Missing required fields in AI response item');
    }

    const validTypes: ParsedItem['itemType'][] = ['bill', 'receipt', 'event', 'appointment', 'delivery', 'other'];
    if (!validTypes.includes(item.itemType as ParsedItem['itemType'])) {
      throw new Error(`Invalid item type: ${item.itemType}`);
    }

    if (typeof item.confidenceScore !== 'number' || item.confidenceScore < 0 || item.confidenceScore > 1) {
      throw new Error(`Invalid confidence score: ${item.confidenceScore}`);
    }

    const confidenceAssessment = this.assessConfidence(item.confidenceScore);

    return {
      itemType: item.itemType as ParsedItem['itemType'],
      confidenceScore: item.confidenceScore,
      extractedData: item.extractedData as Record<string, unknown>,
      reviewStatus: confidenceAssessment.reviewStatus,
      reviewReason: confidenceAssessment.reviewReason,
      billAmount: item.billAmount as number | undefined,
      billDueDate: item.billDueDate as string | undefined,
      billProvider: item.billProvider as string | undefined,
      billCategory: item.billCategory as string | undefined,
      receiptTotal: item.receiptTotal as number | undefined,
      receiptDate: item.receiptDate as string | undefined,
      receiptStore: item.receiptStore as string | undefined,
      receiptItems: item.receiptItems as Array<Record<string, unknown>> | undefined,
      eventTitle: item.eventTitle as string | undefined,
      eventDate: item.eventDate as string | undefined,
      eventLocation: item.eventLocation as string | undefined,
      eventDescription: item.eventDescription as string | undefined,
      deliveryDate: item.itemType === 'delivery' ? this.parseDeliveryDate(item.deliveryDate as string | undefined) : null,
      deliveryProvider: item.deliveryProvider as string | undefined,
      deliveryTrackingNumber: item.deliveryTrackingNumber as string | undefined,
      deliveryStatus: item.deliveryStatus as string | undefined,
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
            reasoning: `Delivery update from ${item.deliveryProvider} (${item.deliveryStatus}). Track package?`
          });
          break;
        default:
          suggestions.push(this.createFallbackSuggestion(item, _householdId));
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
      await this.supabase
        .from('ai_processing_logs')
        .insert({
          household_id: householdId,
          log_level: level,
          log_message: message,
          log_data: data,
          processing_step: data.step || 'unknown'
        });
    } catch (error) {
      logger.warn('Failed to log AI processing', error as Error, { householdId });
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
        const { data, error } = await this.supabase
          .from('ai_parsed_items')
          .insert({
            email_queue_id: emailQueueId,
            household_id: householdId,
            item_type: item.itemType,
            confidence_score: item.confidenceScore,
            // Store review status and confidence details
            review_status: item.reviewStatus,
            review_reason: item.reviewReason,
            extracted_data: item.extractedData,
            bill_amount: item.billAmount,
            bill_due_date: item.billDueDate,
            bill_provider: item.billProvider,
            bill_category: item.billCategory,
            receipt_total: item.receiptTotal,
            receipt_date: item.receiptDate,
            receipt_store: item.receiptStore,
            receipt_items: item.receiptItems,
            event_title: item.eventTitle,
            event_date: item.eventDate,
            event_location: item.eventLocation,
            event_description: item.eventDescription,
            // Store delivery-specific fields
            delivery_date: item.deliveryDate,
            delivery_provider: item.deliveryProvider,
            delivery_tracking_number: item.deliveryTrackingNumber,
            delivery_status: item.deliveryStatus,
            ai_model_used: aiModelUsed,
            processing_time_ms: processingTimeMs,
          })
          .select('id')
          .single();

        if (error) {
          logger.warn('Failed to store parsed item', error, { emailQueueId, householdId });
          continue;
        }

        if (data?.id) {
          itemIds.push(data.id);
        }

      } catch (error) {
        logger.warn('Error storing parsed item', error as Error, { emailQueueId, householdId });
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
    logger.debug?.('Storing AI suggestions', { householdId, parsedItemCount: parsedItemIds.length, suggestionCount: suggestions.length, userId });
    const storedSuggestions: Array<Record<string, unknown>> = [];

    // First, store all suggestions
    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      const parsedItemId = parsedItemIds[i] || null;

      try {
        const { data: storedSuggestion, error } = await this.supabase
          .from('ai_suggestions')
          .insert({
            household_id: householdId,
            parsed_item_id: parsedItemId,
            suggestion_type: suggestion.type,
            suggestion_data: suggestion.data,
            ai_reasoning: suggestion.reasoning,
            user_feedback: 'pending'
          })
          .select()
          .single();

        if (error) {
          logger.warn('Failed to store suggestion', error, { householdId, suggestionType: suggestion.type });
          continue;
        }

        if (storedSuggestion) {
          storedSuggestions.push(storedSuggestion);
        }
      } catch (error) {
        logger.warn('Error storing suggestion', error as Error, { householdId, suggestionType: suggestion.type });
      }
    }

    // Then, automatically process suggestions if we have a user ID
    if (userId && storedSuggestions.length > 0) {
      try {
        logger.info('Auto-processing AI suggestions', { householdId, count: storedSuggestions.length });
        
        const processingResults = await this.suggestionProcessor.processSuggestions(
          storedSuggestions,
          householdId,
          userId
        );

        // Log the processing results
        await this.suggestionProcessor.logProcessingResults(processingResults, householdId);

        // Log summary
        const successfulCount = processingResults.filter(r => r.success).length;
        const failedCount = processingResults.filter(r => !r.success).length;
        
        logger.info('AI suggestions auto-processed', { householdId, successfulCount, failedCount });
        if (failedCount > 0) {
          logger.warn('Some AI suggestions failed during auto-processing', { householdId, failedCount });
        }

      } catch (error) {
        logger.warn('Failed to auto-process suggestions', error as Error, { householdId });
        // Don't fail the main process if auto-processing fails
      }
    }
  }
}
