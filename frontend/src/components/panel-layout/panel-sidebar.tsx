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
import { supabase } from '@/lib/supabase';

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

    setLoading(true);
    setError(null);

    try {
      // Get the current Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No authentication token found. Please log in.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      };
      
      const response = await fetch(`http://localhost:8003/api/asbuilt/${projectId}/${panelId}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch asbuilt data: ${response.statusText}`);
      }

      const data: PanelAsbuiltSummary = await response.json();
      setAsbuiltData(data);
    } catch (err) {
      console.error('Error fetching asbuilt data:', err);
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
          {Object.entries(record.mappedData).map(([key, value]) => {
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
          })}
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

  return (
    <div className="fixed left-0 top-0 h-full w-96 bg-white border-r border-gray-200 shadow-xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-1 h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-gray-900">
              Selected Panel: P-{panelNumber}
            </h2>
            <p className="text-sm text-gray-600">As-built Information</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="p-1 h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Right Neighbor Peek */}
      {renderRightNeighborPeek()}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
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
            <Accordion 
              type="single" 
              collapsible 
              value={activeDomain || undefined}
              onValueChange={(value) => setActiveDomain(value as AsbuiltDomain)}
              className="w-full"
            >
              {domainConfigs.map((config) => {
                const recordCount = getRecordCount(config.key);
                const records = getRecords(config.key);

                return (
                  <AccordionItem key={config.key} value={config.key} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-2 rounded-full ${config.color}`}>
                          {config.icon}
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="font-medium text-gray-900">{config.name}</h3>
                          <p className="text-sm text-gray-600">{config.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {recordCount} records
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {recordCount === 0 ? (
                        <div className="text-center py-6 text-gray-500">
                          <p>No {config.name.toLowerCase()} records found</p>
                          <p className="text-sm">Records will appear here after import or manual entry</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {records.map((record, index) => renderRecordItem(record, index))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowImportModal(true)}
                  className="w-full"
                >
                  Import Data
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowManualEntryModal(true)}
                  className="w-full"
                >
                  Manual Entry
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
  );
};

export default PanelSidebar;
