'use client';

import { useState } from 'react';
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
    width: 100,
    height: 100,
  });

  const handleScaleChange = (newScale: number) => {
    if (newScale >= 0.1 && newScale <= 5) {
      onScaleChange(newScale);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPanelForm(prev => ({ 
      ...prev, 
      [name]: name === 'label' ? value : Number(value) 
    }));
  };

  const handleAddPanel = () => {
    if (onAddPanel && panelForm.width > 0 && panelForm.height > 0) {
      onAddPanel({
        id: generateId(),
        x: 50,
        y: 50,
        width: panelForm.width,
        height: panelForm.height,
        label: panelForm.label || `Panel ${generateId().slice(0, 4)}`,
      });
      
      // Reset form
      setPanelForm({
        label: '',
        width: 100,
        height: 100,
      });
    }
  };

  const handleAddRectangle = () => {
    const newPanel = {
      id: generateId(),
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      rotation: 0,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2
    };
    onAddPanel(newPanel);
  };

  const handleAddTriangle = () => {
    const newPanel = {
      id: generateId(),
      type: 'triangle',
      x: 100,
      y: 100,
      width: 200,
      height: 173.2, // Height for equilateral triangle
      rotation: 0,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2
    };
    onAddPanel(newPanel);
  };

  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onScaleChange(Math.max(0.1, scale - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Slider
            value={[scale]}
            min={0.1}
            max={2}
            step={0.1}
            onValueChange={([value]) => onScaleChange(value)}
            className="w-[100px]"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => onScaleChange(Math.min(2, scale + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => onScaleChange(1)}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
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
  );
}
