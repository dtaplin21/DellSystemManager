'use client';

import React from 'react';
import { PanelProvider } from '@/contexts/PanelContext';
import { PanelCanvas } from '@/components/panels/PanelCanvas';
import { PanelToolbar } from '@/components/panels/PanelToolbar';
import { PanelLayoutErrorBoundary } from '@/components/panels/PanelLayoutErrorBoundary';
import { Panel } from '@/types/panel';

// Simple test component with mock data - NO backend fetching
export default function PanelLayoutTest() {
  // Create some test panels
  const testPanels: Panel[] = [
    {
      id: 'test-panel-1',
      width: 2,
      height: 1,
      x: 100,
      y: 100,
      rotation: 0,
      isValid: true,
      shape: 'rectangle',
      type: 'test',
      model: 'Test Panel 1',
      manufacturer: 'Test Co',
      power: 400,
      efficiency: 0.22
    },
    {
      id: 'test-panel-2',
      width: 1.5,
      height: 1,
      x: 300,
      y: 150,
      rotation: 0,
      isValid: true,
      shape: 'rectangle',
      type: 'test',
      model: 'Test Panel 2',
      manufacturer: 'Test Co',
      power: 300,
      efficiency: 0.20
    }
  ];

  return (
    <PanelLayoutErrorBoundary>
      <PanelProvider 
        initialPanels={testPanels} 
        featureFlags={{
          ENABLE_PERSISTENCE: true,
          ENABLE_DRAGGING: true,
          ENABLE_LOCAL_STORAGE: true,
          ENABLE_DEBUG_LOGGING: true,
          ENABLE_WEBSOCKET_UPDATES: false,
        }}
      >
        <div className="flex flex-col h-full w-full">
          {/* Toolbar */}
          <PanelToolbar
            onSave={() => console.log('Save clicked')}
            onExport={() => console.log('Export clicked')}
            onImport={() => console.log('Import clicked')}
            hasUnsavedChanges={false}
            isFullscreen={false}
            showFullscreenToggle={true}
          />
          
          {/* Main Canvas Area */}
          <div className="flex-1 relative">
            <PanelCanvas
              panels={testPanels}
              onPanelClick={(panel) => console.log('Panel clicked:', panel.id)}
              onPanelDoubleClick={(panel) => console.log('Panel double-clicked:', panel.id)}
              enableDebugLogging={true}
            />
          </div>
        </div>
      </PanelProvider>
    </PanelLayoutErrorBoundary>
  );
}
