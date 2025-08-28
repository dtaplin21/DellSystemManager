'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

/**
 * A reusable edit modal component for projects
 */
export default function ProjectEditModal({ isOpen, onClose, project, onSave }) {
  const [editedProject, setEditedProject] = useState(project || {});
  const { toast } = useToast();
  
  const handleSave = () => {
    // Add timestamp
    const updatedProject = {
      ...editedProject,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    
    // Call parent's save function
    onSave(updatedProject);
    
    // Show success message
    toast({
      title: 'Project Updated',
      description: `${updatedProject.name} has been updated successfully.`,
    });
    
    // Close the modal
    onClose();
  };
  
  // If no project, don't render
  if (!project) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Make changes to the project details. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="name" className="text-right font-medium">
              Name
            </label>
            <input
              id="name"
              className="col-span-3 h-10 rounded-md border border-gray-300 px-3"
              value={editedProject.name || ''}
              onChange={(e) => setEditedProject({...editedProject, name: e.target.value})}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="client" className="text-right font-medium">
              Client
            </label>
            <input
              id="client"
              className="col-span-3 h-10 rounded-md border border-gray-300 px-3"
              value={editedProject.client || ''}
              onChange={(e) => setEditedProject({...editedProject, client: e.target.value})}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="location" className="text-right font-medium">
              Location
            </label>
            <input
              id="location"
              className="col-span-3 h-10 rounded-md border border-gray-300 px-3"
              value={editedProject.location || ''}
              onChange={(e) => setEditedProject({...editedProject, location: e.target.value})}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="progress" className="text-right font-medium">
              Progress (%)
            </label>
            <input
              id="progress"
              type="number"
              min="0"
              max="100"
              className="col-span-3 h-10 rounded-md border border-gray-300 px-3"
              value={editedProject.progress || 0}
              onChange={(e) => setEditedProject({...editedProject, progress: parseInt(e.target.value, 10) || 0})}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-navy-600 text-white hover:bg-navy-700"
          >
            Save Changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}