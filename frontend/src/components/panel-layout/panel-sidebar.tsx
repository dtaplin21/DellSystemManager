'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, FileText, Wrench, TestTube, Hammer, AlertTriangle, Settings, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { 
  AsbuiltRecord, 
  PanelAsbuiltSummary, 
  AsbuiltDomain,
  RightNeighborPeek 
} from '@/types/asbuilt';
import ExcelImportModal from './excel-import-modal';
import ManualEntryModal from './manual-entry-modal';
import { getSupabaseClient } from '@/lib/supabase';
import { getAsbuiltSafe } from '@/lib/safe-api';
import config from '@/lib/config';
import { useAsbuiltData } from '@/contexts/AsbuiltDataContext';
import FileViewerModal from '@/components/shared/FileViewerModal';
import PanelDomainRecordsModal from './panel-domain-records-modal';
import RecordViewerModal from '@/components/shared/RecordViewerModal';
import { FileMetadata } from '@/contexts/AsbuiltDataContext';

interface PanelSidebarProps {
  isOpen: boolean;
  miniMode?: boolean; // NEW: Controls whether to show mini or full sidebar
  onToggle: () => void;
  projectId: string;
  panelId: string;
  panelNumber: string;
  onClose: () => void;
}

interface DomainConfig {
  key: AsbuiltDomain;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const PanelSidebar: React.FC<PanelSidebarProps> = ({
  isOpen,
  miniMode = false, // Default to false for backward compatibility
  onToggle,
  projectId,
  panelId,
  panelNumber,
  onClose
}) => {
  console.log('🚀 [PanelSidebar] Component mounted with props:', {
    isOpen,
    miniMode,
    projectId,
    panelId,
    panelNumber
  });
  
  // Use shared context
  const {
    projectRecords,
    panelData,
    fileMetadata,
    isLoading,
    error: contextError,
    getFilesForPanel,
    getFilesForDomain,
    getPanelSummary,
    refreshPanelData
  } = useAsbuiltData();
  
  const [activeDomain, setActiveDomain] = useState<AsbuiltDomain | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [showDomainRecordsModal, setShowDomainRecordsModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<AsbuiltDomain | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AsbuiltRecord | null>(null);
  
  // Get panel data from shared context
  const asbuiltData = getPanelSummary(panelId);

  const panelRecords = useMemo(() => {
    return projectRecords.filter(record => record.panelId === panelId);
  }, [projectRecords, panelId]);

  const recordsByDomain = useMemo(() => {
    const map = new Map<AsbuiltDomain, AsbuiltRecord[]>();
    panelRecords.forEach((record) => {
      const current = map.get(record.domain);
      if (current) {
        current.push(record);
      } else {
        map.set(record.domain, [record]);
      }
    });
    return map;
  }, [panelRecords]);

  // Debug effect to track component lifecycle
  useEffect(() => {
    console.log('🚀 [PanelSidebar] Component mounted/updated');
    return () => {
      console.log('🚀 [PanelSidebar] Component unmounting');
    };
  }, []);

  // Domain configuration for the six accordion folders
  const domainConfigs: DomainConfig[] = [
    {
      key: 'panel_placement',
      name: 'Panel Placement',
      description: 'Panel placement and location information',
      icon: <FileText className="h-4 w-4" />,
      color: 'bg-blue-100 text-blue-800'
    },
    {
      key: 'panel_seaming',
      name: 'Panel Seaming',
      description: 'Panel seaming and welding data',
      icon: <Wrench className="h-4 w-4" />,
      color: 'bg-green-100 text-green-800'
    },
    {
      key: 'non_destructive',
      name: 'Non-Destructive Testing',
      description: 'Non-destructive testing results',
      icon: <TestTube className="h-4 w-4" />,
      color: 'bg-purple-100 text-purple-800'
    },
    {
      key: 'trial_weld',
      name: 'Trial Weld',
      description: 'Trial welding test data',
      icon: <Hammer className="h-4 w-4" />,
      color: 'bg-orange-100 text-orange-800'
    },
    {
      key: 'repairs',
      name: 'Repairs',
      description: 'Panel repair information',
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'bg-red-100 text-red-800'
    },
    {
      key: 'destructive',
      name: 'Destructive Testing',
      description: 'Destructive testing results',
      icon: <Settings className="h-4 w-4" />,
      color: 'bg-gray-100 text-gray-800'
    }
  ];

  // Refresh panel data when component mounts or panel changes
  useEffect(() => {
    if (isOpen && projectId && panelId) {
      refreshPanelData(projectId, panelId);
    }
  }, [isOpen, projectId, panelId, refreshPanelData]);

  // Handle import completion
  const handleImportComplete = useCallback(() => {
    refreshPanelData(projectId, panelId); // Refresh data after import
  }, [projectId, panelId, refreshPanelData]);

  // Handle manual entry completion
  const handleManualEntryComplete = useCallback(() => {
    refreshPanelData(projectId, panelId); // Refresh data after manual entry
  }, [projectId, panelId, refreshPanelData]);

  // Get record count for a domain - with robust error handling
  const getRecordCount = (domain: AsbuiltDomain): number => {
    try {
      return recordsByDomain.get(domain)?.length ?? 0;
    } catch (error) {
      console.error('Error getting record count for domain:', domain, error);
      return 0;
    }
  };

  // Handle file view
  const handleViewFile = (file: FileMetadata) => {
    setSelectedFile(file);
    setShowFileViewer(true);
  };

  const handleDomainSelect = useCallback((domain: AsbuiltDomain) => {
    setSelectedDomain(domain);
    setShowDomainRecordsModal(true);
  }, []);

  const handleRecordSelect = useCallback((record: AsbuiltRecord) => {
    setSelectedRecord(record);
  }, []);

  const handleRecordViewerClose = useCallback(() => {
    setSelectedRecord(null);
  }, []);

  const handleRecordsModalClose = useCallback(() => {
    setShowDomainRecordsModal(false);
    setSelectedDomain(null);
    setSelectedRecord(null);
  }, []);

  const selectedDomainRecords = useMemo(() => {
    if (!selectedDomain) return [];
    return recordsByDomain.get(selectedDomain) ?? [];
  }, [selectedDomain, recordsByDomain]);

  const selectedDomainFiles = useMemo(() => {
    if (!selectedDomain) return [];
    return getFilesForDomain(panelId, selectedDomain);
  }, [selectedDomain, getFilesForDomain, panelId]);

  // Render right neighbor peek - removed as it's not part of PanelAsbuiltSummary
  const renderRightNeighborPeek = () => {
    return null;
  };

  // If in mini mode, render just the expand arrow
  if (miniMode) {
    return (
      <div 
        data-mini-sidebar
        className="fixed left-0 top-1/2 transform -translate-y-1/2 bg-white border-r border-gray-200 shadow-lg z-[9999] rounded-r-lg animate-in slide-in-from-left-mini"
      >
        <button 
          onClick={onToggle}
          className="p-3 hover:bg-blue-50 transition-colors rounded-r-lg"
          title="Expand sidebar"
        >
          <ChevronRight className="h-6 w-6 text-blue-600" />
        </button>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <>

      

      
              {/* Sidebar */}
        <div 
          className="fixed left-0 top-0 h-full w-96 bg-white border-r border-gray-200 shadow-2xl z-[99999] overflow-hidden flex flex-col"
          style={{
            position: 'fixed',
            left: '0px',
            top: '0px',
            height: '100vh',
            width: '384px',
            backgroundColor: 'white',
            borderRight: '1px solid #e5e7eb',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            zIndex: 99999,
            overflow: 'hidden',
            transform: 'translateX(0px)',
            opacity: 1
          }}
        >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-2 h-10 w-10 hover:bg-blue-100"
          >
            <ChevronLeft className="h-5 w-5 text-blue-600" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Panel {panelNumber}
            </h2>
            <p className="text-lg text-gray-600">As-built Data & Information</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-gray-500">Project ID</p>
            <p className="text-xs font-mono text-gray-700">{projectId.slice(0, 8)}...</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-2 h-10 w-10 hover:bg-blue-100"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-5 w-5 text-blue-600" />
          </Button>
        </div>
      </div>

      {/* Right Neighbor Peek */}
      <div className="flex-shrink-0">
        {renderRightNeighborPeek()}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading panel data...</span>
          </div>
        ) : contextError ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 mb-2">Failed to load panel data</p>
            <p className="text-sm text-gray-600 mb-4">{contextError}</p>
            <Button onClick={() => refreshPanelData(projectId, panelId)} variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Domain Accordions */}
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">As-built Data Domains</h3>
                <p className="text-gray-600">Click on any domain to view detailed records</p>
              </div>
              
              <Accordion 
                type="single" 
                collapsible 
                value={activeDomain || undefined}
                onValueChange={(value) => setActiveDomain(value as AsbuiltDomain)}
                className="w-full space-y-4"
              >
                {domainConfigs.map((config) => {
                  const recordCount = getRecordCount(config.key);
                  const files = getFilesForDomain(panelId, config.key);
                  const hasRecords = recordCount > 0;

                  return (
                    <AccordionItem key={config.key} value={config.key} className="border-2 border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <AccordionTrigger 
                        className="px-6 py-4 hover:no-underline hover:bg-gray-50 rounded-t-xl"
                        onClick={() => handleDomainSelect(config.key)}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`p-3 rounded-full ${config.color} shadow-sm`}>
                            {config.icon}
                          </div>
                          <div className="flex-1 text-left">
                            <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                            <p className="text-sm text-gray-600">{config.description}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-sm px-3 py-1">
                              {recordCount} records
                            </Badge>
                            {files.length > 0 && (
                              <Badge variant="outline" className="text-sm px-3 py-1">
                                {files.length} files
                              </Badge>
                            )}
                            <div className="text-gray-400">
                              <ChevronRight className="h-5 w-5 transition-transform" />
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 bg-gray-50 rounded-b-xl">
                        <div className="space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-white border rounded-lg">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {hasRecords ? `View ${recordCount} record${recordCount === 1 ? '' : 's'}` : 'No records yet'}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {hasRecords
                                  ? `Records for panel ${panelNumber} will open in a dedicated modal.`
                                  : 'Import data or add a manual entry to create new records.'}
                              </p>
                            </div>
                            <Button
                              variant={hasRecords ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleDomainSelect(config.key)}
                            >
                              {hasRecords ? 'Open Records' : 'Open Records Modal'}
                            </Button>
                          </div>

                          {!hasRecords && (
                            <div className="flex flex-col sm:flex-row gap-3">
                              <Button size="sm" variant="outline" onClick={() => setShowImportModal(true)}>
                                📊 Import Data
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setShowManualEntryModal(true)}>
                                ✏️ Manual Entry
                              </Button>
                            </div>
                          )}

                          {files.length > 0 ? (
                            <div className="space-y-3">
                              <h4 className="font-medium text-gray-900">Files</h4>
                              <div className="grid grid-cols-1 gap-2">
                                {files.map((file) => (
                                  <div key={file.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                                    <div className="flex items-center gap-3">
                                      <FileText className="h-5 w-5 text-gray-500" />
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                                        <p className="text-xs text-gray-500">
                                          {new Date(file.uploadedAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewFile(file)}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      View
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-white border border-dashed rounded-lg text-sm text-gray-600">
                              No files linked to this domain yet.
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 border-t-2 border-gray-200 mt-8">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Quick Actions</h3>
                <p className="text-sm text-gray-600">Add new as-built data for this panel</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="default" 
                  size="lg"
                  onClick={() => setShowImportModal(true)}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  📊 Import Excel Data
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => setShowManualEntryModal(true)}
                  className="w-full h-12 border-2 border-gray-300 hover:border-gray-400"
                >
                  ✏️ Manual Entry
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={projectId}
        panelId={panelId}
        onImportComplete={handleImportComplete}
      />

      <ManualEntryModal
        isOpen={showManualEntryModal}
        onClose={() => setShowManualEntryModal(false)}
        projectId={projectId}
        panelId={panelId}
        onEntryComplete={handleManualEntryComplete}
      />

      <FileViewerModal
        isOpen={showFileViewer}
        onClose={() => {
          setShowFileViewer(false);
          setSelectedFile(null);
        }}
        file={selectedFile}
        showDataMapping={true}
        panelId={panelId}
        domain={selectedFile?.domain}
      />
      </div>

      <PanelDomainRecordsModal
        isOpen={showDomainRecordsModal}
        onClose={handleRecordsModalClose}
        domain={selectedDomain}
        domainConfig={selectedDomain ? domainConfigs.find((config) => config.key === selectedDomain) || null : null}
        panelId={panelId}
        panelNumber={panelNumber}
        records={selectedDomainRecords}
        files={selectedDomainFiles}
        onRecordSelect={handleRecordSelect}
        onImportClick={() => setShowImportModal(true)}
        onManualEntryClick={() => setShowManualEntryModal(true)}
        onFileOpen={handleViewFile}
      />

      <RecordViewerModal
        isOpen={!!selectedRecord}
        onClose={handleRecordViewerClose}
        record={selectedRecord}
      />
    </>
  );
};

export default PanelSidebar;
