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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { forms, isLoading } = useFormData({
    projectId,
    asbuiltRecordId: destructiveTest.asbuiltRecordId,
    panelId: destructiveTest.panelId
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

  // Extract primary form fields from the form that created this test
  const primaryForm = forms.find(f => f.id === destructiveTest.asbuiltRecordId) || forms[0];
  // Handle both camelCase and snake_case from API, and check raw_data as fallback
  const mappedData = primaryForm?.mappedData || (primaryForm as any)?.mapped_data || {};
  const rawData = (primaryForm as any)?.raw_data || {};
  const formData = { ...rawData, ...mappedData }; // Merge with raw_data as fallback

  // Extract panel numbers from ONLY the directly linked form (asbuiltRecordId)
  const panelNumbers = new Set<string>();
  
  // Only get panel numbers from the form that created this test
  if (primaryForm && primaryForm.id === destructiveTest.asbuiltRecordId) {
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
      console.error('Error deleting destructive test:', error);
      // Error will be handled by parent component or show toast notification
      setIsDeleting(false);
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
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500 text-xs mb-1">Tester/Operator</div>
              <div className="font-medium">
                {getFieldValue(formData, 'testerInitials', 'tester_initials') || 
                 getFieldValue(formData, 'operatorInitials', 'operator_initials') || 
                 'N/A'}
              </div>
            </div>

            {/* Machine Number */}
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500 text-xs mb-1">Machine Number</div>
              <div className="font-medium">
                {getFieldValue(formData, 'machineNumber', 'machine_number') || 'N/A'}
              </div>
            </div>

            {/* Extruder Number */}
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500 text-xs mb-1">Extruder Number</div>
              <div className="font-medium">
                {getFieldValue(formData, 'extruderNumber', 'extruder_number') || 'N/A'}
              </div>
            </div>

            {/* Track Peel Inside */}
            {getFieldValue(formData, 'trackPeelInside', 'track_peel_inside') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Track Peel Inside</div>
                <div className="font-medium">
                  {getFieldValue(formData, 'trackPeelInside', 'track_peel_inside')}
                </div>
              </div>
            )}

            {/* Track Peel Outside */}
            {getFieldValue(formData, 'trackPeelOutside', 'track_peel_outside') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Track Peel Outside</div>
                <div className="font-medium">
                  {getFieldValue(formData, 'trackPeelOutside', 'track_peel_outside')}
                </div>
              </div>
            )}

            {/* Track Peel Pass/Fail */}
            {getFieldValue(formData, 'trackPeelPassFail', 'track_peel_pass_fail') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Track Peel Result</div>
                <Badge 
                  className={
                    getFieldValue(formData, 'trackPeelPassFail', 'track_peel_pass_fail') === 'Pass' || 
                    getFieldValue(formData, 'trackPeelPassFail', 'track_peel_pass_fail') === 'pass'
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }
                >
                  {String(getFieldValue(formData, 'trackPeelPassFail', 'track_peel_pass_fail')).toUpperCase()}
                </Badge>
              </div>
            )}

            {/* Tensile (lbs/in) */}
            {getFieldValue(formData, 'tensileLbsPerIn', 'tensile_lbs_per_in') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Tensile (lbs/in)</div>
                <div className="font-medium">
                  {getFieldValue(formData, 'tensileLbsPerIn', 'tensile_lbs_per_in')}
                </div>
              </div>
            )}

            {/* Tensile Rate */}
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500 text-xs mb-1">Tensile Rate</div>
              <div className="font-medium">
                {getFieldValue(formData, 'tensileRate', 'tensile_rate') || 'N/A'}
              </div>
            </div>

            {/* Tensile Pass/Fail */}
            {getFieldValue(formData, 'tensilePassFail', 'tensile_pass_fail') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Tensile Result</div>
                <Badge 
                  className={
                    getFieldValue(formData, 'tensilePassFail', 'tensile_pass_fail') === 'Pass' || 
                    getFieldValue(formData, 'tensilePassFail', 'tensile_pass_fail') === 'pass'
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }
                >
                  {String(getFieldValue(formData, 'tensilePassFail', 'tensile_pass_fail')).toUpperCase()}
                </Badge>
              </div>
            )}

            {/* Overall Pass/Fail */}
            {getFieldValue(formData, 'passFail', 'pass_fail') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Overall Result</div>
                <Badge 
                  className={
                    getFieldValue(formData, 'passFail', 'pass_fail') === 'Pass' || 
                    getFieldValue(formData, 'passFail', 'pass_fail') === 'pass'
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }
                >
                  {String(getFieldValue(formData, 'passFail', 'pass_fail')).toUpperCase()}
                </Badge>
              </div>
            )}

            {/* Ambient Temp */}
            {getFieldValue(formData, 'ambientTemp', 'ambient_temp') && (
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Ambient Temp</div>
                <div className="font-medium">
                  {getFieldValue(formData, 'ambientTemp', 'ambient_temp')} °F
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500 text-xs mb-1">Comments</div>
              <div className="font-medium text-xs">
                {getFieldValue(formData, 'comments', 'comments') || 'N/A'}
              </div>
            </div>
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
              onClick={handleDeleteClick}
            >
              Delete Test
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Test</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete Test <strong>{destructiveTest.sampleId || destructiveTest.id.slice(0, 8)}</strong>? This action cannot be undone.
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
              {isDeleting ? 'Deleting...' : 'Delete Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

