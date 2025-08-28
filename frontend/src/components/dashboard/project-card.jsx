'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useToast } from '@/hooks/use-toast';

/**
 * Project card component with edit functionality
 */
export default function ProjectCard({ project, onUpdate }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const { toast } = useToast();

  // Open the edit dialog
  const handleEditClick = (e) => {
    e.preventDefault();
    setEditingProject({...project});
    setDialogOpen(true);
  };

  // Handle save changes
  const handleSaveChanges = () => {
    if (!editingProject) return;
    
    // Add updated timestamp
    const updatedProject = {
      ...editingProject,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    
    // Call parent update function
    if (onUpdate) {
      onUpdate(updatedProject);
    }
    
    // Show success message
    toast({
      title: 'Project Updated',
      description: `${updatedProject.name} has been updated successfully.`,
    });
    
    // Close dialog
    setDialogOpen(false);
    setEditingProject(null);
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow border border-orange-200 bg-white p-1">
        <CardHeader className="pb-2 border-b border-orange-100">
          <CardTitle className="text-lg text-navy-800">{project.name}</CardTitle>
          <CardDescription className="text-navy-600">{project.client}</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Location:</span>
              <span className="font-medium text-navy-700">{project.location}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Last Updated:</span>
              <span className="font-medium text-navy-700">{project.lastUpdated}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-navy-500">Progress:</span>
                <span className="font-medium text-navy-700">{project.progress}%</span>
              </div>
              <div className="w-full bg-navy-100 rounded-full h-2">
                <div 
                  className="bg-orange-500 h-2 rounded-full" 
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-3 mt-2 border-t border-orange-100">
              <Link href={`/projects/${project.id}`} className="text-navy-600 hover:text-navy-800 font-medium text-sm">
                View Details
              </Link>
              <button 
                onClick={handleEditClick}
                className="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Make changes to the project details. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          
          {editingProject && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right font-medium">
                  Name
                </label>
                <input
                  id="name"
                  className="col-span-3 h-10 rounded-md border border-gray-300 px-3"
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({...editingProject, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="client" className="text-right font-medium">
                  Client
                </label>
                <input
                  id="client"
                  className="col-span-3 h-10 rounded-md border border-gray-300 px-3"
                  value={editingProject.client}
                  onChange={(e) => setEditingProject({...editingProject, client: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="location" className="text-right font-medium">
                  Location
                </label>
                <input
                  id="location"
                  className="col-span-3 h-10 rounded-md border border-gray-300 px-3"
                  value={editingProject.location}
                  onChange={(e) => setEditingProject({...editingProject, location: e.target.value})}
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
                  value={editingProject.progress}
                  onChange={(e) => setEditingProject({...editingProject, progress: parseInt(e.target.value, 10) || 0})}
                />
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setDialogOpen(false)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveChanges}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-navy-600 text-white hover:bg-navy-700"
            >
              Save Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}