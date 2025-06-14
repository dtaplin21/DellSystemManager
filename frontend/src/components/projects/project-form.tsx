'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProject } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ProjectFormProps {
  onProjectCreated: (project: any) => void;
}

export default function ProjectForm({ onProjectCreated }: ProjectFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client: '',
    location: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    area: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.client || !formData.startDate) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Convert area to string if provided
      const projectData = {
        ...formData,
        area: formData.area?.toString() || ''
      };
      
      const newProject = await createProject(projectData);
      
      toast({
        title: 'Success',
        description: 'Project created successfully',
      });
      
      onProjectCreated(newProject);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        client: '',
        location: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        area: '',
      });
    } catch (error: any) {
      console.error('Project creation error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium bg-[#f5f8fa] px-2 py-1 rounded border border-[#dfe1e6] inline-block" htmlFor="name">
          Project Name*
        </label>
        <Input
          id="name"
          name="name"
          placeholder="Enter project name"
          value={formData.name}
          onChange={handleInputChange}
          disabled={isLoading}
          required
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium bg-[#f5f8fa] px-2 py-1 rounded border border-[#dfe1e6] inline-block" htmlFor="description">
          Description
        </label>
        <Input
          id="description"
          name="description"
          placeholder="Enter project description"
          value={formData.description}
          onChange={handleInputChange}
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium bg-[#f5f8fa] px-2 py-1 rounded border border-[#dfe1e6] inline-block" htmlFor="client">
          Client*
        </label>
        <Input
          id="client"
          name="client"
          placeholder="Enter client name"
          value={formData.client}
          onChange={handleInputChange}
          disabled={isLoading}
          required
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium bg-[#f5f8fa] px-2 py-1 rounded border border-[#dfe1e6] inline-block" htmlFor="location">
          Location
        </label>
        <Input
          id="location"
          name="location"
          placeholder="Enter project location"
          value={formData.location}
          onChange={handleInputChange}
          disabled={isLoading}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium bg-[#f5f8fa] px-2 py-1 rounded border border-[#dfe1e6] inline-block" htmlFor="startDate">
            Start Date*
          </label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            value={formData.startDate}
            onChange={handleInputChange}
            disabled={isLoading}
            required
            className="date-input"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium bg-[#f5f8fa] px-2 py-1 rounded border border-[#dfe1e6] inline-block" htmlFor="endDate">
            Expected End Date
          </label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            value={formData.endDate}
            onChange={handleInputChange}
            disabled={isLoading}
            className="date-input"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium bg-[#f5f8fa] px-2 py-1 rounded border border-[#dfe1e6] inline-block" htmlFor="area">
          Area (sq ft)
        </label>
        <Input
          id="area"
          name="area"
          type="number"
          placeholder="Enter project area in square feet"
          value={formData.area}
          onChange={handleInputChange}
          disabled={isLoading}
          min="0"
        />
      </div>
      
      <div className="pt-4 flex justify-end space-x-2">
        <Button 
          type="submit" 
          disabled={isLoading}
          className="bg-[#0052cc] hover:bg-[#003d99] text-white border-2 border-[#003d99] shadow-sm transition-all duration-200 hover:shadow transform hover:translate-y-[-1px]"
        >
          {isLoading ? (
            <>
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"></span>
              Creating...
            </>
          ) : (
            'Create Project'
          )}
        </Button>
      </div>
    </form>
  );
}
