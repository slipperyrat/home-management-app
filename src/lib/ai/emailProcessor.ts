import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { AISuggestionProcessor } from './suggestionProcessor';

// Types for AI email processing
export interface EmailData {
  subject: string;
  body: string;
  from: string;
  date: string;
  attachments?: any[];
}

export interface ParsedItem {
  itemType: 'bill' | 'receipt' | 'event' | 'appointment' | 'delivery' | 'other';
  confidenceScore: number;
  extractedData: any;
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
  receiptItems?: any[];
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
  suggestions: any[];
  processingTime: number;
  error?: string;
}

export class AIEmailProcessor {
  private openai: OpenAI;
  private supabase: any;

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
        if (parts.length === 2) {
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
        if (parts.length === 2) {
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
      console.warn(`Failed to parse date: ${dateString}`, error);
      return null;
    }
  }

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.suggestionProcessor = new AISuggestionProcessor();
  }

  /**
   * Process an email through AI to extract structured data
   */
  async processEmail(emailData: EmailData, householdId: string): Promise<AIProcessingResult> {
    const startTime = Date.now();
    
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
        model: 'gpt-3.5-turbo',
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
        temperature: 0.1, // Low temperature for consistent, accurate results
        max_tokens: 2000,
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
      // Clean the response (remove markdown if present)
      const cleanContent = aiContent.replace(/```json\n?|\n?```/g, '').trim();
      
      // Parse JSON
      const parsed = JSON.parse(cleanContent);
      
      if (!Array.isArray(parsed)) {
        throw new Error('AI response is not an array');
      }

      // Validate and transform each item
      return parsed.map(item => this.validateAndTransformItem(item));
      
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate and transform an AI response item
   */
  private validateAndTransformItem(item: any): ParsedItem {
    // Ensure required fields exist
    if (!item.itemType || !item.confidenceScore || !item.extractedData) {
      throw new Error('Missing required fields in AI response item');
    }

    // Validate item type
    const validTypes = ['bill', 'receipt', 'event', 'appointment', 'delivery', 'other'];
    if (!validTypes.includes(item.itemType)) {
      throw new Error(`Invalid item type: ${item.itemType}`);
    }

    // Validate confidence score
    if (typeof item.confidenceScore !== 'number' || item.confidenceScore < 0 || item.confidenceScore > 1) {
      throw new Error(`Invalid confidence score: ${item.confidenceScore}`);
    }

    // Assess confidence and determine review status
    const confidenceAssessment = this.assessConfidence(item.confidenceScore);

    return {
      itemType: item.itemType,
      confidenceScore: item.confidenceScore,
      extractedData: item.extractedData,
      // Review status based on confidence
      reviewStatus: confidenceAssessment.reviewStatus,
      reviewReason: confidenceAssessment.reviewReason,
      billAmount: item.billAmount,
      billDueDate: item.billDueDate,
      billProvider: item.billProvider,
      billCategory: item.billCategory,
      receiptTotal: item.receiptTotal,
      receiptDate: item.receiptDate,
      receiptStore: item.receiptStore,
      receiptItems: item.receiptItems,
      eventTitle: item.eventTitle,
      eventDate: item.eventDate,
      eventLocation: item.eventLocation,
      eventDescription: item.eventDescription,
      // Parse and validate delivery fields
      deliveryDate: item.itemType === 'delivery' ? this.parseDeliveryDate(item.deliveryDate) : undefined,
      deliveryProvider: item.deliveryProvider,
      deliveryTrackingNumber: item.deliveryTrackingNumber,
      deliveryStatus: item.deliveryStatus,
    };
  }

  /**
   * Generate AI suggestions based on parsed data
   */
  private async generateSuggestions(parsedItems: ParsedItem[], _householdId: string): Promise<any[]> {
    const suggestions = [];

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
            reasoning: `Receipt from ${item.receiptStore} shows grocery purchase. Suggest updating pantry inventory.`
          });
          break;

        case 'event':
        case 'appointment':
          suggestions.push({
            type: 'calendar_event',
            data: {
              action: 'create_event',
              title: item.eventTitle,
              date: item.eventDate,
              location: item.eventLocation,
              description: item.eventDescription,
            },
            reasoning: `Detected ${item.itemType}: ${item.eventTitle} on ${item.eventDate}. Suggest adding to calendar.`
          });
          break;

        case 'delivery':
          suggestions.push({
            type: 'chore_creation',
            data: {
              action: 'schedule_delivery_tasks',
              deliveryDate: item.deliveryDate,
              description: `Prepare for delivery: ${item.eventDescription || 'Package delivery'}`,
              provider: item.deliveryProvider,
              trackingNumber: item.deliveryTrackingNumber,
              status: item.deliveryStatus,
            },
            reasoning: `Delivery ${item.deliveryDate ? `scheduled for ${item.deliveryDate}` : 'detected'} from ${item.deliveryProvider || 'delivery service'}. Suggest creating preparation tasks.`
          });
          break;
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
    data: any
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
      // Don't fail the main process if logging fails
      console.error('Failed to log AI processing:', error);
    }
  }

  /**
   * Store parsed items in the database
   */
  async storeParsedItems(
    emailQueueId: string,
    householdId: string,
    parsedItems: ParsedItem[],
    aiModelUsed: string = 'gpt-3.5-turbo',
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
          console.error('Failed to store parsed item:', error);
          continue;
        }

        if (data?.id) {
          itemIds.push(data.id);
        }

      } catch (error) {
        console.error('Error storing parsed item:', error);
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
    suggestions: any[],
    userId?: string
  ): Promise<void> {
    const storedSuggestions: any[] = [];

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
          console.error('Failed to store suggestion:', error);
          continue;
        }

        if (storedSuggestion) {
          storedSuggestions.push(storedSuggestion);
        }
      } catch (error) {
        console.error('Failed to store suggestion:', error);
      }
    }

    // Then, automatically process suggestions if we have a user ID
    if (userId && storedSuggestions.length > 0) {
      try {
        console.log(`🔄 Auto-processing ${storedSuggestions.length} AI suggestions...`);
        
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
        
        console.log(`✅ Auto-processed ${successfulCount} suggestions successfully`);
        if (failedCount > 0) {
          console.log(`❌ Failed to process ${failedCount} suggestions`);
        }

      } catch (error) {
        console.error('Failed to auto-process suggestions:', error);
        // Don't fail the main process if auto-processing fails
      }
    }
  }
}
