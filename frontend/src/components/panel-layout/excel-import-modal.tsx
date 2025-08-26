'use client';

import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  AsbuiltDomain, 
  ImportResponse, 
  FieldMapping 
} from '@/types/asbuilt';
import { supabase } from '@/lib/supabase';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  panelId: string;
  onImportComplete: () => void;
}

interface ImportStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  projectId,
  panelId,
  onImportComplete
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<AsbuiltDomain>('panel_placement');
  const [importStep, setImportStep] = useState<ImportStep>('pending');
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Domain options
  const domainOptions = [
    { value: 'panel_placement', label: 'Panel Placement' },
    { value: 'panel_seaming', label: 'Panel Seaming' },
    { value: 'non_destructive', label: 'Non-Destructive Testing' },
    { value: 'trial_weld', label: 'Trial Weld' },
    { value: 'repairs', label: 'Repairs' },
    { value: 'destructive', label: 'Destructive Testing' }
  ];

  // Import steps
  const importSteps: ImportStep[] = [
    {
      id: 'upload',
      title: 'Upload Excel File',
      description: 'Select and upload your Excel file',
      status: 'pending'
    },
    {
      id: 'mapping',
      title: 'AI Field Mapping',
      description: 'Review AI-generated field mappings',
      status: 'pending'
    },
    {
      id: 'validation',
      title: 'Data Validation',
      description: 'Validate imported data',
      status: 'pending'
    },
    {
      id: 'import',
      title: 'Import Complete',
      description: 'Data successfully imported',
      status: 'pending'
    }
  ];

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
      ];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
        setError('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setImportStep('active');
    }
  }, []);

  // Handle file upload and AI mapping
  const handleUpload = useCallback(async () => {
    if (!selectedFile || !projectId || !panelId) return;

    setLoading(true);
    setError(null);
    setImportProgress(25);

    try {
      // Get the current Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No authentication token found. Please log in.');
      }

      const formData = new FormData();
      formData.append('excelFile', selectedFile);
      formData.append('projectId', projectId);
      formData.append('panelId', panelId);
      formData.append('domain', selectedDomain);

      const response = await fetch('http://localhost:8003/api/asbuilt/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }

      const result: ImportResponse = await response.json();
      setImportResult(result);
      setImportProgress(100);
      setImportStep('completed');

      // Trigger callback
      onImportComplete();
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Import failed');
      setImportStep('error');
    } finally {
      setLoading(false);
    }
  }, [selectedFile, projectId, panelId, selectedDomain, onImportComplete]);

  // Handle domain change
  const handleDomainChange = useCallback((value: string) => {
    setSelectedDomain(value as AsbuiltDomain);
  }, []);

  // Reset modal state
  const handleClose = useCallback(() => {
    setSelectedFile(null);
    setImportStep('pending');
    setImportProgress(0);
    setImportResult(null);
    setFieldMappings([]);
    setUnmappedHeaders([]);
    setError(null);
    onClose();
  }, [onClose]);

  // Download template
  const downloadTemplate = useCallback(() => {
    // TODO: Generate and download domain-specific template
    console.log('Download template for domain:', selectedDomain);
  }, [selectedDomain]);

  // Preview data
  const previewData = useCallback(() => {
    // TODO: Show preview of Excel data
    console.log('Preview data for file:', selectedFile?.name);
  }, [selectedFile]);

  // Render import steps
  const renderImportSteps = () => {
    return (
      <div className="space-y-4 mb-6">
        <h3 className="font-medium text-gray-900">Import Progress</h3>
        <div className="space-y-3">
          {importSteps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step.status === 'completed' ? 'bg-green-100 text-green-800' :
                step.status === 'active' ? 'bg-blue-100 text-blue-800' :
                step.status === 'error' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-600'
              }`}>
                {step.status === 'completed' ? '✓' : index + 1}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  step.status === 'completed' ? 'text-green-800' :
                  step.status === 'active' ? 'text-blue-800' :
                  step.status === 'error' ? 'text-red-800' :
                  'text-gray-600'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        {importStep === 'active' && (
          <Progress value={importProgress} className="w-full" />
        )}
      </div>
    );
  };

  // Render file upload section
  const renderFileUpload = () => {
    return (
      <div className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          {selectedFile ? (
            <div className="space-y-3">
              <FileSpreadsheet className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFile(null)}
              >
                Remove File
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="h-12 w-12 text-gray-400 mx-auto" />
              <div>
                <p className="font-medium text-gray-900">Upload Excel File</p>
                <p className="text-sm text-gray-500">
                  Drag and drop or click to select
                </p>
              </div>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <Label htmlFor="file-upload">
                <Button variant="outline" asChild>
                  <span>Select File</span>
                </Button>
              </Label>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="domain-select">Domain</Label>
          <Select value={selectedDomain} onValueChange={handleDomainChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select domain" />
            </SelectTrigger>
            <SelectContent>
              {domainOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          {selectedFile && (
            <Button
              variant="outline"
              size="sm"
              onClick={previewData}
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Data
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Render import results
  const renderImportResults = () => {
    if (!importResult) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium text-green-800">{importResult.importedRows}</p>
            <p className="text-sm text-green-600">Records Imported</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-sm font-medium text-blue-800">
                {Math.round(importResult.confidenceScore * 100)}%
              </span>
            </div>
            <p className="text-sm text-blue-600">AI Confidence</p>
          </div>
        </div>

        {importResult.unmappedHeaders.length > 0 && (
          <div className="p-4 bg-yellow-50 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">Unmapped Headers</h4>
            <div className="flex flex-wrap gap-2">
              {importResult.unmappedHeaders.map((header) => (
                <Badge key={header} variant="outline" className="text-yellow-700">
                  {header}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-yellow-600 mt-2">
              These headers couldn&apos;t be automatically mapped. Consider reviewing the data.
            </p>
          </div>
        )}

        {importResult.requiresReview && (
          <div className="p-4 bg-orange-50 rounded-lg">
            <AlertCircle className="h-5 w-5 text-orange-600 inline mr-2" />
            <span className="text-orange-800 font-medium">
              Some records require review before final approval.
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Excel Data
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file to import as-built information for panel P-{panelId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {renderImportSteps()}
          
          {importStep === 'pending' && renderFileUpload()}
          
          {importStep === 'active' && (
            <div className="space-y-4">
              {renderFileUpload()}
              <Button 
                onClick={handleUpload} 
                disabled={!selectedFile || loading}
                className="w-full"
              >
                {loading ? 'Importing...' : 'Start Import'}
              </Button>
            </div>
          )}
          
          {importStep === 'completed' && renderImportResults()}
          
          {error && (
            <div className="p-4 bg-red-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 inline mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          {importStep === 'completed' ? (
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          ) : (
            <div className="flex gap-3 w-full">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              {selectedFile && importStep === 'pending' && (
                <Button onClick={() => setImportStep('active')} className="flex-1">
                  Continue
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExcelImportModal;
