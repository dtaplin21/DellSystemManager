'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Save, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { AsbuiltDomain } from '@/types/asbuilt';
import { getSupabaseClient } from '@/lib/supabase';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  panelId: string;
  onEntryComplete: () => void;
}

interface FormData {
  [key: string]: string | number | null;
}

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  isOpen,
  onClose,
  projectId,
  panelId,
  onEntryComplete
}) => {
  const [selectedDomain, setSelectedDomain] = useState<AsbuiltDomain>('panel_placement');
  const [formData, setFormData] = useState<FormData>({});
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

  // Field configurations for each domain
  const getFieldConfig = (domain: AsbuiltDomain) => {
    const configs = {
      panel_placement: [
        { key: 'dateTime', label: 'Date & Time', type: 'datetime-local', required: true },
        { key: 'panelNumber', label: 'Panel Number', type: 'text', required: true },
        { key: 'locationNote', label: 'Location Note', type: 'textarea', required: false },
        { key: 'weatherComments', label: 'Weather Comments', type: 'textarea', required: false }
      ],
      panel_seaming: [
        { key: 'dateTime', label: 'Date & Time', type: 'datetime-local', required: true },
        { key: 'panelNumbers', label: 'Panel Numbers', type: 'text', required: true },
        { key: 'seamLength', label: 'Seam Length (ft)', type: 'number', required: false },
        { key: 'seamerInitials', label: 'Seamer Initials', type: 'text', required: true },
        { key: 'machineNumber', label: 'Machine Number', type: 'text', required: false },
        { key: 'wedgeTemp', label: 'Wedge Temperature (°F)', type: 'number', required: false },
        { key: 'nipRollerSpeed', label: 'Nip Roller Speed', type: 'text', required: false },
        { key: 'barrelTemp', label: 'Barrel Temperature (°F)', type: 'number', required: false },
        { key: 'preheatTemp', label: 'Preheat Temperature (°F)', type: 'number', required: false },
        { key: 'trackPeelInside', label: 'Track Peel Inside', type: 'number', required: false },
        { key: 'trackPeelOutside', label: 'Track Peel Outside', type: 'number', required: false },
        { key: 'tensileLbsPerIn', label: 'Tensile (lbs/in)', type: 'number', required: false },
        { key: 'tensileRate', label: 'Tensile Rate', type: 'text', required: false },
        { key: 'vboxPassFail', label: 'VBox Result', type: 'select', required: true, options: ['Pass', 'Fail', 'N/A'] },
        { key: 'weatherComments', label: 'Weather Comments', type: 'textarea', required: false }
      ],
      non_destructive: [
        { key: 'dateTime', label: 'Date & Time', type: 'datetime-local', required: true },
        { key: 'panelNumbers', label: 'Panel Numbers', type: 'text', required: true },
        { key: 'operatorInitials', label: 'Operator Initials', type: 'text', required: true },
        { key: 'vboxPassFail', label: 'VBox Result', type: 'select', required: true, options: ['Pass', 'Fail'] },
        { key: 'notes', label: 'Notes', type: 'textarea', required: false }
      ],
      trial_weld: [
        { key: 'dateTime', label: 'Date & Time', type: 'datetime-local', required: true },
        { key: 'seamerInitials', label: 'Seamer Initials', type: 'text', required: true },
        { key: 'machineNumber', label: 'Machine Number', type: 'text', required: false },
        { key: 'wedgeTemp', label: 'Wedge Temperature (°F)', type: 'number', required: false },
        { key: 'nipRollerSpeed', label: 'Nip Roller Speed', type: 'text', required: false },
        { key: 'barrelTemp', label: 'Barrel Temperature (°F)', type: 'number', required: false },
        { key: 'preheatTemp', label: 'Preheat Temperature (°F)', type: 'number', required: false },
        { key: 'trackPeelInside', label: 'Track Peel Inside', type: 'number', required: false },
        { key: 'trackPeelOutside', label: 'Track Peel Outside', type: 'number', required: false },
        { key: 'tensileLbsPerIn', label: 'Tensile (lbs/in)', type: 'number', required: false },
        { key: 'tensileRate', label: 'Tensile Rate', type: 'text', required: false },
        { key: 'passFail', label: 'Result', type: 'select', required: true, options: ['Pass', 'Fail'] },
        { key: 'ambientTemp', label: 'Ambient Temperature (°F)', type: 'number', required: false },
        { key: 'comments', label: 'Comments', type: 'textarea', required: false }
      ],
      repairs: [
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'repairId', label: 'Repair ID', type: 'text', required: true },
        { key: 'panelNumbers', label: 'Panel Numbers', type: 'text', required: true },
        { key: 'extruderNumber', label: 'Extruder Number', type: 'text', required: false },
        { key: 'operatorInitials', label: 'Operator Initials', type: 'text', required: false },
        { key: 'typeDetailLocation', label: 'Type/Detail/Location', type: 'textarea', required: false },
        { key: 'vboxPassFail', label: 'VBox Result', type: 'select', required: false, options: ['Pass', 'Fail'] }
      ],
      destructive: [
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'panelNumbers', label: 'Panel Numbers', type: 'text', required: true },
        { key: 'sampleId', label: 'Sample ID', type: 'text', required: true },
        { key: 'testerInitials', label: 'Tester Initials', type: 'text', required: false },
        { key: 'machineNumber', label: 'Machine Number', type: 'text', required: false },
        { key: 'trackPeelInside', label: 'Track Peel Inside', type: 'number', required: false },
        { key: 'trackPeelOutside', label: 'Track Peel Outside', type: 'number', required: false },
        { key: 'tensileLbsPerIn', label: 'Tensile (lbs/in)', type: 'number', required: false },
        { key: 'tensileRate', label: 'Tensile Rate', type: 'text', required: false },
        { key: 'passFail', label: 'Result', type: 'select', required: true, options: ['Pass', 'Fail'] },
        { key: 'comments', label: 'Comments', type: 'textarea', required: false }
      ]
    };

    return configs[domain] || [];
  };

  // Handle domain change
  const handleDomainChange = useCallback((value: string) => {
    setSelectedDomain(value as AsbuiltDomain);
    setFormData({}); // Reset form when domain changes
    setError(null);
  }, []);

  // Handle form field change
  const handleFieldChange = useCallback((key: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [key]: value === '' ? null : value
    }));
  }, []);

  // Validate form data
  const validateForm = useCallback(() => {
    const fields = getFieldConfig(selectedDomain);
    const errors: string[] = [];

    fields.forEach(field => {
      if (field.required && (!formData[field.key] || formData[field.key] === '')) {
        errors.push(`${field.label} is required`);
      }
    });

    return errors;
  }, [selectedDomain, formData]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      setError(errors.join(', '));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get the current Supabase session
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No authentication token found. Please log in.');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003'}/api/asbuilt/manual`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          panelId,
          domain: selectedDomain,
          data: formData
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create record: ${response.statusText}`);
      }

      // Reset form and close modal
      setFormData({});
      setError(null);
      onEntryComplete();
      onClose();
    } catch (err) {
      console.error('Manual entry error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create record');
    } finally {
      setLoading(false);
    }
  }, [projectId, panelId, selectedDomain, formData, validateForm, onEntryComplete, onClose]);

  // Reset modal state
  const handleClose = useCallback(() => {
    setFormData({});
    setError(null);
    onClose();
  }, [onClose]);

  // Render form field
  const renderField = (field: any) => {
    const { key, label, type, required, options } = field;
    const value = formData[key] || '';

    switch (type) {
      case 'select':
        return (
          <Select value={value as string} onValueChange={(val) => handleFieldChange(key, val)}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options?.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'textarea':
        return (
          <Textarea
            placeholder={`Enter ${label.toLowerCase()}`}
            value={value as string}
            onChange={(e) => handleFieldChange(key, e.target.value)}
            rows={3}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            placeholder={`Enter ${label.toLowerCase()}`}
            value={value as string}
            onChange={(e) => handleFieldChange(key, parseFloat(e.target.value) || 0)}
            step="any"
          />
        );

      case 'datetime-local':
        return (
          <Input
            type="datetime-local"
            value={value as string}
            onChange={(e) => handleFieldChange(key, e.target.value)}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value as string}
            onChange={(e) => handleFieldChange(key, e.target.value)}
          />
        );

      default:
        return (
          <Input
            type="text"
            placeholder={`Enter ${label.toLowerCase()}`}
            value={value as string}
            onChange={(e) => handleFieldChange(key, e.target.value)}
          />
        );
    }
  };

  // Render form
  const renderForm = () => {
    const fields = getFieldConfig(selectedDomain);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key} className="flex items-center gap-2">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </Label>
              {renderField(field)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Manual Entry - {domainOptions.find(d => d.value === selectedDomain)?.label}
          </DialogTitle>
          <DialogDescription>
            Create a new as-built record for panel P-{panelId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Domain Selection */}
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

          {/* Form Fields */}
          {renderForm()}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 inline mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualEntryModal;
