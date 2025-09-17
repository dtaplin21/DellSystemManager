'use client';

import React from 'react';
import { usePanelSystem } from '@/hooks/usePanelSystem';
import { SimpleCanvas } from './SimpleCanvas';

interface SimplePanelLayoutProps {
  projectId: string;
}

export function SimplePanelLayout({ projectId }: SimplePanelLayoutProps) {
  const {
    state,
    isLoading,
    error,
    updatePanel,
    updateCanvas,
    selectPanel
  } = usePanelSystem(projectId);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <SimpleCanvas
        panels={state.panels}
        canvasState={state.canvas}
        selectedPanelId={state.selectedPanelId}
        onPanelUpdate={updatePanel}
        onCanvasUpdate={updateCanvas}
        onPanelSelect={selectPanel}
      />
    </div>
  );
}
