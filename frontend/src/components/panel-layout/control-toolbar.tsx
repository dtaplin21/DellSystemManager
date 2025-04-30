'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateId } from '@/lib/utils';

interface ControlToolbarProps {
  scale: number;
  onScaleChange: (scale: number) => void;
  onAddPanel?: (panel: any) => void;
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-2">
      <div className="flex items-center space-x-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleScaleChange(scale - 0.1)}
          disabled={scale <= 0.1}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-minus">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </Button>
        
        <div className="flex items-center">
          <span className="text-sm">Zoom:</span>
          <span className="font-semibold ml-1">{Math.round(scale * 100)}%</span>
        </div>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleScaleChange(scale + 0.1)}
          disabled={scale >= 5}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-plus">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleScaleChange(1)}
        >
          Reset
        </Button>
      </div>
      
      {onAddPanel && (
        <div className="flex items-center space-x-2">
          <Input
            name="label"
            placeholder="Panel Label"
            value={panelForm.label}
            onChange={handleInputChange}
            className="w-32"
          />
          
          <Input
            name="width"
            type="number"
            placeholder="Width"
            value={panelForm.width}
            onChange={handleInputChange}
            min="50"
            className="w-20"
          />
          
          <span>×</span>
          
          <Input
            name="height"
            type="number"
            placeholder="Height"
            value={panelForm.height}
            onChange={handleInputChange}
            min="50"
            className="w-20"
          />
          
          <Button
            size="sm"
            onClick={handleAddPanel}
          >
            Add Panel
          </Button>
        </div>
      )}
      
      <div className="flex items-center space-x-2 ml-auto">
        <Button size="sm" variant="outline">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-save mr-1">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Save Layout
        </Button>
      </div>
    </div>
  );
}
