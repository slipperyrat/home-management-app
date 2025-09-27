import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getDatabaseClient } from '@/lib/api/database';
import { logger } from '@/lib/logging/logger';
import { ReceiptOCRService } from '@/lib/ocr/receiptOCRService';

const uploadSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_size: z.number().positive(),
  file_type: z.string().min(1),
  file_extension: z.string().min(1),
  storage_path: z.string().min(1),
});

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];

function isAllowedMimeType(mime: string) {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.toLowerCase().startsWith(prefix));
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if request is FormData (file upload) or JSON (metadata only)
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'File too large' }, { status: 413 });
      }

      if (!isAllowedMimeType(file.type)) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
      }

      const supabase = getDatabaseClient();
      
      // Get user's household
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('household_id')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(fileName, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        logger.error('Storage upload error', uploadError, { userId });
        return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 });
      }

      // Create attachment record
      const { data: attachment, error: attachmentError } = await supabase
        .from('attachments')
        .insert([{
          household_id: userData.household_id,
          uploaded_by: userId,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          file_extension: fileExt,
          storage_path: uploadData.path,
          storage_bucket: 'attachments',
          ocr_status: 'pending'
        }])
        .select()
        .single();

      if (attachmentError) {
        logger.error('Error creating attachment record', attachmentError, { userId });
        return NextResponse.json({ error: 'Failed to create attachment record' }, { status: 500 });
      }

      // If it's an image file, queue for OCR processing
      if (file.type.startsWith('image/')) {
        const { error: queueError } = await supabase
          .from('ocr_processing_queue')
          .insert([{
            attachment_id: attachment.id,
            household_id: userData.household_id,
            processing_type: 'receipt_ocr',
            priority: 1,
            status: 'pending'
          }]);

        if (queueError) {
          logger.error('Error queueing OCR processing', queueError, {
            userId,
            attachmentId: attachment.id,
          });
          // Don't fail the upload if OCR queuing fails
        } else {
          logger.info('Attachment queued for OCR', {
            userId,
            attachmentId: attachment.id,
          });
        }
      }

      return NextResponse.json({
        success: true,
        attachment: {
          id: attachment.id,
          file_name: attachment.file_name,
          file_type: attachment.file_type,
          file_size: attachment.file_size,
          ocr_status: attachment.ocr_status,
          created_at: attachment.created_at
        }
      });
    } else {
      // Handle JSON metadata (legacy support)
      const body = await request.json();
      const validatedData = uploadSchema.parse(body);
      const { file_name, file_size, file_type, file_extension, storage_path } = validatedData;

      if (file_size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'File too large' }, { status: 413 });
      }

      if (!isAllowedMimeType(file_type)) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
      }

      const supabase = getDatabaseClient();
      
      // Get user's household
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('household_id')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Create attachment record
      const { data: attachment, error: attachmentError } = await supabase
        .from('attachments')
        .insert([{
          household_id: userData.household_id,
          uploaded_by: userId,
          file_name,
          file_size,
          file_type,
          file_extension,
          storage_path,
          storage_bucket: 'attachments',
          ocr_status: 'pending'
        }])
        .select()
        .single();

      if (attachmentError) {
        logger.error('Error creating attachment record', attachmentError, { userId });
        return NextResponse.json({ error: 'Failed to create attachment record' }, { status: 500 });
      }

      // If it's an image file, queue for OCR processing
      if (file_type.startsWith('image/')) {
        const { error: queueError } = await supabase
          .from('ocr_processing_queue')
          .insert([{
            attachment_id: attachment.id,
            household_id: userData.household_id,
            processing_type: 'receipt_ocr',
            priority: 1,
            status: 'pending'
          }]);

        if (queueError) {
          logger.error('Error queueing OCR processing', queueError, {
            userId,
            attachmentId: attachment.id,
          });
          // Don't fail the upload if OCR queuing fails
        } else {
          logger.info('Attachment queued for OCR', {
            userId,
            attachmentId: attachment.id,
          });
        }
      }

      return NextResponse.json({
        success: true,
        attachment: {
          id: attachment.id,
          file_name: attachment.file_name,
          file_type: attachment.file_type,
          file_size: attachment.file_size,
          ocr_status: attachment.ocr_status,
          created_at: attachment.created_at
        }
      });
    }

  } catch (error) {
    logger.error('Upload API unexpected error', error as Error, { route: '/api/attachments/upload' });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle file upload completion and trigger OCR processing
export async function PUT(request: NextRequest) {
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
    
    // Get attachment details
    const { data: attachment, error: attachmentError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachment_id)
      .eq('uploaded_by', userId)
      .single();

    if (attachmentError || !attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Check if it's an image that needs OCR processing
    if (attachment.file_type.startsWith('image/') && attachment.ocr_status === 'pending') {
      // Update status to processing
      await supabase
        .from('attachments')
        .update({ 
          ocr_status: 'processing',
          processing_started_at: new Date().toISOString()
        })
        .eq('id', attachment_id);

      // Start OCR processing in the background
      try {
        const ocrService = new ReceiptOCRService();
        const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attachments/${attachment.storage_path}`;
        
        const result = await ocrService.processReceipt(
          attachment_id,
          imageUrl,
          attachment.household_id
        );

        if (result.success) {
          logger.info('OCR processing completed', {
            userId,
            attachmentId: attachment_id,
          });
        } else {
          logger.error('OCR processing failed', new Error(result.error || 'Unknown error'), {
            userId,
            attachmentId: attachment_id,
          });
          
          // Update status to failed
          await supabase
            .from('attachments')
            .update({ 
              ocr_status: 'failed',
              processing_error: result.error,
              processing_completed_at: new Date().toISOString()
            })
            .eq('id', attachment_id);
        }

      } catch (ocrError) {
        logger.error('OCR processing error', ocrError as Error, {
          userId,
          attachmentId: attachment_id,
        });
        
        // Update status to failed
        await supabase
          .from('attachments')
          .update({ 
            ocr_status: 'failed',
            processing_error: ocrError instanceof Error ? ocrError.message : 'Unknown error',
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', attachment_id);
      }
    }

    // Get updated attachment data
    const { data: updatedAttachment, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachment_id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch updated attachment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      attachment: updatedAttachment
    });

  } catch (error) {
    console.error('❌ Error in upload completion API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
