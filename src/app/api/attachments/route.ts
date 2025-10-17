import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const ocr_status = searchParams.get('ocr_status');

    const supabase = getDatabaseClient();
    
    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData || !userData.household_id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const householdId = userData.household_id;

    // Build query
    let query = supabase
      .from('attachments')
      .select(`
        *,
        receipt_items (
          id,
          item_name,
          item_price,
          item_category,
          confidence_score
        )
      `)
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by OCR status if specified
    if (ocr_status) {
      query = query.eq('ocr_status', ocr_status);
    }

    const { data: attachments, error: fetchError } = await query;

    if (fetchError) {
      logger.error('Error fetching attachments', fetchError, {
        userId,
        householdId,
      });
      return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      attachments: attachments || [],
      count: attachments?.length || 0
    });

  } catch (error) {
    logger.error('Attachments GET unexpected error', error as Error, {
      route: '/api/attachments',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { attachment_id } = body;

    if (!attachment_id) {
      return NextResponse.json({ error: 'attachment_id required' }, { status: 400 });
    }

    const supabase = getDatabaseClient();
    
    // Get attachment details to verify ownership
    const { data: attachment, error: attachmentError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachment_id)
      .eq('uploaded_by', userId)
      .single();

    if (attachmentError || !attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('attachments')
      .remove([attachment.storage_path]);

    if (storageError) {
      logger.error('Error deleting attachment from storage', storageError, {
        userId,
        attachmentId: attachment_id,
      });
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database (cascading will handle related records)
    const { error: deleteError } = await supabase
      .from('attachments')
      .delete()
      .eq('id', attachment_id);

    if (deleteError) {
      logger.error('Error deleting attachment record', deleteError, {
        userId,
        attachmentId: attachment_id,
      });
      return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Attachment deleted successfully'
    });

  } catch (error) {
    logger.error('Attachments DELETE unexpected error', error as Error, {
      route: '/api/attachments',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
