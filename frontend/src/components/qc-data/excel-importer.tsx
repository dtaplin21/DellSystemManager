'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { importQCDataFromExcel } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize } from '@/lib/utils';

interface ExcelImporterProps {
  projectId: string;
  onImportComplete: (qcData: any[]) => void;
}

export default function ExcelImporter({ projectId, onImportComplete }: ExcelImporterProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [mappingOptions, setMappingOptions] = useState({
    hasHeaderRow: true,
    typeColumn: '',
    panelIdColumn: '',
    dateColumn: '',
    resultColumn: '',
    technicianColumn: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Check if the file is an Excel file
      if (
        !file.name.endsWith('.xlsx') &&
        !file.name.endsWith('.xls') &&
        !file.name.endsWith('.csv')
      ) {
        toast({
          title: 'Invalid File',
          description: 'Please select an Excel or CSV file.',
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleMappingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setMappingOptions(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select an Excel file to import.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsImporting(true);
      setImportProgress(0);

      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('hasHeaderRow', String(mappingOptions.hasHeaderRow));
      
      // Add column mappings to form data
      Object.entries(mappingOptions).forEach(([key, value]) => {
        if (key !== 'hasHeaderRow' && value) {
          formData.append(key, String(value));
        }
      });

      // Use a custom XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/qc-data/${projectId}/import`, true);
      
      // Add auth cookies
      xhr.withCredentials = true;

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setImportProgress(percentComplete);
        }
      });

      // Handle response
      xhr.onload = function() {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setSelectedFile(null);
          setImportProgress(0);
          
          if (response.data.length === 0) {
            toast({
              title: 'No Data Imported',
              description: 'No valid QC data records were found in the Excel file.',
              variant: 'destructive',
            });
          } else {
            onImportComplete(response.data);
            toast({
              title: 'Import Successful',
              description: `${response.data.length} QC records imported successfully.`,
            });
          }
        } else {
          let errorMessage = 'Import failed';
          try {
            const response = JSON.parse(xhr.responseText);
            errorMessage = response.message || errorMessage;
          } catch (e) {
            // Ignore JSON parse error
          }
          toast({
            title: 'Import Failed',
            description: errorMessage,
            variant: 'destructive',
          });
        }
        setIsImporting(false);
      };

      xhr.onerror = function() {
        toast({
          title: 'Import Failed',
          description: 'Network error occurred. Please try again.',
          variant: 'destructive',
        });
        setIsImporting(false);
      };

      // Send the request
      xhr.send(formData);
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div 
        className="document-drop-area cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 mb-4">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <h3 className="text-lg font-semibold">Select Excel File</h3>
        <p className="text-sm text-gray-500 mt-1">
          Select an Excel file (.xlsx, .xls) or CSV file containing QC data
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".xlsx,.xls,.csv"
        />
      </div>

      {selectedFile && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-md">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 mr-2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <line x1="10" y1="9" x2="8" y2="9"></line>
              </svg>
              <div className="ml-2">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setSelectedFile(null)}
                disabled={isImporting}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </Button>
            </div>
          </div>

          <div className="space-y-4 border p-4 rounded-md">
            <h3 className="font-medium">Column Mapping</h3>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="hasHeaderRow"
                name="hasHeaderRow"
                checked={mappingOptions.hasHeaderRow}
                onChange={handleMappingChange}
                className="rounded text-blue-600 mr-2"
              />
              <label htmlFor="hasHeaderRow" className="text-sm">
                File has header row
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type Column</label>
                <input
                  type="text"
                  name="typeColumn"
                  placeholder="e.g., A or Type"
                  value={mappingOptions.typeColumn}
                  onChange={handleMappingChange}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Panel ID Column*</label>
                <input
                  type="text"
                  name="panelIdColumn"
                  placeholder="e.g., B or ID"
                  value={mappingOptions.panelIdColumn}
                  onChange={handleMappingChange}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Column*</label>
                <input
                  type="text"
                  name="dateColumn"
                  placeholder="e.g., C or Date"
                  value={mappingOptions.dateColumn}
                  onChange={handleMappingChange}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Result Column*</label>
                <input
                  type="text"
                  name="resultColumn"
                  placeholder="e.g., D or Result"
                  value={mappingOptions.resultColumn}
                  onChange={handleMappingChange}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Technician Column</label>
                <input
                  type="text"
                  name="technicianColumn"
                  placeholder="e.g., E or Technician"
                  value={mappingOptions.technicianColumn}
                  onChange={handleMappingChange}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>
          
          {isImporting && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 text-center">{importProgress}% Complete</p>
            </div>
          )}
          
          <div className="flex justify-end">
            <Button 
              onClick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Import QC Data'}
            </Button>
          </div>
        </div>
      )}
      
      <div className="p-4 bg-gray-50 rounded-md">
        <h4 className="text-sm font-medium mb-2">Tips for Successful Import</h4>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Use consistent column formats (e.g., dates as MM/DD/YYYY)</li>
          <li>Ensure the file contains at least Panel ID, Date, and Result columns</li>
          <li>For Type, use values like &quot;destructive&quot;, &quot;trial&quot;, &quot;repair&quot;, etc.</li>
          <li>For Result, use values like &quot;pass&quot;, &quot;fail&quot;, or &quot;pending&quot;</li>
        </ul>
      </div>
    </div>
  );
}
