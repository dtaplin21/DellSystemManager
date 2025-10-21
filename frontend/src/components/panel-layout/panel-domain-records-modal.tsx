'use client';

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AsbuiltDomain, AsbuiltRecord } from '@/types/asbuilt';
import { FileMetadata } from '@/contexts/AsbuiltDataContext';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  FileText,
  Hash,
} from 'lucide-react';

type DomainConfig = {
  key: AsbuiltDomain;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
};

interface PanelDomainRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: AsbuiltDomain | null;
  domainConfig: DomainConfig | null;
  panelId: string;
  panelNumber: string;
  records: AsbuiltRecord[];
  files: FileMetadata[];
  onRecordSelect: (record: AsbuiltRecord) => void;
  onImportClick: () => void;
  onManualEntryClick: () => void;
  onFileOpen: (file: FileMetadata) => void;
}

const PanelDomainRecordsModal: React.FC<PanelDomainRecordsModalProps> = ({
  isOpen,
  onClose,
  domain,
  domainConfig,
  panelId,
  panelNumber,
  records,
  files,
  onRecordSelect,
  onImportClick,
  onManualEntryClick,
  onFileOpen,
}) => {
  const sortedRecords = useMemo(() => {
    return [...records].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [records]);

  const averageConfidence = useMemo(() => {
    if (sortedRecords.length === 0) return 0;
    const total = sortedRecords.reduce(
      (sum, record) => sum + (record.aiConfidence || 0),
      0
    );
    return total / sortedRecords.length;
  }, [sortedRecords]);

  const reviewRequired = useMemo(() => {
    return sortedRecords.filter((record) => record.requiresReview).length;
  }, [sortedRecords]);

  const formattedDomainName =
    domainConfig?.name ||
    (domain ? domain.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'As-built Records');

  const domainBadgeClass = domainConfig?.color || 'bg-blue-100 text-blue-800';

  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  };

  const formatValue = (value: unknown) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string' && value.length > 80) {
      return `${value.slice(0, 77)}...`;
    }
    return String(value);
  };

  const formatConfidence = (value: number) => {
    return `${Math.round((value || 0) * 100)}%`;
  };

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const previewEntries = (record: AsbuiltRecord) => {
    if (!record.mappedData || typeof record.mappedData !== 'object') {
      return [];
    }

    return Object.entries(record.mappedData)
      .filter(([, value]) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'object') return false;
        const stringValue = String(value).trim();
        return stringValue.length > 0;
      })
      .slice(0, 6);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const renderStatusBadge = (record: AsbuiltRecord) => {
    if (record.requiresReview) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 text-xs">
          <AlertTriangle className="h-3 w-3" />
          Review Required
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
        <CheckCircle className="h-3 w-3" />
        Ready
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${domainBadgeClass}`}>
              {domainConfig?.icon || <FileText className="h-5 w-5" />}
            </span>
            <span>{formattedDomainName}</span>
          </DialogTitle>
          <DialogDescription>
            Records linked to panel {panelNumber} ({panelId.slice(0, 8)}...).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
          <div className="space-y-4">
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Panel</p>
              <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Hash className="h-4 w-4 text-gray-400" />
                {panelNumber}
              </div>
              <p className="mt-1 text-xs text-gray-500 break-all">
                Panel ID: {panelId}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{sortedRecords.length}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Avg Confidence</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatConfidence(averageConfidence)}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Needs Review</p>
                <p className="text-2xl font-bold text-gray-900">{reviewRequired}</p>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="mb-2 flex items-center gap-2 font-medium text-gray-900">
                <FileText className="h-4 w-4" />
                Linked Files
              </h4>
              {files.length === 0 ? (
                <p className="text-sm text-gray-600">No files linked to this domain yet.</p>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">{file.fileName}</p>
                        <p className="text-xs text-gray-500">
                          Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onFileOpen(file)}>
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={onImportClick}>
                📊 Import Data
              </Button>
              <Button variant="outline" size="sm" onClick={onManualEntryClick}>
                ✏️ Manual Entry
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-white">
            {sortedRecords.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center p-12">
                <FileText className="h-12 w-12 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900">No records yet</h3>
                <p className="text-sm text-gray-600">
                  Use the actions on the left to add records for this domain.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4 p-4">
                  {sortedRecords.map((record) => {
                    const associatedFile =
                      record.sourceDocId &&
                      files.find((file) => file.sourceDocId === record.sourceDocId);
                    const preview = previewEntries(record);

                    return (
                      <div
                        key={record.id}
                        className="rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-blue-200"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {renderStatusBadge(record)}
                              <Badge variant="outline" className="text-xs">
                                Confidence {formatConfidence(record.aiConfidence)}
                              </Badge>
                            </div>
                            <p className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              Created {formatDateTime(record.createdAt)}
                            </p>
                            {associatedFile && (
                              <button
                                type="button"
                                onClick={() => onFileOpen(associatedFile)}
                                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                              >
                                <FileText className="h-4 w-4" />
                                {associatedFile.fileName}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onRecordSelect(record)}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>

                        {preview.length > 0 && (
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {preview.map(([key, value]) => (
                              <div key={key} className="rounded-lg bg-gray-50 p-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                  {formatKey(key)}
                                </p>
                                <p className="mt-1 text-sm font-medium text-gray-900 break-words">
                                  {formatValue(value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PanelDomainRecordsModal;
