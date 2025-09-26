'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  FileText, 
  Image, 
  Receipt,
  Search,
  Filter,
  Calendar,
  Store,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { FileUpload } from '@/components/attachments/FileUpload';
import { ReceiptItemsDisplay } from '@/components/attachments/ReceiptItemsDisplay';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  ocr_status: string;
  ocr_confidence?: number;
  receipt_total?: number;
  receipt_date?: string;
  receipt_store?: string;
  receipt_items?: any[];
  created_at: string;
  receipt_items: Array<{
    id: string;
    item_name: string;
    item_price: number;
    item_category?: string;
    confidence_score: number;
  }>;
}

export default function AttachmentsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    fetchAttachments();
  }, [isLoaded, isSignedIn, router]);

  const fetchAttachments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/attachments');
      const data = await response.json();
      
      if (data.success) {
        setAttachments(data.attachments || []);
      } else {
        toast.error('Failed to load attachments');
      }
    } catch (error) {
      console.error('❌ Error fetching attachments:', error);
      toast.error('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (attachment: Attachment) => {
    fetchAttachments(); // Refresh the list
    setSelectedAttachment(attachment.id); // Auto-select the new attachment
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;

    try {
      const response = await fetch('/api/attachments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachment_id: attachmentId })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Attachment deleted successfully');
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
        if (selectedAttachment === attachmentId) {
          setSelectedAttachment(null);
        }
      } else {
        toast.error(data.error || 'Failed to delete attachment');
      }
    } catch (error) {
      console.error('❌ Error deleting attachment:', error);
      toast.error('Failed to delete attachment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'processing':
        return <Clock className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const filteredAttachments = attachments.filter(attachment => {
    const matchesSearch = attachment.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         attachment.receipt_store?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || attachment.ocr_status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isLoaded || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-900">Receipts & Documents</h1>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            OCR-Powered
          </Badge>
        </div>
        <p className="text-gray-600 text-lg">
          Upload receipts and documents for automatic text extraction and shopping list integration
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="receipts">Receipts ({attachments.filter(a => a.ocr_status === 'completed').length})</TabsTrigger>
          <TabsTrigger value="processing">Processing ({attachments.filter(a => a.ocr_status === 'processing' || a.ocr_status === 'pending').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <FileUpload 
            onUploadComplete={handleUploadComplete}
            onUploadError={(error) => toast.error(error)}
          />
        </TabsContent>

        <TabsContent value="receipts" className="space-y-6">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search receipts by name or store..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Attachments List */}
          <div className="grid gap-4">
            {filteredAttachments.map((attachment) => (
              <Card 
                key={attachment.id} 
                className={`cursor-pointer transition-colors ${
                  selectedAttachment === attachment.id ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedAttachment(attachment.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(attachment.file_type)}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {attachment.file_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getStatusColor(attachment.ocr_status)}>
                            {getStatusIcon(attachment.ocr_status)}
                            <span className="ml-1">{attachment.ocr_status}</span>
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {formatFileSize(attachment.file_size)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(attachment.created_at), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        
                        {attachment.ocr_status === 'completed' && (
                          <div className="flex items-center gap-2 mt-2">
                            {attachment.receipt_store && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Store className="h-3 w-3" />
                                {attachment.receipt_store}
                              </Badge>
                            )}
                            {attachment.receipt_total && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${attachment.receipt_total.toFixed(2)}
                              </Badge>
                            )}
                            {attachment.receipt_items && attachment.receipt_items.length > 0 && (
                              <Badge variant="outline">
                                {attachment.receipt_items.length} items
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {attachment.ocr_status === 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAttachment(attachment.id);
                          }}
                        >
                          View Items
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAttachment(attachment.id);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredAttachments.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'No receipts match your search criteria'
                    : 'No receipts uploaded yet. Upload your first receipt to get started!'
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="processing" className="space-y-6">
          <div className="grid gap-4">
            {attachments
              .filter(a => a.ocr_status === 'processing' || a.ocr_status === 'pending')
              .map((attachment) => (
                <Card key={attachment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {getFileIcon(attachment.file_type)}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {attachment.file_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getStatusColor(attachment.ocr_status)}>
                            {getStatusIcon(attachment.ocr_status)}
                            <span className="ml-1">{attachment.ocr_status}</span>
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Processing OCR...
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {attachments.filter(a => a.ocr_status === 'processing' || a.ocr_status === 'pending').length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No files currently being processed</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Receipt Items Display */}
      {selectedAttachment && (
        <div className="mt-8">
          <ReceiptItemsDisplay 
            attachmentId={selectedAttachment}
            className="border-t pt-8"
          />
        </div>
      )}
    </div>
  );
}
