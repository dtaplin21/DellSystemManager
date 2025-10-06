'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Eye, FileSpreadsheet, FileText, Image, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { FileMetadata } from '@/contexts/AsbuiltDataContext';
import { AsbuiltDomain } from '@/types/asbuilt';

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileMetadata | null;
  showDataMapping?: boolean;
  panelId?: string;
  domain?: AsbuiltDomain;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({
  isOpen,
  onClose,
  file,
  showDataMapping = false,
  panelId,
  domain
}) => {
  const [fileContent, setFileContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'mapping' | 'metadata'>('preview');

  // Load file content when modal opens
  useEffect(() => {
    if (isOpen && file) {
      loadFileContent();
    }
  }, [isOpen, file]);

  const loadFileContent = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // For now, we'll simulate loading different file types
      // In production, this would make actual API calls to load file content
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading

      // Simulate different content based on file type
      if (file.fileType === 'excel') {
        setFileContent({
          type: 'excel',
          sheets: ['Sheet1', 'Sheet2'],
          data: [
            ['Panel ID', 'Domain', 'Value', 'Confidence'],
            ['P-001', 'panel_placement', 'Row 1, Col 2', '0.95'],
            ['P-002', 'panel_seaming', 'Row 2, Col 3', '0.87'],
            ['P-003', 'non_destructive', 'Row 3, Col 4', '0.92']
          ]
        });
      } else if (file.fileType === 'pdf') {
        setFileContent({
          type: 'pdf',
          pages: 3,
          content: 'PDF content preview...'
        });
      } else if (file.fileType === 'image') {
        setFileContent({
          type: 'image',
          url: file.previewUrl || '/placeholder-image.jpg'
        });
      }
    } catch (err) {
      console.error('Error loading file content:', err);
      setError('Failed to load file content');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (file) {
      // In production, this would trigger actual file download
      window.open(file.downloadUrl, '_blank');
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'excel':
        return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-600" />;
      case 'image':
        return <Image className="h-8 w-8 text-blue-600" />;
      default:
        return <FileText className="h-8 w-8 text-gray-600" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderExcelContent = () => {
    if (!fileContent || fileContent.type !== 'excel') return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Excel File</Badge>
          <span className="text-sm text-gray-600">
            {fileContent.sheets.length} sheet(s)
          </span>
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {fileContent.data[0]?.map((header: string, index: number) => (
                  <th key={index} className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fileContent.data.slice(1).map((row: string[], rowIndex: number) => (
                <tr key={rowIndex} className="border-t hover:bg-gray-50">
                  {row.map((cell: string, cellIndex: number) => (
                    <td key={cellIndex} className="px-4 py-2 text-sm text-gray-900">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDataMapping = () => {
    if (!showDataMapping || !file) return null;

    return (
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Data Mapping</h4>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-blue-800">Panel ID:</span>
              <span className="text-sm text-blue-600">{file.panelId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-blue-800">Domain:</span>
              <span className="text-sm text-blue-600">{file.domain}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-blue-800">Project ID:</span>
              <span className="text-sm text-blue-600">{file.projectId}</span>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          <p>This file has been processed and mapped to the following data structure:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Excel columns mapped to canonical field names</li>
            <li>Data validated and confidence scores assigned</li>
            <li>Records linked to panel {file.panelId}</li>
            <li>Domain classified as {file.domain}</li>
          </ul>
        </div>
      </div>
    );
  };

  const renderMetadata = () => {
    if (!file) return null;

    return (
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">File Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-700">File Name:</span>
            <p className="text-sm text-gray-900">{file.fileName}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">File Size:</span>
            <p className="text-sm text-gray-900">{formatFileSize(file.fileSize)}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Upload Date:</span>
            <p className="text-sm text-gray-900">
              {new Date(file.uploadedAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">File Type:</span>
            <p className="text-sm text-gray-900 capitalize">{file.fileType}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Panel ID:</span>
            <p className="text-sm text-gray-900">{file.panelId}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Domain:</span>
            <p className="text-sm text-gray-900">{file.domain}</p>
          </div>
        </div>
      </div>
    );
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getFileIcon(file.fileType)}
            <div>
              <h3 className="text-lg font-semibold">{file.fileName}</h3>
              <p className="text-sm text-gray-600">
                {file.fileType.toUpperCase()} • {formatFileSize(file.fileSize)}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription>
            View and analyze file content for panel {file.panelId}
            {domain && ` • ${domain} domain`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'preview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Eye className="h-4 w-4 inline mr-2" />
              Preview
            </button>
            {showDataMapping && (
              <button
                onClick={() => setActiveTab('mapping')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'mapping'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4 inline mr-2" />
                Data Mapping
              </button>
            )}
            <button
              onClick={() => setActiveTab('metadata')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'metadata'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Metadata
            </button>
          </div>

          {/* Tab Content */}
          <div className="overflow-y-auto max-h-96">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Progress value={50} className="w-full max-w-xs" />
                <span className="ml-3 text-sm text-gray-600">Loading file content...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-600">{error}</p>
                <Button onClick={loadFileContent} variant="outline" className="mt-4">
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {activeTab === 'preview' && (
                  <div>
                    {file.fileType === 'excel' && renderExcelContent()}
                    {file.fileType === 'pdf' && (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">PDF preview not available</p>
                        <p className="text-sm text-gray-500">Click download to view the file</p>
                      </div>
                    )}
                    {file.fileType === 'image' && (
                      <div className="text-center">
                        <img 
                          src={fileContent?.url || '/placeholder-image.jpg'} 
                          alt={file.fileName}
                          className="max-w-full h-auto rounded-lg shadow-sm"
                        />
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'mapping' && renderDataMapping()}
                {activeTab === 'metadata' && renderMetadata()}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FileViewerModal;
