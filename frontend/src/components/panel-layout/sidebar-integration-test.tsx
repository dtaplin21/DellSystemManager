'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PanelSidebar from './panel-sidebar';

const SidebarIntegrationTest: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [testPanel] = useState({
    id: 'test-panel-1',
    panelNumber: 'P-001',
    projectId: 'test-project'
  });

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Panel Sidebar Integration Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            This component tests the integration between the panel system and the asbuilt sidebar.
          </p>
          
          <div className="flex gap-4">
            <Button 
              onClick={() => setSidebarOpen(true)}
              variant="default"
            >
              Open Sidebar
            </Button>
            
            <Button 
              onClick={() => setSidebarOpen(false)}
              variant="outline"
            >
              Close Sidebar
            </Button>
          </div>

          <div className="text-sm text-gray-500">
            <p>• Click &quot;Open Sidebar&quot; to test the sidebar functionality</p>
            <p>• The sidebar should display mock asbuilt data for panel P-001</p>
            <p>• Test the accordion folders and modal interactions</p>
            <p>• Use Escape key to close the sidebar</p>
          </div>
        </CardContent>
      </Card>

      {/* Test Sidebar */}
      {sidebarOpen && (
        <PanelSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          projectId={testPanel.projectId}
          panelId={testPanel.id}
          panelNumber={testPanel.panelNumber}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default SidebarIntegrationTest;
