'use client';

import React from 'react';
import { useLinerSystem } from '@/hooks/usePanelSystem';
import { LinerCanvas } from './LinerCanvas';

interface GeosyntheticLinerLayoutProps {
  projectId: string;
}

// SITE CONFIGURATION FOR GEOSYNTHETIC LINERS
const SITE_CONFIG = {
  // Typical liner roll dimensions (feet)
  TYPICAL_ROLL_WIDTH: 20,    // 20 feet wide rolls are common
  TYPICAL_ROLL_LENGTH: 100,  // Variable length, 100ft example
  
  // Site dimensions for 200 rolls east-west, 50 north-south
  SITE_WIDTH: 4000,   // 200 rolls × 20ft width
  SITE_HEIGHT: 5000,  // 50 rolls × 100ft length
};

export function GeosyntheticLinerLayout({ projectId }: GeosyntheticLinerLayoutProps) {
  const {
    state,
    isLoading,
    error,
    updateRoll,
    updateViewport,
    selectRoll,
    fitToSite
  } = useLinerSystem(projectId);
  
  if (isLoading) return <div className="flex items-center justify-center h-full">Loading geosynthetic liner layout...</div>;
  if (error) return <div className="flex items-center justify-center h-full text-red-600">Error: {error}</div>;
  
  const totalCoverage = state.rolls.length * SITE_CONFIG.TYPICAL_ROLL_WIDTH * SITE_CONFIG.TYPICAL_ROLL_LENGTH;
  const acres = totalCoverage / 43560; // Convert sq ft to acres
  
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-gray-100 border-b p-2 flex gap-2">
        <button
          onClick={fitToSite}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Fit to Site
        </button>
        <div className="text-sm text-gray-600 flex items-center">
          {state.rolls.length} rolls • {acres.toFixed(1)} acres • {SITE_CONFIG.SITE_WIDTH}&apos; × {SITE_CONFIG.SITE_HEIGHT}&apos; site
        </div>
        {state.isDirty && (
          <div className="text-sm text-orange-600 flex items-center">
            • Saving changes...
          </div>
        )}
      </div>
      
      {/* Canvas */}
      <div className="flex-1">
        <LinerCanvas
          rolls={state.rolls}
          viewport={state.viewport}
          selectedRollId={state.selectedRollId}
          onRollUpdate={updateRoll}
          onViewportUpdate={updateViewport}
          onRollSelect={selectRoll}
        />
      </div>
    </div>
  );
}
