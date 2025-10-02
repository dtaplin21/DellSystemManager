'use client';

import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Upload, Plus, Database, BarChart3, Filter } from 'lucide-react';
import { makeAuthenticatedRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { AsbuiltDomain } from '@/types/asbuilt';
import ExcelImportModal from '@/components/panel-layout/excel-import-modal';
import ManualEntryModal from '@/components/panel-layout/manual-entry-modal';
import { useProjects } from '@/contexts/ProjectsProvider';

interface AsbuiltSummary {
  domain: string;
  totalRecords: number;
  reviewRequired: number;
  averageConfidence: number;
  validationScore: number;
}

const AsbuiltPage: React.FC = () => {
  const [projectId, setProjectId] = useState<string>('');
  const [selectedDomain, setSelectedDomain] = useState<AsbuiltDomain>('panel_placement');
  const [summaryData, setSummaryData] = useState<AsbuiltSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add projects context
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects();

  // Domain options
  const domainOptions = [
    { value: 'panel_placement', label: 'Panel Placement', color: 'bg-blue-100 text-blue-800' },
    { value: 'panel_seaming', label: 'Panel Seaming', color: 'bg-green-100 text-green-800' },
    { value: 'non_destructive', label: 'Non-Destructive Testing', color: 'bg-purple-100 text-purple-800' },
    { value: 'trial_weld', label: 'Trial Weld', color: 'bg-orange-100 text-orange-800' },
    { value: 'repairs', label: 'Repairs', color: 'bg-red-100 text-red-800' },
    { value: 'destructive', label: 'Destructive Testing', color: 'bg-gray-100 text-gray-800' }
  ];

  // Fetch real as-built data from API
  useEffect(() => {
    const fetchAsbuiltSummary = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const response = await makeAuthenticatedRequest(`/api/asbuilt/${projectId}/summary`);
        if (response.ok) {
          const data = await response.json();
          // Ensure data is an array
          setSummaryData(Array.isArray(data) ? data : []);
        } else {
          console.error('Failed to fetch as-built summary');
          setSummaryData([]);
        }
      } catch (error) {
        console.error('Error fetching as-built summary:', error);
        setSummaryData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAsbuiltSummary();
  }, [projectId]);

  // Handle import completion
  const handleImportComplete = () => {
    console.log('Import completed, refreshing data...');
    // Refresh summary data
    if (projectId) {
      const fetchAsbuiltSummary = async () => {
        try {
          setLoading(true);
          const response = await makeAuthenticatedRequest(`/api/asbuilt/${projectId}/summary`);
          if (response.ok) {
            const data = await response.json();
            // Ensure data is an array
            setSummaryData(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error('Error refreshing as-built summary:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchAsbuiltSummary();
    }
  };

  // Handle manual entry completion
  const handleManualEntryComplete = () => {
    console.log('Manual entry completed, refreshing data...');
    // Refresh summary data
    if (projectId) {
      const fetchAsbuiltSummary = async () => {
        try {
          setLoading(true);
          const response = await makeAuthenticatedRequest(`/api/asbuilt/${projectId}/summary`);
          if (response.ok) {
            const data = await response.json();
            // Ensure data is an array
            setSummaryData(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error('Error refreshing as-built summary:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchAsbuiltSummary();
    }
  };

  // Get domain display info
  const getDomainInfo = (domain: string) => {
    return domainOptions.find(d => d.value === domain) || domainOptions[0];
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  // Filter summary data
  const filteredSummary = Array.isArray(summaryData) 
    ? summaryData.filter(item => 
        getDomainInfo(item.domain).label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">As-built Information</h1>
          <p className="text-gray-600 mt-2">
            Manage and import as-built data for all project panels
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Import Excel
          </Button>
          <Button
            onClick={() => setShowManualEntryModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Manual Entry
          </Button>
        </div>
      </div>

      {/* Project Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Project Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-select">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projectsLoading ? (
                    <SelectItem value="loading" disabled>Loading projects...</SelectItem>
                  ) : projectsError ? (
                    <SelectItem value="error" disabled>Error loading projects</SelectItem>
                  ) : projects.length === 0 ? (
                    <SelectItem value="no-projects" disabled>No projects found</SelectItem>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain-filter">Domain Filter</Label>
              <Select value={selectedDomain} onValueChange={(value) => setSelectedDomain(value as AsbuiltDomain)}>
                <SelectTrigger>
                  <SelectValue placeholder="All domains" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Domains</SelectItem>
                  {domainOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Domains</Label>
              <Input
                id="search"
                placeholder="Search by domain name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSummary.map((item) => {
          const domainInfo = getDomainInfo(item.domain);
          
          return (
            <Card key={item.domain} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-full ${domainInfo.color}`}>
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <Badge variant="outline">
                    {item.totalRecords} records
                  </Badge>
                </div>
                <CardTitle className="text-lg">{domainInfo.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Review Required</p>
                    <p className="font-medium">{item.reviewRequired}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">AI Confidence</p>
                    <p className="font-medium">{formatPercentage(item.averageConfidence)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Validation Score</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${item.validationScore * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{formatPercentage(item.validationScore)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    View Records
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Import Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Loading project data...
                  </TableCell>
                </TableRow>
              ) : !projectId ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    Select a project to view as-built data
                  </TableCell>
                </TableRow>
              ) : filteredSummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No as-built data found for this project
                  </TableCell>
                </TableRow>
              ) : (
                filteredSummary.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{getDomainInfo(item.domain).label}</TableCell>
                    <TableCell>Excel Import</TableCell>
                    <TableCell>{item.totalRecords} records</TableCell>
                    <TableCell>
                      {item.reviewRequired > 0 ? (
                        <Badge variant="destructive">Review Required</Badge>
                      ) : (
                        <Badge variant="secondary">Completed</Badge>
                      )}
                    </TableCell>
                    <TableCell>Recently imported</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={projectId || 'default'}
        panelId="all"
        onImportComplete={handleImportComplete}
      />

      <ManualEntryModal
        isOpen={showManualEntryModal}
        onClose={() => setShowManualEntryModal(false)}
        projectId={projectId || 'default'}
        panelId="all"
        onEntryComplete={handleManualEntryComplete}
      />
    </div>
  );
};

export default AsbuiltPage;
