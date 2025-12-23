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
  onDelete: () => Promise<void>;
}

export function PatchMiniSidebarContent({
  patch,
  projectId,
  onClose,
  onDelete
}: PatchMiniSidebarContentProps) {
  const { forms, isLoading } = useFormData({
    projectId,
    asbuiltRecordId: patch.asbuiltRecordId,
    panelId: patch.panelId
  });

  const { canvas, dispatchCanvas } = useCanvasState();

  // Extract primary form fields from the form that created this patch or first form
  const primaryForm = forms.find(f => f.id === patch.asbuiltRecordId) || forms[0];
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
    if (confirm(`Are you sure you want to delete Patch ${patch.patchNumber || patch.id.slice(0, 8)}? This action cannot be undone.`)) {
      try {
        await onDelete();
        onClose(); // Close mini-sidebar after deletion
      } catch (error) {
        console.error('Error deleting patch:', error);
        alert('Failed to delete patch. Please try again.');
      }
    }
  };

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

        {/* Location */}
        {patch.location && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-500 text-xs mb-1">Location</div>
            <div className="font-medium">{patch.location}</div>
          </div>
        )}

        {/* Form Information */}
        {primaryForm && (
          <div className="space-y-2">
            <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Form Information</div>
            
            {/* Welder/Operator */}
            {(formData.operatorInitials || formData.seamerInitials) && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Welder/Operator</div>
                <div className="font-medium">{formData.operatorInitials || formData.seamerInitials}</div>
              </div>
            )}

            {/* Extruder Number */}
            {formData.extruderNumber && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Extruder Number</div>
                <div className="font-medium">{formData.extruderNumber}</div>
              </div>
            )}

            {/* Temperatures */}
            {formData.wedgeTemp && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Wedge Temp</div>
                <div className="font-medium">{formData.wedgeTemp} °F</div>
              </div>
            )}
            
            {formData.barrelTemp && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Barrel Temp</div>
                <div className="font-medium">{formData.barrelTemp} °F</div>
              </div>
            )}
            
            {formData.preheatTemp && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Preheat Temp</div>
                <div className="font-medium">{formData.preheatTemp} °F</div>
              </div>
            )}
            
            {formData.ambientTemp && (
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
              className="w-full text-xs bg-red-600 hover:bg-red-700 text-white transition-all duration-150 ease-in-out hover:scale-105"
              onClick={handleDelete}
            >
              Delete Patch
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

