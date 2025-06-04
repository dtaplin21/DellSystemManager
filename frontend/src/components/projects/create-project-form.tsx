'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export interface NewProjectData {
  name: string;
  client: string;
  location: string;
  startDate: string;
  endDate?: string;
  status: string;
  progress: number;
  description?: string;
}

export interface CreateProjectFormProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: NewProjectData) => void;
}

export default function CreateProjectForm({ open, onClose, onCreate }: CreateProjectFormProps) {
  const [form, setForm] = useState<NewProjectData>({
    name: '',
    client: '',
    location: '',
    startDate: '',
    endDate: '',
    status: 'Active',
    progress: 0,
    description: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.id]: e.target.value });
  }

  function handleSelectChange(field: string, value: string) {
    setForm({ ...form, [field]: value });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name || !form.client || !form.location) {
      return; // Required fields validation
    }
    onCreate(form);
    // Reset form
    setForm({
      name: '',
      client: '',
      location: '',
      startDate: '',
      endDate: '',
      status: 'Active',
      progress: 0,
      description: '',
    });
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">Project Name *</Label>
            <Input 
              id="name" 
              value={form.name} 
              onChange={handleChange} 
              placeholder="Enter project name"
              className="mt-1"
              required 
            />
          </div>
          
          <div>
            <Label htmlFor="client" className="text-sm font-medium text-gray-700">Client *</Label>
            <Input 
              id="client" 
              value={form.client} 
              onChange={handleChange} 
              placeholder="Enter client name"
              className="mt-1"
              required 
            />
          </div>
          
          <div>
            <Label htmlFor="location" className="text-sm font-medium text-gray-700">Location *</Label>
            <Input 
              id="location" 
              value={form.location} 
              onChange={handleChange} 
              placeholder="Enter project location"
              className="mt-1"
              required 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate" className="text-sm font-medium text-gray-700">Start Date</Label>
              <Input 
                id="startDate" 
                type="date" 
                value={form.startDate} 
                onChange={handleChange}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-sm font-medium text-gray-700">End Date</Label>
              <Input 
                id="endDate" 
                type="date" 
                value={form.endDate} 
                onChange={handleChange}
                className="mt-1"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="status" className="text-sm font-medium text-gray-700">Status</Label>
            <select 
              id="status"
              value={form.status} 
              onChange={(e) => handleSelectChange('status', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
              <option value="Delayed">Delayed</option>
            </select>
          </div>
          
          <div>
            <Label htmlFor="progress" className="text-sm font-medium text-gray-700">Initial Progress (%)</Label>
            <Input 
              id="progress" 
              type="number" 
              min="0" 
              max="100" 
              value={form.progress} 
              onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description</Label>
            <textarea 
              id="description" 
              value={form.description} 
              onChange={handleChange}
              placeholder="Enter project description (optional)"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}