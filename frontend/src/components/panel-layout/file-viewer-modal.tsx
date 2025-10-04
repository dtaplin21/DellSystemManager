'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import config from '@/lib/config';

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName?: string;
}

interface FileData {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  uploadDate: string;
  uploaderId: string;
  domain: string;
  panelCount: number;
  recordCount: number;
  aiConfidence: number;
  filePath: string;
}

interface RecordData {
  id: string;
  domain: string;
  rawData: any;
  mappedData: any;
  aiConfidence: number;
  requiresReview: boolean;
  createdAt: string;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({
  isOpen,
  onClose,
  fileId,
  fileName
}) => {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [records, setRecords] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'records'>('overview');

  useEffect(() => {
    if (isOpen && fileId) {
      fetchFileData();
    }
  }, [isOpen, fileId]);

  const fetchFileData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch file metadata
      const fileResponse = await fetch(`${config.backendUrl}/api/asbuilt/files/${fileId}`, {
        credentials: 'include'
      });
      
      if (!fileResponse.ok) {
        throw new Error('Failed to fetch file data');
      }
      
      const fileData = await fileResponse.json();
      setFileData(fileData);
      
      // Fetch records associated with this file
      const recordsResponse = await fetch(`${config.backendUrl}/api/asbuilt/files/${fileId}/records`, {
        credentials: 'include'
      });
      
      if (recordsResponse.ok) {
        const recordsData = await recordsResponse.json();
        setRecords(recordsData);
      }
      
    } catch (err) {
      console.error('Error fetching file data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch file data');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid Date';
    }
  };

  const downloadFile = async () => {
    if (!fileData) return;
    
    try {
      const response = await fetch(`${config.backendUrl}/api/asbuilt/files/${fileId}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileData.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file');
    }
  };

  const renderRecordItem = (record: RecordData) => (
    <Card key={record.id} className="mb-3">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{record.domain}</Badge>
            {record.requiresReview && (
              <Badge variant="destructive">Review Required</Badge>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {Math.round((record.aiConfidence || 0) * 100)}% Confidence
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="text-xs text-gray-500">
            Created: {formatDate(record.createdAt)}
          </div>
          
          {record.mappedData && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">Mapped Data:</div>
              <div className="bg-gray-50 p-2 rounded text-xs">
                {Object.entries(record.mappedData).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="font-medium">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {record.rawData && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">Raw Data:</div>
              <div className="bg-blue-50 p-2 rounded text-xs">
                {Object.entries(record.rawData).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="font-medium">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold">File Viewer</h2>
              <p className="text-sm text-gray-500">
                {fileName || fileData?.originalName || 'Loading...'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600">Loading file data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-600" />
                <p className="text-red-600 mb-2">Error loading file</p>
                <p className="text-sm text-gray-600">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchFileData}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : fileData ? (
            <>
              {/* Tabs */}
              <div className="border-b">
                <div className="flex space-x-8 px-6">
                  <button
                    className={`py-3 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'overview'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('overview')}
                  >
                    Overview
                  </button>
                  <button
                    className={`py-3 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'records'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('records')}
                  >
                    Records ({records.length})
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <ScrollArea className="flex-1 p-6">
                {activeTab === 'overview' ? (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          File Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Filename</label>
                            <p className="text-sm text-gray-900">{fileData.originalName}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">File Size</label>
                            <p className="text-sm text-gray-900">{formatFileSize(fileData.fileSize)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Upload Date</label>
                            <p className="text-sm text-gray-900">{formatDate(fileData.uploadDate)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Domain</label>
                            <Badge variant="outline">{fileData.domain}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Import Statistics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{fileData.panelCount}</div>
                            <div className="text-sm text-gray-600">Panels Detected</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{fileData.recordCount}</div>
                            <div className="text-sm text-gray-600">Records Created</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {Math.round(fileData.aiConfidence * 100)}%
                            </div>
                            <div className="text-sm text-gray-600">AI Confidence</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button onClick={downloadFile} className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Download Original File
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Associated Records</h3>
                      <Badge variant="outline">{records.length} records</Badge>
                    </div>
                    
                    {records.length > 0 ? (
                      <div className="space-y-3">
                        {records.map(renderRecordItem)}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No records found for this file</p>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FileViewerModal;
