'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileText, Image, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface FileUploadProps {
  onUploadComplete?: (attachment: any) => void;
  onUploadError?: (error: string) => void;
  className?: string;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string[];
}

interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  attachment?: any;
}

export function FileUpload({ 
  onUploadComplete, 
  onUploadError,
  className = '',
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
}: FileUploadProps) {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug logging
  console.log('FileUpload auth state:', { userId, isLoaded, isSignedIn });

  // Monitor authentication state changes
  React.useEffect(() => {
    console.log('FileUpload auth state changed:', { userId, isLoaded, isSignedIn });
  }, [userId, isLoaded, isSignedIn]);

  // Test token availability
  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      getToken().then(token => {
        console.log('🔑 Token test:', token ? 'Available' : 'Not available');
      });
    }
  }, [isLoaded, isSignedIn, getToken]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    // Check if authentication is loaded and user is authenticated
    if (!isLoaded) {
      toast.error('Please wait for authentication to load');
      return;
    }

    if (!isSignedIn) {
      toast.error('Please sign in to upload files');
      return;
    }

    Array.from(files).forEach(file => {
      // Validate file
      if (!acceptedTypes.includes(file.type)) {
        toast.error(`File type ${file.type} is not supported`);
        return;
      }

      if (file.size > maxFileSize) {
        toast.error(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`);
        return;
      }

      // Add to uploads
      const upload: UploadProgress = {
        file,
        progress: 0,
        status: 'uploading'
      };

      setUploads(prev => [...prev, upload]);

      // Start upload
      uploadFile(upload);
    });
  };

  const uploadFile = async (upload: UploadProgress) => {
    try {
      // Check if authentication is loaded and user is still authenticated
      if (!isLoaded) {
        console.log('❌ Upload failed - Authentication not loaded');
        throw new Error('Authentication not loaded');
      }

      if (!isSignedIn) {
        console.log('❌ Upload failed - User not authenticated');
        throw new Error('User not authenticated');
      }

      console.log('✅ Upload starting - Auth state:', { isLoaded, isSignedIn, userId });

      // Upload file using FormData to the API route
      const formData = new FormData();
      formData.append('file', upload.file);

      // Update progress
      setUploads(prev => prev.map(u => 
        u.file === upload.file 
          ? { ...u, progress: 25, status: 'uploading' }
          : u
      ));

      // Upload file to API route (which handles Supabase storage with proper auth)
      const token = await getToken();
      console.log('🔑 Auth token:', token ? 'Present' : 'Missing');
      
      const response = await fetch('/api/attachments/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const { attachment } = await response.json();

      // Update progress
      setUploads(prev => prev.map(u => 
        u.file === upload.file 
          ? { ...u, progress: 75, status: 'processing', attachment }
          : u
      ));

      // Trigger OCR processing if it's an image
      if (upload.file.type.startsWith('image/')) {
        const processToken = await getToken();
        const processResponse = await fetch('/api/attachments/upload', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${processToken}`
          },
          body: JSON.stringify({ attachment_id: attachment.id })
        });

        if (!processResponse.ok) {
          throw new Error('Failed to start OCR processing');
        }

        const { attachment: processedAttachment } = await processResponse.json();
        
        // Update to completed
        setUploads(prev => prev.map(u => 
          u.file === upload.file 
            ? { 
                ...u, 
                progress: 100, 
                status: 'completed', 
                attachment: processedAttachment 
              }
            : u
        ));

        toast.success(`Receipt processed successfully! ${processedAttachment.receipt_items?.length || 0} items extracted.`);
        onUploadComplete?.(processedAttachment);
      } else {
        // Non-image file, mark as completed
        setUploads(prev => prev.map(u => 
          u.file === upload.file 
            ? { ...u, progress: 100, status: 'completed' }
            : u
        ));

        toast.success('File uploaded successfully!');
        onUploadComplete?.(attachment);
      }

    } catch (error) {
      console.error('❌ Upload error:', error);
      
      setUploads(prev => prev.map(u => 
        u.file === upload.file 
          ? { 
              ...u, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed'
            }
          : u
      ));

      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onUploadError?.(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const removeUpload = (file: File) => {
    setUploads(prev => prev.filter(u => u.file !== file));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Receipts & Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              !isLoaded || !isSignedIn
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                : isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={isLoaded && isSignedIn ? handleDragOver : undefined}
            onDragLeave={isLoaded && isSignedIn ? handleDragLeave : undefined}
            onDrop={isLoaded && isSignedIn ? handleDrop : undefined}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              {!isLoaded ? 'Loading authentication...' : 'Drop files here or click to browse'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supported formats: JPEG, PNG, GIF, PDF (max {(maxFileSize / 1024 / 1024).toFixed(1)}MB)
            </p>
            <Button
              onClick={() => isLoaded && isSignedIn && fileInputRef.current?.click()}
              variant="outline"
              className="mb-2"
              disabled={!isLoaded || !isSignedIn}
            >
              {!isLoaded ? 'Loading...' : isSignedIn ? 'Choose Files' : 'Please Sign In'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedTypes.join(',')}
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Upload Progress */}
          {uploads.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Upload Progress</h4>
              {uploads.map((upload, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getFileIcon(upload.file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {upload.file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={upload.progress} className="flex-1 h-2" />
                        <Badge className={getStatusColor(upload.status)}>
                          {upload.status}
                        </Badge>
                      </div>
                      {upload.error && (
                        <p className="text-xs text-red-600 mt-1">{upload.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(upload.status)}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeUpload(upload.file)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
