'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileText, Wrench, TestTube, Hammer, AlertTriangle, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

interface PanelSidebarProps {
  isOpen: boolean;
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
  onToggle,
  projectId,
  panelId,
  panelNumber,
  onClose
}) => {
  const [asbuiltData, setAsbuiltData] = useState<PanelAsbuiltSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDomain, setActiveDomain] = useState<AsbuiltDomain | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);

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

  // Fetch asbuilt data for the selected panel
  const fetchAsbuiltData = useCallback(async () => {
    if (!projectId || !panelId) return;

    console.log('🔍 [PanelSidebar] Fetching asbuilt data for:', { projectId, panelId });
    setLoading(true);
    setError(null);

    try {
      // Use the safe API function with centralized configuration
      const data: PanelAsbuiltSummary = await getAsbuiltSafe(projectId, panelId);
      console.log('🔍 [PanelSidebar] Data received:', data);
      setAsbuiltData(data);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('🔍 [PanelSidebar] Error fetching asbuilt data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      
      // Set fallback data to prevent complete failure
      setAsbuiltData({
        panelPlacement: [],
        panelSeaming: [],
        nonDestructive: [],
        trialWeld: [],
        repairs: [],
        destructive: []
      });
      
      // Show helpful message for empty data
      if (err instanceof Error && err.message.includes('404')) {
        setError('No as-built data found for this panel. Data will appear here once imported or manually entered.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, panelId]);

  // Fetch data when component mounts or panel changes
  useEffect(() => {
    if (isOpen && projectId && panelId) {
      fetchAsbuiltData();
    }
  }, [isOpen, projectId, panelId, fetchAsbuiltData]);

  // Handle import completion
  const handleImportComplete = useCallback(() => {
    fetchAsbuiltData(); // Refresh data after import
  }, [fetchAsbuiltData]);

  // Handle manual entry completion
  const handleManualEntryComplete = useCallback(() => {
    fetchAsbuiltData(); // Refresh data after manual entry
  }, [fetchAsbuiltData]);

  // Get record count for a domain
  const getRecordCount = (domain: AsbuiltDomain): number => {
    if (!asbuiltData) return 0;
    
    switch (domain) {
      case 'panel_placement':
        return asbuiltData.panelPlacement?.length || 0;
      case 'panel_seaming':
        return asbuiltData.panelSeaming?.length || 0;
      case 'non_destructive':
        return asbuiltData.nonDestructive?.length || 0;
      case 'trial_weld':
        return asbuiltData.trialWeld?.length || 0;
      case 'repairs':
        return asbuiltData.repairs?.length || 0;
      case 'destructive':
        return asbuiltData.destructive?.length || 0;
      default:
        return 0;
    }
  };

  // Get records for a domain
  const getRecords = (domain: AsbuiltDomain): AsbuiltRecord[] => {
    if (!asbuiltData) return [];
    
    switch (domain) {
      case 'panel_placement':
        return asbuiltData.panelPlacement || [];
      case 'panel_seaming':
        return asbuiltData.panelSeaming || [];
      case 'non_destructive':
        return asbuiltData.nonDestructive || [];
      case 'trial_weld':
        return asbuiltData.trialWeld || [];
      case 'repairs':
        return asbuiltData.repairs || [];
      case 'destructive':
        return asbuiltData.destructive || [];
      default:
        return [];
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Render record item
  const renderRecordItem = (record: AsbuiltRecord, index: number) => {
    const isReviewRequired = record.requiresReview;
    const confidence = record.aiConfidence || 0;

    return (
      <div key={record.id} className="p-3 border rounded-lg mb-2 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {formatDate(record.createdAt)}
            </span>
            {isReviewRequired && (
              <Badge variant="destructive" className="text-xs">
                Review Required
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {confidence < 0.8 && (
              <Badge variant="secondary" className="text-xs">
                {Math.round(confidence * 100)}% Confidence
              </Badge>
            )}
          </div>
        </div>
        
        <div className="space-y-1">
          {record.mappedData && typeof record.mappedData === 'object' ? (
            Object.entries(record.mappedData).map(([key, value]) => {
              if (!value) return null;
              
              return (
                <div key={key} className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className="text-gray-900">
                    {typeof value === 'string' && value.length > 50 
                      ? `${value.substring(0, 50)}...` 
                      : value.toString()}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-gray-500 italic">
              No mapped data available
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render right neighbor peek
  const renderRightNeighborPeek = () => {
    if (!asbuiltData?.rightNeighborPeek) return null;

    const { panelNumber: neighborPanel, quickStatus, link } = asbuiltData.rightNeighborPeek;

    return (
      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-blue-900">Right Neighbor Panel</h4>
            <p className="text-sm text-blue-700">P-{neighborPanel}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            className="text-blue-700 border-blue-300 hover:bg-blue-100"
            onClick={() => window.open(link, '_blank')}
          >
            View
          </Button>
        </div>
        <div className="mt-2">
          <Badge variant="outline" className="text-xs">
            {quickStatus}
          </Badge>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;
  
  console.log('🎯 [PanelSidebar] Rendering sidebar with props:', { isOpen, projectId, panelId, panelNumber });

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[9998] transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-96 bg-white border-r border-gray-200 shadow-2xl z-[9999] overflow-hidden transform transition-all duration-300 ease-in-out animate-in slide-in-from-left">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
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
            onClick={onClose}
            className="p-2 h-10 w-10 hover:bg-red-100"
          >
            <ChevronRight className="h-5 w-5 text-red-600" />
          </Button>
        </div>
      </div>

      {/* Right Neighbor Peek */}
      {renderRightNeighborPeek()}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading panel data...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 mb-2">Failed to load panel data</p>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchAsbuiltData} variant="outline">
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
                  const records = getRecords(config.key);

                  return (
                    <AccordionItem key={config.key} value={config.key} className="border-2 border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50 rounded-t-xl">
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
                            <div className="text-gray-400">
                              <ChevronRight className="h-5 w-5 transition-transform" />
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 bg-gray-50 rounded-b-xl">
                        {recordCount === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <div className="text-6xl mb-4">📁</div>
                            <p className="text-lg font-medium mb-2">No {config.name.toLowerCase()} records found</p>
                            <p className="text-sm text-gray-600 mb-4">Records will appear here after import or manual entry</p>
                            <div className="flex gap-2 justify-center">
                              <Button size="sm" variant="outline" onClick={() => setShowImportModal(true)}>
                                📊 Import Data
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setShowManualEntryModal(true)}>
                                ✏️ Manual Entry
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {records.map((record, index) => renderRecordItem(record, index))}
                          </div>
                        )}
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
      </div>
    </>
  );
};

export default PanelSidebar;
