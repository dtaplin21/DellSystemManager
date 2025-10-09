'use client';

import React, { useState, useEffect } from 'react';
import { X, Eye, FileSpreadsheet, AlertCircle, CheckCircle, Clock, User, Calendar, MapPin, Hash } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AsbuiltRecord, AsbuiltDomain, ASBUILT_DOMAINS } from '@/types/asbuilt';

interface RecordViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AsbuiltRecord | null;
  loading?: boolean;
}

const RecordViewerModal: React.FC<RecordViewerModalProps> = ({
  isOpen,
  onClose,
  record,
  loading = false
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'rawData' | 'mappedData'>('overview');

  // Reset tab when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen]);

  const getDomainConfig = (domain: AsbuiltDomain) => {
    return ASBUILT_DOMAINS.find(d => d.domain === domain) || ASBUILT_DOMAINS[0];
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-green-100 text-green-800">High</Badge>;
    if (confidence >= 0.6) return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    return <Badge className="bg-red-100 text-red-800">Low</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderJsonData = (data: Record<string, any>) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p>No data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 capitalize">{key.replace(/([A-Z])/g, ' $1')}</h4>
              <Badge variant="outline" className="text-xs">
                {typeof value}
              </Badge>
            </div>
            <div className="text-sm text-gray-600">
              {typeof value === 'object' ? (
                <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                <span className="break-words">{String(value)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Record...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Fetching record details...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!record) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Not Found</DialogTitle>
            <DialogDescription>
              The requested record could not be found or may have been deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-gray-500">Record not available</p>
          </div>
          <DialogFooter>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const domainConfig = getDomainConfig(record.domain);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{domainConfig.icon}</span>
            <div>
              <DialogTitle className="flex items-center gap-2">
                As-Built Record
                <Badge className="bg-blue-100 text-blue-800">
                  {domainConfig.displayName}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Record ID: {record.id.slice(0, 8)}...
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rawData">Raw Data</TabsTrigger>
            <TabsTrigger value="mappedData">Mapped Data</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Record Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Panel Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Panel Number:</span>
                      <span className="font-medium">{record.mappedData.panelNumber || record.panelId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Panel ID:</span>
                      <span className="font-mono text-xs">{record.panelId}</span>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Record Details
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Domain:</span>
                      <span className="font-medium">{domainConfig.displayName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Confidence:</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${getConfidenceColor(record.aiConfidence)}`}>
                          {Math.round(record.aiConfidence * 100)}%
                        </span>
                        {getConfidenceBadge(record.aiConfidence)}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      {record.requiresReview ? (
                        <Badge className="bg-yellow-100 text-yellow-800">Review Required</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">Approved</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Created By
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">User ID:</span>
                      <span className="font-mono text-xs">{record.createdBy}</span>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Timestamps
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Created:</span>
                      <span className="text-sm">{formatDate(record.createdAt)}</span>
                    </div>
                    {record.updatedAt && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Updated:</span>
                        <span className="text-sm">{formatDate(record.updatedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Data Preview */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Key Data Points
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(record.mappedData).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded p-3">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </div>
                    <div className="font-medium text-gray-900 truncate">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rawData" className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Original Raw Data
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This is the original data as imported from the Excel file, before AI processing.
              </p>
              {renderJsonData(record.rawData)}
            </div>
          </TabsContent>

          <TabsContent value="mappedData" className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Processed Mapped Data
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This is the data after AI processing and field mapping to canonical field names.
              </p>
              {renderJsonData(record.mappedData)}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordViewerModal;
