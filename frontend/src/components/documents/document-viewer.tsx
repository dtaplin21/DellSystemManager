'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Download, X, FileText, FileSpreadsheet, FileImage } from 'lucide-react';
import { downloadDocument, getAuthHeaders } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import config from '@/lib/config';

interface DocumentViewerProps {
  document: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentViewer({ document, isOpen, onClose }: DocumentViewerProps) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && document) {
      loadDocumentContent();
    }
  }, [isOpen, document]);

  const loadDocumentContent = async () => {
    if (!document) return;

    setIsLoading(true);
    setError('');

    try {
      // Get the file URL for preview (without download parameter)
      const fileUrl = `${config.endpoints.documents(document.projectId)}/download/${document.id}`;
      setContent(fileUrl);
    } catch (err) {
      console.error('Error loading document content:', err);
      setError('Failed to load document content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;

    try {
      // Use the download endpoint with download parameter
      const response = await fetch(`${config.endpoints.documents(document.projectId)}/download/${document.id}?download=true`, {
        headers: await getAuthHeaders(),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download document');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Download Started',
        description: `${document.name} is being downloaded.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download document. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FileText className="h-6 w-6 text-red-500" />;
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="h-6 w-6 text-green-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
        return <FileImage className="h-6 w-6 text-blue-500" />;
      default:
        return <FileText className="h-6 w-6 text-gray-500" />;
    }
  };

  const getFileType = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toUpperCase();
    return extension || 'FILE';
  };

  const formatFileSize = (size?: number) => {
    if (!size) return 'Unknown size';
    const bytes = size;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const renderFilePreview = () => {
    if (!document) return null;

    const fileExtension = document.name.split('.').pop()?.toLowerCase();
    const fileUrl = content; // content now contains the file URL

    switch (fileExtension) {
      case 'pdf':
        return (
          <iframe
            src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full"
            title={document.name}
          />
        );
      
      case 'xlsx':
      case 'xls':
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <FileSpreadsheet className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Excel files cannot be previewed directly in the browser.</p>
              <p className="text-sm text-gray-500">Click the Download button to view this file.</p>
            </div>
          </div>
        );
      
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return (
          <img
            src={fileUrl}
            alt={document.name}
            className="w-full h-full object-contain"
          />
        );
      
      case 'txt':
      case 'csv':
        return (
          <iframe
            src={fileUrl}
            className="w-full h-full"
            title={document.name}
          />
        );
      
      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <FileText className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">This file type cannot be previewed directly.</p>
              <p className="text-sm text-gray-500">Click the Download button to view this file.</p>
            </div>
          </div>
        );
    }
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getFileIcon(document.name)}
              <div>
                <DialogTitle className="text-lg">{document.name}</DialogTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="secondary">{getFileType(document.name)}</Badge>
                  <span className="text-sm text-gray-500">{formatFileSize(document.size)}</span>
                  <span className="text-sm text-gray-500">
                    Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-gray-600">Loading document content...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-2">⚠️</div>
              <p className="text-gray-600">{error}</p>
            </div>
          ) : (
            <div className="h-[60vh] w-full border rounded-lg overflow-hidden">
              {renderFilePreview()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
