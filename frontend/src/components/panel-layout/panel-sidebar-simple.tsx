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

interface PanelSidebarProps {
  isOpen: boolean;
  miniMode?: boolean;
  onToggle: () => void;
  projectId: string;
  panelId: string;
  panelNumber: string;
  onClose: () => void;
}

const PanelSidebar: React.FC<PanelSidebarProps> = ({
  isOpen,
  miniMode = false,
  onToggle,
  projectId,
  panelId,
  panelNumber,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Early return if sidebar is not open
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
              <p className="text-lg text-gray-600">Panel Information</p>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Panel Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Panel Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Panel Number</p>
                    <p className="font-medium">{panelNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Panel ID</p>
                    <p className="font-mono text-sm">{panelId.slice(0, 8)}...</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Project ID</p>
                  <p className="font-mono text-sm">{projectId}</p>
                </div>
              </CardContent>
            </Card>

            {/* Status Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Panel Status</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Data Collection</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      Ready
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => console.log('Edit panel clicked')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Edit Panel Details
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => console.log('View history clicked')}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  View History
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => console.log('Export data clicked')}
                >
                  <Hammer className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
              </CardContent>
            </Card>

            {/* Information Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">Panel Management</h4>
                  <p className="text-sm text-blue-700">
                    This panel is ready for data collection and management.
                    Use the panel layout tool to configure and manage panel information.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PanelSidebar;
