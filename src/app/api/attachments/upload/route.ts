import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { ReceiptOCRService } from '@/lib/ocr/receiptOCRService';
import { z } from 'zod';

const uploadSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_size: z.number().positive(),
  file_type: z.string().min(1),
  file_extension: z.string().min(1),
  storage_path: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    console.log('🔍 Upload API - Auth check:', { userId, hasUserId: !!userId });
    
    if (!userId) {
      console.log('❌ Upload API - No userId found, returning 401');
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
        .upload(fileName, file);

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
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
        console.error('❌ Error creating attachment:', attachmentError);
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
          console.error('❌ Error queueing OCR processing:', queueError);
          // Don't fail the upload if OCR queuing fails
        } else {
          console.log(`📋 Queued attachment ${attachment.id} for OCR processing`);
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
        console.error('❌ Error creating attachment:', attachmentError);
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
          console.error('❌ Error queueing OCR processing:', queueError);
          // Don't fail the upload if OCR queuing fails
        } else {
          console.log(`📋 Queued attachment ${attachment.id} for OCR processing`);
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
    console.error('❌ Error in upload API:', error);
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
          console.log(`✅ OCR processing completed for attachment ${attachment_id}`);
        } else {
          console.error(`❌ OCR processing failed for attachment ${attachment_id}:`, result.error);
          
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
        console.error(`❌ OCR processing error for attachment ${attachment_id}:`, ocrError);
        
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
