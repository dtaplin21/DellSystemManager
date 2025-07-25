'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Panel {
  id: string;
  shape: 'rectangle' | 'triangle';
  x: number;
  y: number;
  width: number;
  length: number;
  rotation: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rollNumber: string;
  panelNumber: string;
}

interface EditPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: Panel | null;
  onSave: (updatedPanel: Panel) => void;
  onDelete: (panelId: string) => void;
}

const PIXELS_PER_FOOT = 200; // 200 pixels = 1ft

export default function EditPanelDialog({ 
  open, 
  onOpenChange, 
  panel, 
  onSave, 
  onDelete 
}: EditPanelDialogProps) {
  const [formData, setFormData] = useState({
    rollNumber: '',
    panelNumber: '',
    width: '',
    length: '',
    fill: '#3b82f6',
    stroke: '#1d4ed8',
    strokeWidth: '2'
  });
  const { toast } = useToast();

  // Update form data when panel changes
  useEffect(() => {
    if (panel) {
      setFormData({
        rollNumber: panel.rollNumber || '',
        panelNumber: panel.panelNumber || '',
        width: (panel.width / PIXELS_PER_FOOT).toString(),
        length: (panel.length / PIXELS_PER_FOOT).toString(),
        fill: panel.fill || '#3b82f6',
        stroke: panel.stroke || '#1d4ed8',
        strokeWidth: panel.strokeWidth ? panel.strokeWidth.toString() : '2'
      });
    }
  }, [panel]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!panel) return;

    // Validate form
    if (!formData.rollNumber || !formData.panelNumber) {
      toast({
        title: 'Validation Error',
        description: 'Please enter both Roll Number and Panel Number',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.width || !formData.length) {
      toast({
        title: 'Validation Error',
        description: 'Please enter both Width and Length',
        variant: 'destructive',
      });
      return;
    }

    const width = parseFloat(formData.width);
    const length = parseFloat(formData.length);
    const strokeWidth = parseFloat(formData.strokeWidth);

    if (isNaN(width) || isNaN(length) || width <= 0 || length <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Width and Length must be positive numbers',
        variant: 'destructive',
      });
      return;
    }

    // Create updated panel
    const updatedPanel: Panel = {
      ...panel,
      rollNumber: formData.rollNumber,
      panelNumber: formData.panelNumber,
      width: width * PIXELS_PER_FOOT,
      length: length * PIXELS_PER_FOOT,
      fill: formData.fill,
      stroke: formData.stroke,
      strokeWidth: strokeWidth,
    };

    onSave(updatedPanel);
    onOpenChange(false);
    
    toast({
      title: 'Success',
      description: 'Panel updated successfully',
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!panel) return;
    
    if (confirm('Are you sure you want to delete this panel? This action cannot be undone.')) {
      onDelete(panel.id);
      onOpenChange(false);
      
      toast({
        title: 'Success',
        description: 'Panel deleted successfully',
      });
    }
  };

  if (!panel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Panel</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rollNumber">Roll Number</Label>
              <Input
                id="rollNumber"
                name="rollNumber"
                value={formData.rollNumber}
                onChange={handleInputChange}
                placeholder="Enter roll number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="panelNumber">Panel Number</Label>
              <Input
                id="panelNumber"
                name="panelNumber"
                value={formData.panelNumber}
                onChange={handleInputChange}
                placeholder="Enter panel number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width">Width (ft)</Label>
              <Input
                id="width"
                name="width"
                type="number"
                value={formData.width}
                onChange={handleInputChange}
                placeholder="Width in feet"
                min="0"
                step="0.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="length">Length (ft)</Label>
              <Input
                id="length"
                name="length"
                type="number"
                value={formData.length}
                onChange={handleInputChange}
                placeholder="Length in feet"
                min="0"
                step="0.1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fill">Fill Color</Label>
              <Input
                id="fill"
                name="fill"
                type="color"
                value={formData.fill}
                onChange={handleInputChange}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stroke">Stroke Color</Label>
              <Input
                id="stroke"
                name="stroke"
                type="color"
                value={formData.stroke}
                onChange={handleInputChange}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="strokeWidth">Stroke Width</Label>
              <Input
                id="strokeWidth"
                name="strokeWidth"
                type="number"
                value={formData.strokeWidth}
                onChange={handleInputChange}
                min="0"
                max="10"
                step="0.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Panel Type</Label>
            <div className="text-sm text-gray-500 capitalize">
              {panel.shape}
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            className="flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete Panel</span>
          </Button>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 