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
  Plus,
  Pencil,
  FolderOpen
} from "lucide-react";
import { generateId } from '@/lib/utils';
import ProjectSelector from '@/components/projects/project-selector';

// Constants for scaling
const PIXELS_PER_FOOT = 200; // 100 pixels = 0.5ft, so 200 pixels = 1ft
const MIN_SCALE = 0.1; // More intuitive minimum scale
const ZOOM_STEP = 0.1; // Larger step for better control
const MAX_SCALE = 3.0; // More intuitive maximum scale

interface ControlToolbarProps {
  scale: number;
  onScaleChange: (scale: number) => void;
  onAddPanel: (panel: any) => void;
  selectedPanel?: any;
  onEditPanel?: (panel: any) => void;
  onProjectLoad?: (project: any) => void;
  currentProject?: any;
  onZoomToFit?: () => void;
  onResetView?: () => void;
}

// Utility function to generate pastel colors
function generatePastelColor() {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, 70%, 80%)`
}

export default function ControlToolbar({ 
  scale, 
  onScaleChange,
  onAddPanel,
  selectedPanel,
  onEditPanel,
  onProjectLoad,
  currentProject,
  onZoomToFit,
  onResetView
}: ControlToolbarProps) {
  const [panelForm, setPanelForm] = useState({
    label: '',
    width: '',
    height: '',
    rollNumber: '',
    panelNumber: '',
  });
  const [showProjectSelector, setShowProjectSelector] = useState(false);

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
    if (onResetView) {
      onResetView();
    } else {
      handleScaleChange(1.0); // Reset to default scale
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPanelForm(prev => ({ 
      ...prev, 
      [name]: value
    }));
  };

  const validateForm = () => {
    console.log('🔍 [ControlToolbar] validateForm called with:', panelForm);
    if (!panelForm.rollNumber || !panelForm.panelNumber) {
      console.log('❌ [ControlToolbar] Validation failed: Missing roll number or panel number');
      alert('Please enter both Roll Number and Panel Number');
      return false;
    }
    if (!panelForm.width || !panelForm.height) {
      console.log('❌ [ControlToolbar] Validation failed: Missing width or height');
      alert('Please enter both Width and Height in feet');
      return false;
    }
    const width = parseFloat(panelForm.width);
    const height = parseFloat(panelForm.height);
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      console.log('❌ [ControlToolbar] Validation failed: Invalid width or height values:', { width, height });
      alert('Width and Height must be positive numbers');
      return false;
    }
    console.log('✅ [ControlToolbar] Form validation passed:', { width, height });
    return true;
  };

  const handleAddRectangle = () => {
    console.log('🔍 [ControlToolbar] handleAddRectangle called');
    console.log('🔍 [ControlToolbar] Current panelForm:', panelForm);
    
    if (!validateForm()) {
      console.log('❌ [ControlToolbar] Form validation failed, returning early');
      return;
    }

    console.log('🔍 [ControlToolbar] Creating new panel...');
    const color = generatePastelColor();
    console.log('🔍 [ControlToolbar] Generated color:', color);
    
    const newPanel = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      panelNumber: panelForm.panelNumber,
      length: parseFloat(panelForm.height),
      width: parseFloat(panelForm.width),
      rollNumber: panelForm.rollNumber,
      location: '',
      x: 100,
      y: 100,
      shape: 'rectangle',
      rotation: 0,
      fill: color,
      color: color
    };
    
    console.log('🔍 [ControlToolbar] New panel created:', newPanel);
    console.log('🔍 [ControlToolbar] Calling onAddPanel with:', newPanel);
    console.log('🔍 [ControlToolbar] onAddPanel function type:', typeof onAddPanel);
    
    onAddPanel(newPanel);
    
    console.log('🔍 [ControlToolbar] onAddPanel called successfully');
    
    // Reset form after adding panel
    setPanelForm({
      label: '',
      width: '',
      height: '',
      rollNumber: '',
      panelNumber: '',
    });
    
    console.log('🔍 [ControlToolbar] Form reset completed');
  };

  const handleAddTriangle = () => {
    if (!validateForm()) return;

    const color = generatePastelColor();
    const newPanel = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      panelNumber: panelForm.panelNumber,
      length: parseFloat(panelForm.height),
      width: parseFloat(panelForm.width),
      rollNumber: panelForm.rollNumber,
      location: '',
      x: 100,
      y: 100,
      shape: 'triangle',
      rotation: 0,
      fill: color,
      color: color
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

  const handleAddRightTriangle = () => {
    if (!validateForm()) return;

    const color = generatePastelColor();
    const newPanel = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      panelNumber: panelForm.panelNumber,
      length: parseFloat(panelForm.height),
      width: parseFloat(panelForm.width),
      rollNumber: panelForm.rollNumber,
      location: '',
      x: 100,
      y: 100,
      shape: 'right-triangle',
      rotation: 0,
      fill: color,
      color: color
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

  const handleEditPanel = () => {
    if (!selectedPanel) {
      alert('Please select a panel to edit');
      return;
    }
    
    if (onEditPanel) {
      onEditPanel(selectedPanel);
    }
  };

  const handleProjectSelect = (project: any) => {
    if (onProjectLoad) {
      onProjectLoad(project);
    }
  };

  return (
    <>
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
            title="Reset View"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          {onZoomToFit && (
            <Button
              variant="outline"
              size="icon"
              onClick={onZoomToFit}
              title="Zoom to Fit"
            >
              <Square className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* Project Selection Button */}
          <Button
            variant="outline"
            onClick={() => setShowProjectSelector(true)}
            className="flex items-center space-x-2"
          >
            <FolderOpen className="h-4 w-4" />
            <span>{currentProject ? currentProject.name : 'Choose Project'}</span>
          </Button>

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
            <Button
              variant="outline"
              onClick={handleAddRightTriangle}
              className="flex items-center space-x-2"
            >
              <Triangle className="h-4 w-4" />
              <span>Add Right Triangle</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleEditPanel}
              disabled={!selectedPanel}
              className="flex items-center space-x-2"
            >
              <Pencil className="h-4 w-4" />
              <span>Edit Panel</span>
            </Button>
          </div>
        </div>
      </div>

      <ProjectSelector
        isOpen={showProjectSelector}
        onClose={() => setShowProjectSelector(false)}
        onProjectSelect={handleProjectSelect}
      />
    </>
  );
}
