'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, FileText, Wrench, TestTube, Hammer, AlertTriangle, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { 
  AsbuiltRecord, 
  AsbuiltDomain
} from '@/types/asbuilt';
import { DestructiveTest } from '@/types/destructiveTest';
import { useFormData } from '@/hooks/useFormData';

interface DestructSidebarProps {
  isOpen: boolean;
  miniMode?: boolean;
  onToggle: () => void;
  projectId: string;
  destructiveTest: DestructiveTest;
  onClose: () => void;
}

interface DomainConfig {
  key: AsbuiltDomain;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const DestructSidebar: React.FC<DestructSidebarProps> = ({
  isOpen,
  miniMode = false,
  onToggle,
  projectId,
  destructiveTest,
  onClose
}) => {
  // Fetch form data using the hook
  const { forms, isLoading, error, refresh } = useFormData({
    projectId,
    asbuiltRecordId: destructiveTest.asbuiltRecordId,
    panelId: destructiveTest.panelId
  });

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

  // Group forms by domain
  const formsByDomain = useMemo(() => {
    const grouped = new Map<AsbuiltDomain, AsbuiltRecord[]>();
    
    domainConfigs.forEach(config => {
      grouped.set(config.key, []);
    });

    forms.forEach(form => {
      const domain = form.domain as AsbuiltDomain;
      if (grouped.has(domain)) {
        grouped.get(domain)!.push(form);
      }
    });

    return grouped;
  }, [forms]);

  // Get record count for a domain
  const getRecordCount = (domain: AsbuiltDomain): number => {
    return formsByDomain.get(domain)?.length ?? 0;
  };

  // Render form data (simplified - forms are internal, not Excel)
  const renderFormData = (form: AsbuiltRecord) => {
    // Prefer canonical camelCase, but tolerate older snake_case payloads
    const mappedData = form.mappedData || (form as any).mapped_data || {};
    
    // Highlight destructive test specific fields
    const isDestructiveForm = form.domain === 'destructive';
    
    return (
      <div className="space-y-2 text-sm">
        {isDestructiveForm && (
          <div className="mb-3 p-2 bg-gray-50 rounded">
            <h4 className="font-semibold text-gray-900 mb-2">Destructive Test Data</h4>
            {mappedData.sampleId && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Sample ID:</span>
                <span className="text-gray-900 font-mono">{mappedData.sampleId}</span>
              </div>
            )}
            {mappedData.passFail && (
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-600">Result:</span>
                <Badge 
                  className={
                    mappedData.passFail === 'Pass' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }
                >
                  {mappedData.passFail}
                </Badge>
              </div>
            )}
          </div>
        )}
        
        {Object.entries(mappedData).map(([key, value]) => {
          if (value === null || value === undefined || value === '' || 
              (isDestructiveForm && (key === 'sampleId' || key === 'passFail'))) return null;
          
          return (
            <div key={key} className="flex justify-between">
              <span className="font-medium text-gray-600 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}:
              </span>
              <span className="text-gray-900">{String(value)}</span>
            </div>
          );
        })}
        {form.status && (
          <div className="flex justify-between items-center mt-2">
            <span className="font-medium text-gray-600">Status:</span>
            <Badge 
              className={
                form.status === 'approved' ? 'bg-green-100 text-green-800' :
                form.status === 'rejected' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }
            >
              {form.status}
            </Badge>
          </div>
        )}
        {form.source && (
          <div className="flex justify-between">
            <span className="font-medium text-gray-600">Source:</span>
            <span className="text-gray-900 capitalize">{form.source}</span>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed right-0 top-0 h-full bg-white shadow-lg z-50 transition-transform duration-300 ${
      miniMode ? 'w-64' : 'w-96'
    } ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold">Destructive Test Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Destructive Test Info */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Test Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Sample ID:</span>
                <span className="text-gray-900 font-mono">{destructiveTest.sampleId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Date:</span>
                <span className="text-gray-900">{destructiveTest.date}</span>
              </div>
              {destructiveTest.testResult && (
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-600">Test Result:</span>
                  <Badge 
                    className={
                      destructiveTest.testResult === 'pass' ? 'bg-green-100 text-green-800' :
                      destructiveTest.testResult === 'fail' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {destructiveTest.testResult}
                  </Badge>
                </div>
              )}
              {destructiveTest.location && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Location:</span>
                  <span className="text-gray-900">{destructiveTest.location}</span>
                </div>
              )}
              {destructiveTest.material && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Material:</span>
                  <span className="text-gray-900">{destructiveTest.material}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Forms by Domain */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Form Data</h3>
            
            {isLoading ? (
              <div className="text-center py-4 text-gray-500">Loading forms...</div>
            ) : error ? (
              <div className="text-center py-4 text-red-500">Error loading forms: {error}</div>
            ) : forms.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No forms linked to this destructive test</div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {domainConfigs.map((config) => {
                  const domainForms = formsByDomain.get(config.key) || [];
                  const count = domainForms.length;

                  if (count === 0) return null;

                  return (
                    <AccordionItem key={config.key} value={config.key}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2 flex-1">
                          <div className={config.color + ' p-1 rounded'}>
                            {config.icon}
                          </div>
                          <span className="font-medium">{config.name}</span>
                          <Badge variant="secondary" className="ml-auto">
                            {count}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          {domainForms.map((form, index) => (
                            <Card 
                              key={form.id} 
                              className={
                                form.id === destructiveTest.asbuiltRecordId 
                                  ? 'border-2 border-blue-500 bg-blue-50' 
                                  : ''
                              }
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm">
                                    Form #{index + 1}
                                    {form.id === destructiveTest.asbuiltRecordId && (
                                      <Badge className="ml-2 bg-blue-500">Created This Test</Badge>
                                    )}
                                  </CardTitle>
                                  {(() => {
                                    const createdAt = form.createdAt || (form as any).created_at;
                                    return createdAt ? (
                                    <span className="text-xs text-gray-500">
                                      {new Date(createdAt).toLocaleDateString()}
                                    </span>
                                    ) : null;
                                  })()}
                                </div>
                              </CardHeader>
                              <CardContent>
                                {renderFormData(form)}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DestructSidebar;

