'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from "@/components/ui/slider";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Square,
  Triangle,
  Plus
} from "lucide-react";
import { generateId } from '@/lib/utils';

// Constants for scaling
const PIXELS_PER_FOOT = 200; // 100 pixels = 0.5ft, so 200 pixels = 1ft
const MIN_SCALE = 0.0005; // Reduced minimum scale
const ZOOM_STEP = 0.0005; // Smaller step for finer control
const MAX_SCALE = 0.05; // Reduced maximum scale

interface ControlToolbarProps {
  scale: number;
  onScaleChange: (scale: number) => void;
  onAddPanel: (panel: any) => void;
}

export default function ControlToolbar({ 
  scale, 
  onScaleChange,
  onAddPanel
}: ControlToolbarProps) {
  const [panelForm, setPanelForm] = useState({
    label: '',
    width: '',
    height: '',
    rollNumber: '',
    panelNumber: '',
  });

  const handleScaleChange = (newScale: number) => {
    console.log('Scale change requested:', newScale);
    // Ensure scale stays within bounds
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    console.log('Clamped scale:', clampedScale);
    onScaleChange(clampedScale);
  };

  const handleZoomIn = () => {
    console.log('Zoom in clicked, current scale:', scale);
    const newScale = scale + ZOOM_STEP;
    handleScaleChange(newScale);
  };

  const handleZoomOut = () => {
    console.log('Zoom out clicked, current scale:', scale);
    const newScale = scale - ZOOM_STEP;
    handleScaleChange(newScale);
  };

  const handleResetZoom = () => {
    console.log('Reset zoom clicked');
    handleScaleChange(0.0005); // Reset to default scale
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPanelForm(prev => ({ 
      ...prev, 
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!panelForm.rollNumber || !panelForm.panelNumber) {
      alert('Please enter both Roll Number and Panel Number');
      return false;
    }
    if (!panelForm.width || !panelForm.height) {
      alert('Please enter both Width and Height in feet');
      return false;
    }
    const width = parseFloat(panelForm.width);
    const height = parseFloat(panelForm.height);
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      alert('Width and Height must be positive numbers');
      return false;
    }
    return true;
  };

  const handleAddRectangle = () => {
    if (!validateForm()) return;

    const width = parseFloat(panelForm.width);
    const height = parseFloat(panelForm.height);
    
    const newPanel = {
      id: generateId(),
      type: 'rectangle',
      x: 100,
      y: 100,
      width: width * PIXELS_PER_FOOT,
      height: height * PIXELS_PER_FOOT,
      rotation: 0,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      rollNumber: panelForm.rollNumber,
      panelNumber: panelForm.panelNumber,
      widthFeet: width,
      heightFeet: height,
    };

    onAddPanel(newPanel);
    
    // Reset form after adding panel
    setPanelForm({
      label: '',
      width: '',
      height: '',
      rollNumber: '',
      panelNumber: '',
    });
  };

  const handleAddTriangle = () => {
    if (!validateForm()) return;

    const width = parseFloat(panelForm.width);
    const height = parseFloat(panelForm.height);
    
    const newPanel = {
      id: generateId(),
      type: 'triangle',
      x: 100,
      y: 100,
      width: width * PIXELS_PER_FOOT,
      height: height * PIXELS_PER_FOOT,
      rotation: 0,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      rollNumber: panelForm.rollNumber,
      panelNumber: panelForm.panelNumber,
      widthFeet: width,
      heightFeet: height,
    };

    onAddPanel(newPanel);
    
    // Reset form after adding panel
    setPanelForm({
      label: '',
      width: '',
      height: '',
      rollNumber: '',
      panelNumber: '',
    });
  };

  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={scale <= MIN_SCALE}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Slider
            value={[scale]}
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={ZOOM_STEP}
            onValueChange={([value]) => {
              console.log('Slider value changed:', value);
              handleScaleChange(value);
            }}
            className="w-[100px]"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={scale >= MAX_SCALE}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={handleResetZoom}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            name="rollNumber"
            value={panelForm.rollNumber}
            onChange={handleInputChange}
            placeholder="Roll Number"
            className="w-[120px]"
            required
          />
          <Input
            type="text"
            name="panelNumber"
            value={panelForm.panelNumber}
            onChange={handleInputChange}
            placeholder="Panel Number"
            className="w-[120px]"
            required
          />
          <Input
            type="number"
            name="width"
            value={panelForm.width}
            onChange={handleInputChange}
            placeholder="Width (ft)"
            className="w-[100px]"
            required
            min="0"
            step="0.1"
          />
          <Input
            type="number"
            name="height"
            value={panelForm.height}
            onChange={handleInputChange}
            placeholder="Height (ft)"
            className="w-[100px]"
            required
            min="0"
            step="0.1"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleAddRectangle}
            className="flex items-center space-x-2"
          >
            <Square className="h-4 w-4" />
            <span>Add Rectangle</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleAddTriangle}
            className="flex items-center space-x-2"
          >
            <Triangle className="h-4 w-4" />
            <span>Add Triangle</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
