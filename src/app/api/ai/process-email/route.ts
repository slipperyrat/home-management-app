import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { AIEmailProcessor, EmailData } from '@/lib/ai/emailProcessor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
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
    const body = await request.json();
    const { emailData }: { emailData: EmailData } = body;

    if (!emailData || !emailData.subject || !emailData.body) {
      return NextResponse.json({ 
        error: 'Invalid email data. Required: subject, body, from, date' 
      }, { status: 400 });
    }

    // Add email to processing queue
    const { data: queueEntry, error: queueError } = await supabase
      .from('ai_email_queue')
      .insert({
        household_id: householdId,
        email_subject: emailData.subject,
        email_body: emailData.body,
        email_from: emailData.from || 'unknown',
        email_date: emailData.date || new Date().toISOString(),
        email_attachments: emailData.attachments || [],
        processing_status: 'processing',
        priority: 1
      })
      .select('id')
      .single();

    if (queueError) {
      console.error('Failed to add email to queue:', queueError);
      return NextResponse.json({ error: 'Failed to queue email' }, { status: 500 });
    }

    // Process email with AI
    const processor = new AIEmailProcessor();
    const result = await processor.processEmail(emailData, householdId);

    if (result.success) {
      // Store parsed items
      const parsedItemIds = await processor.storeParsedItems(
        queueEntry.id,
        householdId,
        result.parsedItems,
        'gpt-4',
        result.processingTime
      );

      // Store suggestions
      await processor.storeSuggestions(householdId, parsedItemIds, result.suggestions);

      // Update queue status
      await supabase
        .from('ai_email_queue')
        .update({
          processing_status: 'completed',
          ai_analysis_result: {
            parsedItems: result.parsedItems,
            suggestions: result.suggestions,
            processingTime: result.processingTime
          },
          processed_at: new Date().toISOString()
        })
        .eq('id', queueEntry.id);

      // Trigger automation based on parsed items
      await triggerAutomationFromParsedItems(result.parsedItems, householdId);

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
          error_message: result.error,
          processed_at: new Date().toISOString()
        })
        .eq('id', queueEntry.id);

      return NextResponse.json({
        success: false,
        error: result.error || 'AI processing failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error processing email:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Trigger automation rules based on parsed email items
 */
async function triggerAutomationFromParsedItems(parsedItems: any[], householdId: string) {
  try {
    for (const item of parsedItems) {
      let eventType = '';
      let eventData: any = {};

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
            event_data: eventData,
            source: 'ai_email_parser',
            created_at: new Date().toISOString()
          });

        // Trigger automation dispatcher
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/automation/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            household_id: householdId,
            event_type: eventType,
            event_data: eventData
          })
        });
      }
    }
  } catch (error) {
    console.error('Failed to trigger automation from parsed items:', error);
  }
}

/**
 * GET endpoint to check processing status
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queueId = searchParams.get('queueId');

    if (!queueId) {
      return NextResponse.json({ error: 'Queue ID required' }, { status: 400 });
    }

    // Get processing status
    const { data: queueEntry, error } = await supabase
      .from('ai_email_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (error || !queueEntry) {
      return NextResponse.json({ error: 'Queue entry not found' }, { status: 404 });
    }

    // Get parsed items if processing is complete
    let parsedItems = [];
    let suggestions = [];

    if (queueEntry.processing_status === 'completed') {
      const { data: items } = await supabase
        .from('ai_parsed_items')
        .select('*')
        .eq('email_queue_id', queueId);

      const { data: suggs } = await supabase
        .from('ai_suggestions')
        .select('*')
        .eq('parsed_item_id', items?.map(i => i.id) || []);

      parsedItems = items || [];
      suggestions = suggs || [];
    }

    return NextResponse.json({
      success: true,
      data: {
        queueEntry,
        parsedItems,
        suggestions
      }
    });

  } catch (error) {
    console.error('Error checking processing status:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
