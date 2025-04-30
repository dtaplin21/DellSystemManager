'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addQCData } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface QCFormProps {
  projectId: string;
  onSubmit: (qcData: any) => void;
}

export default function QCForm({ projectId, onSubmit }: QCFormProps) {
  const [formData, setFormData] = useState({
    type: 'destructive',
    panelId: '',
    date: new Date().toISOString().split('T')[0],
    result: '',
    technician: '',
    temperature: '',
    pressure: '',
    speed: '',
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.panelId || !formData.date || !formData.result) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Format data for submission
      const qcData = {
        ...formData,
        projectId,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        pressure: formData.pressure ? parseFloat(formData.pressure) : undefined,
        speed: formData.speed ? parseFloat(formData.speed) : undefined,
      };
      
      const result = await addQCData(projectId, qcData);
      
      toast({
        title: 'Success',
        description: 'QC data added successfully',
      });
      
      // Reset form
      setFormData({
        type: 'destructive',
        panelId: '',
        date: new Date().toISOString().split('T')[0],
        result: '',
        technician: '',
        temperature: '',
        pressure: '',
        speed: '',
        notes: '',
      });
      
      onSubmit(result);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add QC data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="type">
            Test Type*
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleInputChange as any}
            disabled={isLoading}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="destructive">Destructive Test</option>
            <option value="trial">Trial Weld</option>
            <option value="repair">Repair Test</option>
            <option value="placement">Panel Placement</option>
            <option value="seaming">Panel Seaming</option>
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="panelId">
            Panel ID*
          </label>
          <Input
            id="panelId"
            name="panelId"
            placeholder="Enter panel ID"
            value={formData.panelId}
            onChange={handleInputChange}
            disabled={isLoading}
            required
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="date">
            Test Date*
          </label>
          <Input
            id="date"
            name="date"
            type="date"
            value={formData.date}
            onChange={handleInputChange}
            disabled={isLoading}
            required
            className="date-input"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="result">
            Result*
          </label>
          <select
            id="result"
            name="result"
            value={formData.result}
            onChange={handleInputChange as any}
            disabled={isLoading}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select result</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="technician">
            Technician
          </label>
          <Input
            id="technician"
            name="technician"
            placeholder="Enter technician name"
            value={formData.technician}
            onChange={handleInputChange}
            disabled={isLoading}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="temperature">
            Temperature (°F)
          </label>
          <Input
            id="temperature"
            name="temperature"
            type="number"
            placeholder="Enter temperature"
            value={formData.temperature}
            onChange={handleInputChange}
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="pressure">
            Pressure (psi)
          </label>
          <Input
            id="pressure"
            name="pressure"
            type="number"
            placeholder="Enter pressure"
            value={formData.pressure}
            onChange={handleInputChange}
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="speed">
            Speed (ft/min)
          </label>
          <Input
            id="speed"
            name="speed"
            type="number"
            placeholder="Enter speed"
            value={formData.speed}
            onChange={handleInputChange}
            disabled={isLoading}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          placeholder="Enter additional notes"
          value={formData.notes}
          onChange={handleInputChange}
          disabled={isLoading}
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      
      <div className="pt-2 flex justify-end">
        <Button 
          type="submit" 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"></span>
              Submitting...
            </>
          ) : (
            'Submit QC Data'
          )}
        </Button>
      </div>
    </form>
  );
}
