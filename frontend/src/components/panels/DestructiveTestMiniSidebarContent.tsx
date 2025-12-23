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
  onDelete: () => Promise<void>;
}

export function DestructiveTestMiniSidebarContent({
  destructiveTest,
  projectId,
  onClose,
  onDelete
}: DestructiveTestMiniSidebarContentProps) {
  const { forms, isLoading } = useFormData({
    projectId,
    asbuiltRecordId: destructiveTest.asbuiltRecordId,
    panelId: destructiveTest.panelId
  });

  const { canvas, dispatchCanvas } = useCanvasState();

  // Extract primary form fields from the form that created this test or first form
  const primaryForm = forms.find(f => f.id === destructiveTest.asbuiltRecordId) || forms[0];
  // Handle both camelCase and snake_case from API
  const formData = primaryForm?.mappedData || (primaryForm as any)?.mapped_data || {};

  // Extract panel numbers from mobile forms only
  const panelNumbers = new Set<string>();
  
  // From linked forms
  forms.forEach(form => {
    const formData = form.mappedData || (form as any)?.mapped_data || {};
    if (formData.panelNumber) {
      panelNumbers.add(String(formData.panelNumber));
    }
  });
  
  const panelNumbersArray = Array.from(panelNumbers);

  // Handle delete with confirmation
  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete Test ${destructiveTest.sampleId || destructiveTest.id.slice(0, 8)}? This action cannot be undone.`)) {
      try {
        await onDelete();
        onClose(); // Close mini-sidebar after deletion
      } catch (error) {
        console.error('Error deleting destructive test:', error);
        alert('Failed to delete destructive test. Please try again.');
      }
    }
  };

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

        {/* Location */}
        {destructiveTest.location && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Location</div>
            <div className="font-medium">{destructiveTest.location}</div>
          </div>
        )}

        {/* Form Information */}
        {primaryForm && (
          <div className="space-y-2">
            <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Form Information</div>
            
            {/* Tester/Operator */}
            {(formData.testerInitials || formData.operatorInitials) && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Tester/Operator</div>
                <div className="font-medium">{formData.testerInitials || formData.operatorInitials}</div>
              </div>
            )}

            {/* Machine Number */}
            {formData.machineNumber && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Machine Number</div>
                <div className="font-medium">{formData.machineNumber}</div>
              </div>
            )}

            {/* Extruder Number */}
            {formData.extruderNumber && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Extruder Number</div>
                <div className="font-medium">{formData.extruderNumber}</div>
              </div>
            )}

            {/* Track Peel Inside */}
            {formData.trackPeelInside !== undefined && formData.trackPeelInside !== null && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Track Peel Inside</div>
                <div className="font-medium">{formData.trackPeelInside}</div>
              </div>
            )}

            {/* Track Peel Outside */}
            {formData.trackPeelOutside !== undefined && formData.trackPeelOutside !== null && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Track Peel Outside</div>
                <div className="font-medium">{formData.trackPeelOutside}</div>
              </div>
            )}

            {/* Tensile (lbs/in) */}
            {formData.tensileLbsPerIn !== undefined && formData.tensileLbsPerIn !== null && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Tensile (lbs/in)</div>
                <div className="font-medium">{formData.tensileLbsPerIn}</div>
              </div>
            )}

            {/* Ambient Temp */}
            {formData.ambientTemp !== undefined && formData.ambientTemp !== null && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Ambient Temp</div>
                <div className="font-medium">{formData.ambientTemp} °F</div>
              </div>
            )}
          </div>
        )}

        {/* Panel Number(s) */}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs mb-1">Panel Number(s)</div>
          <div className="font-medium">
            {panelNumbersArray.length > 0 
              ? panelNumbersArray.join(', ') 
              : 'N/A'}
          </div>
        </div>

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
              className="w-full text-xs bg-red-600 hover:bg-red-700 text-white transition-all duration-150 ease-in-out hover:scale-105"
              onClick={handleDelete}
            >
              Delete Test
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

