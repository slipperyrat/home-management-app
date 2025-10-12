'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logging/logger';

export interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  ocr_status: string;
  ocr_confidence?: number;
  receipt_total?: number;
  receipt_date?: string;
  receipt_store?: string;
  receipt_items?: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItem {
  id: string;
  item_name: string;
  item_price: number;
  item_quantity: number;
  item_category?: string;
  item_brand?: string;
  item_unit?: string;
  confidence_score: number;
  added_to_shopping_list: boolean;
  user_confirmed: boolean;
  user_modified: boolean;
  attachment: {
    id: string;
    file_name: string;
    receipt_store?: string;
    receipt_date?: string;
  };
}

async function fetchAttachments(params?: {
  limit?: number;
  offset?: number;
  ocr_status?: string;
}): Promise<{ attachments: Attachment[]; count: number }> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.ocr_status) searchParams.set('ocr_status', params.ocr_status);

  const response = await fetch(`/api/attachments?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch attachments: ${response.status}`);
  }

  const data = await response.json();

  if (data.success) {
    return { attachments: data.attachments || [], count: data.count || 0 };
  }

  throw new Error(data.error || 'Failed to fetch attachments');
}

async function fetchReceiptItems(params?: {
  attachment_id?: string;
  limit?: number;
  offset?: number;
}): Promise<{ receipt_items: ReceiptItem[]; count: number }> {
  const searchParams = new URLSearchParams();
  if (params?.attachment_id) searchParams.set('attachment_id', params.attachment_id);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const response = await fetch(`/api/receipt-items?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch receipt items: ${response.status}`);
  }

  const data = await response.json();

  if (data.success) {
    return { receipt_items: data.receipt_items || [], count: data.count || 0 };
  }

  throw new Error(data.error || 'Failed to fetch receipt items');
}

async function deleteAttachment(attachmentId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch('/api/attachments', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attachment_id: attachmentId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete attachment: ${response.status}`);
  }

  return response.json();
}

async function addReceiptItemsToShoppingList(data: {
  item_ids: string[];
  shopping_list_id?: string;
}): Promise<{ success: boolean; message: string; added_items: number; shopping_list_id: string }> {
  const response = await fetch('/api/receipt-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to add items to shopping list: ${response.status}`);
  }

  return response.json();
}

export function useAttachments(params?: {
  limit?: number;
  offset?: number;
  ocr_status?: string;
}) {
  return useQuery({
    queryKey: ['attachments', params],
    queryFn: () => fetchAttachments(params),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useReceiptItems(params?: {
  attachment_id?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['receiptItems', params],
    queryFn: () => fetchReceiptItems(params),
    enabled: Boolean(params?.attachment_id),
    staleTime: 60 * 1000,
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAttachment,
    onSuccess: (_, attachmentId) => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
      toast.success('Attachment deleted successfully');
      logger.info('Attachment deleted', { attachmentId });
    },
    onError: (error) => {
      toast.error('Failed to delete attachment');
      logger.error('Failed to delete attachment', error as Error);
    },
  });
}

export function useAddReceiptItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addReceiptItemsToShoppingList,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['receiptItems'] });
      queryClient.invalidateQueries({ queryKey: ['shoppingLists'] });
      toast.success(data.message);
      logger.info('Receipt items added to shopping list', {
        addedItems: data.added_items,
        shoppingListId: data.shopping_list_id,
        itemIds: variables.item_ids,
      });
    },
    onError: (error) => {
      toast.error('Failed to add items to shopping list');
      logger.error('Failed to add receipt items to shopping list', error as Error);
    },
  });
}
