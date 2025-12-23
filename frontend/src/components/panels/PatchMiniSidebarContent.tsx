'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Patch } from '@/types/patch';
import { useFormData } from '@/hooks/useFormData';
import { useCanvasState } from '@/contexts/PanelContext';

interface PatchMiniSidebarContentProps {
  patch: Patch;
  projectId: string;
  onClose: () => void;
  onViewFullDetails: () => void;
}

export function PatchMiniSidebarContent({
  patch,
  projectId,
  onClose,
  onViewFullDetails
}: PatchMiniSidebarContentProps) {
  const { forms, isLoading } = useFormData({
    projectId,
    asbuiltRecordId: patch.asbuiltRecordId,
    panelId: patch.panelId
  });

  const { canvas, dispatchCanvas } = useCanvasState();

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-lg">
          Patch {patch.patchNumber || patch.id.slice(0, 8)}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-3 text-sm">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs">Patch Number</div>
            <div className="font-medium">{patch.patchNumber || 'N/A'}</div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs">Date</div>
            <div className="font-medium">{patch.date || 'N/A'}</div>
          </div>
        </div>

        {/* Position */}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs mb-1">Position</div>
          <div className="font-medium">
            X: {Math.round(patch.x)}, Y: {Math.round(patch.y)}
          </div>
        </div>

        {/* Dimensions */}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs mb-1">Radius</div>
          <div className="font-medium">
            {patch.radius} ft (Diameter: {patch.radius * 2} ft)
          </div>
        </div>

        {/* Location */}
        {patch.location && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Location</div>
            <div className="font-medium">{patch.location}</div>
          </div>
        )}

        {/* Material */}
        {patch.material && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Material</div>
            <div className="font-medium">{patch.material}</div>
          </div>
        )}

        {/* Thickness */}
        {patch.thickness && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Thickness</div>
            <div className="font-medium">{patch.thickness} in</div>
          </div>
        )}

        {/* Linked Forms Count */}
        <div className="bg-blue-50 p-2 rounded">
          <div className="text-gray-500 text-xs mb-1">Linked Forms</div>
          <div className="font-medium">
            {isLoading ? 'Loading...' : `${forms.length} form${forms.length !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Notes */}
        {patch.notes && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Notes</div>
            <div className="font-medium text-xs">{patch.notes}</div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 border-t border-gray-200">
          <div className="space-y-2">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs transition-all duration-150 ease-in-out hover:scale-105 hover:bg-blue-50 hover:border-blue-300"
                onClick={() => {
                  // Center view on this patch
                  const centerX = patch.x;
                  const centerY = patch.y;
                  dispatchCanvas({ 
                    type: 'SET_WORLD_OFFSET', 
                    payload: { 
                      x: -centerX * canvas.worldScale + window.innerWidth / 2, 
                      y: -centerY * canvas.worldScale + window.innerHeight / 2 
                    } 
                  });
                }}
              >
                Center View
              </Button>
            </div>
            
            <Button
              variant="default"
              size="sm"
              className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white transition-all duration-150 ease-in-out hover:scale-105"
              onClick={onViewFullDetails}
            >
              View Full Details
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

