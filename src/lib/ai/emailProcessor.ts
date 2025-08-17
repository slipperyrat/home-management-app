import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

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

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
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
        model: 'gpt-4',
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
      
      // Log successful processing
      await this.logProcessing(householdId, 'info', 'AI email processing completed successfully', {
        emailSubject: emailData.subject,
        parsedItemsCount: parsedResponse.length,
        suggestionsCount: suggestions.length,
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
3. Assign a confidence score (0.0 to 1.0) for each identified item
4. Categorize the content appropriately

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
    "eventDescription": "Regular checkup appointment"
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

    return {
      itemType: item.itemType,
      confidenceScore: item.confidenceScore,
      extractedData: item.extractedData,
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
    };
  }

  /**
   * Generate AI suggestions based on parsed data
   */
  private async generateSuggestions(parsedItems: ParsedItem[], householdId: string): Promise<any[]> {
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
              deliveryDate: item.eventDate,
              description: `Prepare for delivery: ${item.eventDescription}`,
            },
            reasoning: `Delivery scheduled for ${item.eventDate}. Suggest creating preparation tasks.`
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
    aiModelUsed: string = 'gpt-4',
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
   * Store AI suggestions in the database
   */
  async storeSuggestions(
    householdId: string,
    parsedItemIds: string[],
    suggestions: any[]
  ): Promise<void> {
    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      const parsedItemId = parsedItemIds[i] || null;

      try {
        await this.supabase
          .from('ai_suggestions')
          .insert({
            household_id: householdId,
            parsed_item_id: parsedItemId,
            suggestion_type: suggestion.type,
            suggestion_data: suggestion.data,
            ai_reasoning: suggestion.reasoning,
            user_feedback: 'pending'
          });
      } catch (error) {
        console.error('Failed to store suggestion:', error);
      }
    }
  }
}
