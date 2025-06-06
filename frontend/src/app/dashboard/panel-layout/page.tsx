'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';
import PanelGrid from '../../../components/panel-layout/panel-grid';
import ControlToolbar from '../../../components/panel-layout/control-toolbar';
import AutoOptimizer from '../../../components/panel-layout/auto-optimizer';
import ExportDialog from '../../../components/panel-layout/export-dialog';
import { useToast } from '../../../hooks/use-toast';

export default function PanelLayoutPage() {
  const [panels, setPanels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [siteConfig, setSiteConfig] = useState({
    width: 500,
    height: 400,
    scale: 1
  });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  const handlePanelUpdate = (updatedPanels) => {
    setPanels(updatedPanels);
  };

  const handleAutoOptimize = async (settings) => {
    try {
      setIsLoading(true);
      // Call panel optimizer service
      const response = await fetch('/api/panels/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteConfig,
          panels,
          strategy: settings.strategy || 'balanced'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setPanels(result.optimizedPanels || []);
        toast({
          title: 'Layout Optimized',
          description: 'Panel layout has been automatically optimized.'
        });
      } else {
        toast({
          title: 'Optimization Failed',
          description: 'Unable to optimize layout. Please try again.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error during optimization.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Layout Designer</h1>
          <p className="text-gray-600">Design and optimize geosynthetic panel arrangements</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setExportDialogOpen(true)} variant="outline">
            Export Layout
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Control Toolbar */}
      <ControlToolbar
        onPanelUpdate={handlePanelUpdate}
        siteConfig={siteConfig}
        onSiteConfigChange={setSiteConfig}
        isLoading={isLoading}
      />

      {/* Auto Optimizer */}
      <AutoOptimizer
        onOptimize={handleAutoOptimize}
        isLoading={isLoading}
        panelCount={panels.length}
      />

      {/* Panel Grid */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Layout Canvas</h2>
        </div>
        <div className="p-6">
          <PanelGrid
            panels={panels}
            onPanelUpdate={handlePanelUpdate}
            siteConfig={siteConfig}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-navy-900">{panels.length}</div>
          <div className="text-sm text-gray-600">Total Panels</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-orange-600">
            {panels.reduce((total, panel) => total + (panel.width * panel.height || 0), 0).toFixed(0)} ft²
          </div>
          <div className="text-sm text-gray-600">Coverage Area</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-green-600">
            {panels.length > 0 ? 
              Math.round((panels.reduce((total, panel) => total + (panel.width * panel.height || 0), 0) / (siteConfig.width * siteConfig.height)) * 100) : 0
            }%
          </div>
          <div className="text-sm text-gray-600">Site Coverage</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-purple-600">
            ${(panels.length * 150).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Est. Material Cost</div>
        </div>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        panels={panels}
        siteConfig={siteConfig}
      />
    </div>
  );
}