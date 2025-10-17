import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AIEmailProcessor, EmailData } from '@/lib/ai/emailProcessor';
import { getAIConfig } from '@/lib/ai/config/aiConfig';
import { logger } from '@/lib/logging/logger';
import type { Database, Json } from '@/types/supabase.generated';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, _user: RequestUser | null) => {
    let currentUserId: string | null = null;

    try {
    const { userId } = await auth();
    currentUserId = userId ?? null;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's household
    const { data: userHousehold, error: householdError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();

    if (householdError || !userHousehold) {
      return NextResponse.json({ error: 'User not found in household' }, { status: 404 });
    }

    const householdId = userHousehold.household_id;

    // Parse request body
    const body = await req.json();
    const { emailData }: { emailData: EmailData } = body;

    if (!emailData || !emailData.subject || !emailData.body) {
      return NextResponse.json({ 
        error: 'Invalid email data. Required: subject, body, from, date' 
      }, { status: 400 });
    }

    const emailAttachments = emailData.attachments
      ? emailData.attachments.map(attachment => ({
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size
        }))
      : null;

    const queuePayload: Database['public']['Tables']['ai_email_queue']['Insert'] = {
      household_id: householdId,
      email_subject: emailData.subject,
      email_body: emailData.body,
      email_from: emailData.from ?? 'unknown',
      email_date: emailData.date ?? new Date().toISOString(),
      email_attachments: emailAttachments,
      processing_status: 'processing',
      priority: 1
    };

    // Add email to processing queue
    const { data: queueEntry, error: queueError } = await supabase
      .from('ai_email_queue')
      .insert(queuePayload)
      .select('id')
      .single();

    if (queueError) {
      logger.error('Failed to add email to queue', queueError, { userId: userId ?? 'unknown', householdId });
      return NextResponse.json({ error: 'Failed to queue email' }, { status: 500 });
    }

    logger.info('Queued email for AI processing', { queueId: queueEntry.id, householdId });

    // Process email with AI
    const processor = new AIEmailProcessor();
    const result = await processor.processEmail(emailData, householdId);

    if (result.success) {
      // Store parsed items
      const parsedItemIds = await processor.storeParsedItems(
        queueEntry.id,
        householdId,
        result.parsedItems,
        getAIConfig('emailProcessing').model,
        result.processingTime
      );

      // Store suggestions and auto-process them
      await processor.storeSuggestions(householdId, parsedItemIds, result.suggestions, userId);

      // Update queue status
      await supabase
        .from('ai_email_queue')
        .update({
          processing_status: 'completed',
          ai_analysis_result: {
            parsedItems: result.parsedItems as unknown as Json,
            suggestions: result.suggestions as unknown as Json,
            processingTime: result.processingTime,
          },
          processed_at: new Date().toISOString()
        })
        .eq('id', queueEntry.id);

      // Trigger automation based on parsed items
      const automatableItems = result.parsedItems.filter(item => item.itemType !== 'other');
      if (automatableItems.length > 0) {
        await triggerAutomationFromParsedItems(automatableItems as ParsedEmailItem[], householdId);
      }

      return NextResponse.json({
        success: true,
        message: 'Email processed successfully',
        data: {
          queueId: queueEntry.id,
          parsedItems: result.parsedItems.length,
          suggestions: result.suggestions.length,
          processingTime: result.processingTime
        }
      });

    } else {
      // Update queue status to failed
      await supabase
        .from('ai_email_queue')
        .update({
          processing_status: 'failed',
          error_message: result.error ?? null,
          processed_at: new Date().toISOString()
        })
        .eq('id', queueEntry.id);

      return NextResponse.json({
        success: false,
        error: result.error || 'AI processing failed'
      }, { status: 500 });
    }

    } catch (error) {
      logger.error('Error processing email', error instanceof Error ? error : new Error(String(error)), {
        userId: currentUserId ?? 'unknown'
      });
      return NextResponse.json({ 
        error: 'Internal server error' 
      }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'ai_heavy'
  });
}

/**
 * Trigger automation rules based on parsed email items
 */
type ParsedEmailItem = {
  itemType: 'bill' | 'receipt' | 'event' | 'appointment' | 'delivery';
  billAmount?: number;
  billDueDate?: string;
  billProvider?: string;
  billCategory?: string;
  receiptTotal?: number;
  receiptStore?: string;
  receiptItems?: unknown[];
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
  eventDescription?: string;
};

async function triggerAutomationFromParsedItems(parsedItems: ParsedEmailItem[], householdId: string) {
  try {
    for (const item of parsedItems) {
      let eventType = '';
      let eventData: Record<string, unknown> = {};

      switch (item.itemType) {
        case 'bill':
          eventType = 'bill.email.received';
          eventData = {
            amount: item.billAmount,
            dueDate: item.billDueDate,
            provider: item.billProvider,
            category: item.billCategory
          };
          break;

        case 'receipt':
          eventType = 'receipt.email.received';
          eventData = {
            total: item.receiptTotal,
            store: item.receiptStore,
            items: item.receiptItems
          };
          break;

        case 'event':
        case 'appointment':
          eventType = 'appointment.email.received';
          eventData = {
            title: item.eventTitle,
            date: item.eventDate,
            location: item.eventLocation
          };
          break;

        case 'delivery':
          eventType = 'delivery.email.received';
          eventData = {
            date: item.eventDate,
            description: item.eventDescription
          };
          break;
      }

      if (eventType) {
        // Post event to trigger automation
        await supabase
          .from('household_events')
          .insert({
            household_id: householdId,
            event_type: eventType,
            payload: eventData as unknown as Json,
            source: 'ai_email_parser',
            created_at: new Date().toISOString(),
            type: eventType ?? 'automation'
          });

        // Trigger automation dispatcher
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/automation/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            household_id: householdId,
            event_type: eventType,
            payload: eventData
          })
        });
      }
    }
  } catch (error) {
    logger.error('Error triggering automation from parsed items', error instanceof Error ? error : new Error(String(error)), {
      householdId
    });
  }
}