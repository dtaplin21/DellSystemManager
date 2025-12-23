'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DestructiveTest } from '@/types/destructiveTest';
import { useFormData } from '@/hooks/useFormData';
import { useCanvasState } from '@/contexts/PanelContext';

interface DestructiveTestMiniSidebarContentProps {
  destructiveTest: DestructiveTest;
  projectId: string;
  onClose: () => void;
  onViewFullDetails: () => void;
}

export function DestructiveTestMiniSidebarContent({
  destructiveTest,
  projectId,
  onClose,
  onViewFullDetails
}: DestructiveTestMiniSidebarContentProps) {
  const { forms, isLoading } = useFormData({
    projectId,
    asbuiltRecordId: destructiveTest.asbuiltRecordId,
    panelId: destructiveTest.panelId
  });

  const { canvas, dispatchCanvas } = useCanvasState();

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-lg">
          Test {destructiveTest.sampleId || destructiveTest.id.slice(0, 8)}
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
            <div className="text-gray-500 text-xs">Sample ID</div>
            <div className="font-medium font-mono">{destructiveTest.sampleId || 'N/A'}</div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs">Date</div>
            <div className="font-medium">{destructiveTest.date || 'N/A'}</div>
          </div>
        </div>

        {/* Test Result */}
        {destructiveTest.testResult && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Test Result</div>
            <Badge 
              className={
                destructiveTest.testResult === 'pass' ? 'bg-green-100 text-green-800' :
                destructiveTest.testResult === 'fail' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }
            >
              {destructiveTest.testResult.toUpperCase()}
            </Badge>
          </div>
        )}

        {/* Position */}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs mb-1">Position</div>
          <div className="font-medium">
            X: {Math.round(destructiveTest.x)}, Y: {Math.round(destructiveTest.y)}
          </div>
        </div>

        {/* Dimensions */}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs mb-1">Dimensions</div>
          <div className="font-medium">
            {destructiveTest.width} × {destructiveTest.height} ft
          </div>
        </div>

        {/* Location */}
        {destructiveTest.location && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Location</div>
            <div className="font-medium">{destructiveTest.location}</div>
          </div>
        )}

        {/* Material */}
        {destructiveTest.material && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Material</div>
            <div className="font-medium">{destructiveTest.material}</div>
          </div>
        )}

        {/* Thickness */}
        {destructiveTest.thickness && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Thickness</div>
            <div className="font-medium">{destructiveTest.thickness} in</div>
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
        {destructiveTest.notes && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Notes</div>
            <div className="font-medium text-xs">{destructiveTest.notes}</div>
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
                  // Center view on this test
                  const centerX = destructiveTest.x + destructiveTest.width / 2;
                  const centerY = destructiveTest.y + destructiveTest.height / 2;
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

