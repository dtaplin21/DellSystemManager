import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import PanelLayout from '@/components/panels/PanelLayout';

export default function ResizeDemo() {
  const [activeDemo, setActiveDemo] = useState<string>('basic');

  const demos = [
    {
      id: 'basic',
      title: 'Basic Resize',
      description: 'Standard resize with grid snapping and panel-to-panel snapping',
      features: ['8 resize handles', 'Grid snapping', 'Panel snapping', 'Visual feedback']
    },
    {
      id: 'constrained',
      title: 'Constrained Resize',
      description: 'Resize with size limits and aspect ratio locking',
      features: ['Min/Max size limits', 'Aspect ratio lock', 'Constraint indicators']
    },
    {
      id: 'flexible',
      title: 'Flexible Resize',
      description: 'Advanced resize with custom constraints and real-time feedback',
      features: ['Custom constraints', 'Real-time snapping', 'Visual guides', 'Constraint validation']
    }
  ];

  const getDemoSettings = (demoId: string) => {
    switch (demoId) {
      case 'constrained':
        return {
          minWidth: 100,
          minHeight: 50,
          maxWidth: 500,
          maxHeight: 300,
          lockAspectRatio: true,
          aspectRatio: 2.5,
          snapToGrid: true,
          gridSize: 50,
          snapToOtherPanels: true,
          snapThreshold: 8,
          enableVisualFeedback: true,
          enableSnapping: true
        };
      case 'flexible':
        return {
          minWidth: 75,
          minHeight: 75,
          maxWidth: 800,
          maxHeight: 600,
          lockAspectRatio: false,
          aspectRatio: 1.5,
          snapToGrid: true,
          gridSize: 25,
          snapToOtherPanels: true,
          snapThreshold: 6,
          enableVisualFeedback: true,
          enableSnapping: true
        };
      default:
        return {
          minWidth: 50,
          minHeight: 50,
          maxWidth: 1000,
          maxHeight: 1000,
          lockAspectRatio: false,
          aspectRatio: 2.5,
          snapToGrid: true,
          gridSize: 100,
          snapToOtherPanels: true,
          snapThreshold: 4,
          enableVisualFeedback: true,
          enableSnapping: true
        };
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-white">
        <h1 className="text-2xl font-bold mb-2">Flexible Panel Resize Demo</h1>
        <p className="text-gray-600 mb-4">
          Explore different resize modes and constraints for panel layout design
        </p>
        
        {/* Demo Selector */}
        <div className="flex space-x-2">
          {demos.map(demo => (
            <Button
              key={demo.id}
              variant={activeDemo === demo.id ? 'default' : 'outline'}
              onClick={() => setActiveDemo(demo.id)}
              className="flex flex-col items-start p-3 h-auto"
            >
              <span className="font-semibold">{demo.title}</span>
              <span className="text-xs text-gray-500 mt-1">{demo.description}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Demo Info */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {demos.find(d => d.id === activeDemo)?.title}
            </h2>
            <p className="text-sm text-gray-600">
              {demos.find(d => d.id === activeDemo)?.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {demos.find(d => d.id === activeDemo)?.features.map(feature => (
              <span key={feature} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-blue-50 border-b">
        <div className="flex items-start space-x-3">
          <div className="text-blue-600 mt-1">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-sm text-blue-800">
            <strong>How to use:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Click "Add Panel" to create new panels</li>
              <li>• Click on a panel to select it</li>
              <li>• Drag the white resize handles to resize panels</li>
              <li>• Green lines show panel-to-panel snapping</li>
              <li>• Blue lines show grid snapping</li>
              <li>• Red text shows constraint violations</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <PanelLayout 
          mode="manual"
          projectInfo={{
            projectName: 'Resize Demo',
            location: 'Demo Location',
            description: 'Demo Description',
            manager: 'Demo Manager',
            material: 'Demo Material'
          }}
        />
      </div>
    </div>
  );
} 