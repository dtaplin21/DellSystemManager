'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { uploadDocument } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize } from '@/lib/utils';

interface DocumentUploaderProps {
  projectId: string;
  onUploadComplete: (documents: any[]) => void;
}

export default function DocumentUploader({ projectId, onUploadComplete }: DocumentUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'No Files Selected',
        description: 'Please select at least one file to upload.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Create FormData for upload
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('documents', file);
      });

      // Add project ID to form data
      formData.append('projectId', projectId);

      // Use a custom XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/documents/${projectId}/upload`, true);
      
      // Add auth cookies
      xhr.withCredentials = true;

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      // Handle response
      xhr.onload = function() {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setSelectedFiles([]);
          setUploadProgress(0);
          onUploadComplete(response.documents);
          toast({
            title: 'Upload Successful',
            description: `${response.documents.length} document(s) uploaded successfully.`,
          });
        } else {
          let errorMessage = 'Upload failed';
          try {
            const response = JSON.parse(xhr.responseText);
            errorMessage = response.message || errorMessage;
          } catch (e) {
            // Ignore JSON parse error
          }
          toast({
            title: 'Upload Failed',
            description: errorMessage,
            variant: 'destructive',
          });
        }
        setIsUploading(false);
      };

      xhr.onerror = function() {
        toast({
          title: 'Upload Failed',
          description: 'Network error occurred. Please try again.',
          variant: 'destructive',
        });
        setIsUploading(false);
      };

      // Send the request
      xhr.send(formData);
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`document-drop-area ${dropActive ? 'active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 mb-4">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <h3 className="text-lg font-semibold">Drag & Drop Files Here</h3>
        <p className="text-sm text-gray-500 mt-1">
          or click to browse your computer
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.xls,.xlsx,.doc,.docx,.txt,.csv"
        />
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">{selectedFiles.length} file(s) selected</h3>
          
          <div className="max-h-60 overflow-y-auto space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 mr-2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <div className="truncate max-w-xs">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveFile(index)}
                  disabled={isUploading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </Button>
              </div>
            ))}
          </div>
          
          {isUploading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 text-center">{uploadProgress}% Uploaded</p>
            </div>
          )}
          
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setSelectedFiles([])}
              disabled={isUploading}
            >
              Clear All
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload Files'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
