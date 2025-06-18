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
  type: 'rectangle' | 'triangle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rollNumber: string;
  panelNumber: string;
  widthFeet?: number;
  heightFeet?: number;
}

interface EditPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: Panel | null;
  onSave: (updatedPanel: Panel) => void;
}

const PIXELS_PER_FOOT = 200; // 200 pixels = 1ft

export default function EditPanelDialog({ 
  open, 
  onOpenChange, 
  panel, 
  onSave 
}: EditPanelDialogProps) {
  const [formData, setFormData] = useState({
    rollNumber: '',
    panelNumber: '',
    width: '',
    height: '',
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
        width: panel.widthFeet ? panel.widthFeet.toString() : (panel.width / PIXELS_PER_FOOT).toString(),
        height: panel.heightFeet ? panel.heightFeet.toString() : (panel.height / PIXELS_PER_FOOT).toString(),
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

    if (!formData.width || !formData.height) {
      toast({
        title: 'Validation Error',
        description: 'Please enter both Width and Height',
        variant: 'destructive',
      });
      return;
    }

    const width = parseFloat(formData.width);
    const height = parseFloat(formData.height);
    const strokeWidth = parseFloat(formData.strokeWidth);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Width and Height must be positive numbers',
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
      height: height * PIXELS_PER_FOOT,
      fill: formData.fill,
      stroke: formData.stroke,
      strokeWidth: strokeWidth,
      widthFeet: width,
      heightFeet: height,
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
              <Label htmlFor="height">Height (ft)</Label>
              <Input
                id="height"
                name="height"
                type="number"
                value={formData.height}
                onChange={handleInputChange}
                placeholder="Height in feet"
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
              {panel.type}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 