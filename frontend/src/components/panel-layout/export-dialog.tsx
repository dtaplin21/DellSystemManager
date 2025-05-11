'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { exportPanelLayoutToCAD } from '@/lib/api';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  layout: any;
}

export default function ExportDialog({ 
  open, 
  onOpenChange, 
  projectId,
  layout
}: ExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('dwg');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const blob = await exportPanelLayoutToCAD(projectId, exportFormat);
      if (!blob) {
        throw new Error('No data received from export');
      }
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `panel_layout_${projectId}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Export Successful',
        description: `Layout exported as ${exportFormat.toUpperCase()} file.`,
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export panel layout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export to CAD</DialogTitle>
          <DialogDescription>
            Choose your export options for panel layout
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Export Format</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <Input
                  type="radio"
                  name="format"
                  value="dwg"
                  checked={exportFormat === 'dwg'}
                  onChange={() => setExportFormat('dwg')}
                  className="h-4 w-4"
                />
                <span>DWG (AutoCAD)</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <Input
                  type="radio"
                  name="format"
                  value="dxf"
                  checked={exportFormat === 'dxf'}
                  onChange={() => setExportFormat('dxf')}
                  className="h-4 w-4"
                />
                <span>DXF</span>
              </label>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <Input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="h-4 w-4"
              />
              <span>Include panel metadata (ID, dimensions, QC status)</span>
            </label>
          </div>
          
          <div className="p-3 bg-blue-50 rounded-md text-sm text-blue-800">
            <p className="font-semibold mb-1">Export includes:</p>
            <ul className="list-disc list-inside">
              <li>{layout?.panels?.length || 0} panels</li>
              <li>Layout dimensions: {layout?.width || 0} × {layout?.height || 0} ft</li>
              <li>Last updated: {new Date(layout?.lastUpdated || Date.now()).toLocaleString()}</li>
            </ul>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"></span>
                Exporting...
              </>
            ) : (
              'Export'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
