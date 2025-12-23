'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { forms, isLoading } = useFormData({
    projectId,
    asbuiltRecordId: patch.asbuiltRecordId,
    panelId: patch.panelId
  });

  const { canvas, dispatchCanvas } = useCanvasState();

  // Helper function to safely extract field values (checks both camelCase and snake_case)
  const getFieldValue = (data: any, ...fieldNames: string[]): any => {
    for (const fieldName of fieldNames) {
      const value = data?.[fieldName];
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }
    return null;
  };

  // Extract primary form fields from the form that created this patch
  const primaryForm = forms.find(f => f.id === patch.asbuiltRecordId) || forms[0];
  // Handle both camelCase and snake_case from API, and check raw_data as fallback
  const mappedData = primaryForm?.mappedData || (primaryForm as any)?.mapped_data || {};
  const rawData = (primaryForm as any)?.raw_data || {};
  const formData = { ...rawData, ...mappedData }; // Merge with raw_data as fallback

  // Extract panel numbers from ONLY the directly linked form (asbuiltRecordId)
  const panelNumbers = new Set<string>();
  
  // Only get panel numbers from the form that created this patch
  if (primaryForm && primaryForm.id === patch.asbuiltRecordId) {
    const primaryFormData = primaryForm.mappedData || (primaryForm as any)?.mapped_data || {};
    const primaryRawData = (primaryForm as any)?.raw_data || {};
    const combinedFormData = { ...primaryRawData, ...primaryFormData };
    
    // Check both panelNumber (singular) and panelNumbers (plural/comma-separated)
    const panelNumber = getFieldValue(combinedFormData, 'panelNumber', 'panel_number');
    const panelNumbersStr = getFieldValue(combinedFormData, 'panelNumbers', 'panel_numbers');
    
    if (panelNumber) {
      panelNumbers.add(String(panelNumber));
    }
    
    if (panelNumbersStr) {
      // Handle comma-separated panel numbers
      const numbers = String(panelNumbersStr).split(',').map(n => n.trim()).filter(Boolean);
      numbers.forEach(n => panelNumbers.add(n));
    }
  }
  
  const panelNumbersArray = Array.from(panelNumbers);

  // Handle delete button click - open confirmation dialog
  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  // Handle confirmed delete
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setShowDeleteDialog(false);
      onClose(); // Close mini-sidebar after deletion
    } catch (error) {
      console.error('Error deleting patch:', error);
      // Error will be handled by parent component or show toast notification
      setIsDeleting(false);
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
            {(getFieldValue(formData, 'operatorInitials', 'operator_initials') || 
              getFieldValue(formData, 'seamerInitials', 'seamer_initials')) && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Welder/Operator</div>
                <div className="font-medium">
                  {getFieldValue(formData, 'operatorInitials', 'operator_initials') || 
                   getFieldValue(formData, 'seamerInitials', 'seamer_initials')}
                </div>
              </div>
            )}

            {/* Extruder Number */}
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500 text-xs mb-1">Extruder Number</div>
              <div className="font-medium">
                {getFieldValue(formData, 'extruderNumber', 'extruder_number') || 'N/A'}
              </div>
            </div>

            {/* Temperatures */}
            {getFieldValue(formData, 'wedgeTemp', 'wedge_temp') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Wedge Temp</div>
                <div className="font-medium">
                  {getFieldValue(formData, 'wedgeTemp', 'wedge_temp')} °F
                </div>
              </div>
            )}
            
            {getFieldValue(formData, 'barrelTemp', 'barrel_temp') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Barrel Temp</div>
                <div className="font-medium">
                  {getFieldValue(formData, 'barrelTemp', 'barrel_temp')} °F
                </div>
              </div>
            )}
            
            {getFieldValue(formData, 'preheatTemp', 'preheat_temp') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Preheat Temp</div>
                <div className="font-medium">
                  {getFieldValue(formData, 'preheatTemp', 'preheat_temp')} °F
                </div>
              </div>
            )}
            
            {getFieldValue(formData, 'ambientTemp', 'ambient_temp') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Ambient Temp</div>
                <div className="font-medium">
                  {getFieldValue(formData, 'ambientTemp', 'ambient_temp')} °F
                </div>
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
              onClick={handleDeleteClick}
            >
              Delete Patch
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Patch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete Patch <strong>{patch.patchNumber || patch.id.slice(0, 8)}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete Patch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

