'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileSpreadsheet, 
  Upload, 
  Plus, 
  Search, 
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Image,
  Trash2
} from 'lucide-react';
import { AsbuiltRecord, AsbuiltSummary, ASBUILT_DOMAINS } from '@/types/asbuilt';
import { safeAPI } from '@/lib/safe-api';
import { makeAuthenticatedRequest } from '@/lib/api';
import { useAsbuiltData } from '@/contexts/AsbuiltDataContext';
import { useProjects } from '@/contexts/ProjectsProvider';
import FileViewerModal from '@/components/shared/FileViewerModal';
import RecordViewerModal from '@/components/shared/RecordViewerModal';
import ExcelImportModal from '@/components/panel-layout/excel-import-modal';
import { FileMetadata } from '@/contexts/AsbuiltDataContext';
import { getAsbuiltRecordDetails } from '@/lib/safe-api';

export default function AsbuiltPageContent() {
  console.log('🚀 [ASBUILT] AsbuiltPageContent component is rendering!');
  
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get('projectId') || '';
  
  console.log('🔍 [ASBUILT] Component render - urlProjectId:', urlProjectId);
  console.log('🔍 [ASBUILT] searchParams:', searchParams.toString());
  console.log('🔍 [ASBUILT] searchParams.getAll:', Array.from(searchParams.entries()));
  console.log('🔍 [ASBUILT] window.location.href:', typeof window !== 'undefined' ? window.location.href : 'SSR');
  
  // Use shared contexts
  const {
    projectSummary,
    projectRecords,
    panelData,
    fileMetadata,
    isLoading,
    error: contextError,
    refreshAllData,
    deleteRecord,
    deleteFile,
    getFilesForPanel,
    getFilesForDomain
  } = useAsbuiltData();
  
  const {
    projects,
    selectedProject: contextSelectedProject,
    isLoading: projectsLoading,
    error: projectsError,
    selectProject,
    clearSelection
  } = useProjects();
  
  // Use URL projectId if available, otherwise fall back to contextSelectedProject
  const projectId = urlProjectId || contextSelectedProject?.id || '';
  
  console.log('🔍 [ASBUILT] Final projectId:', projectId);
  console.log('🔍 [ASBUILT] contextSelectedProject?.id:', contextSelectedProject?.id);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [showRecordViewer, setShowRecordViewer] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AsbuiltRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [activeTab, setActiveTab] = useState<'records' | 'files'>('records');

  // Handle URL-based project selection
  useEffect(() => {
    console.log('🔄 [ASBUILT] Project selection useEffect triggered:');
    console.log('  - urlProjectId:', urlProjectId);
    console.log('  - projectId (final):', projectId);
    console.log('  - projects.length:', projects.length);
    console.log('  - contextSelectedProject:', contextSelectedProject?.id);
    
    if (urlProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === urlProjectId);
      console.log('  - found project:', project?.name);
      if (project && project.id !== contextSelectedProject?.id) {
        console.log('  - selecting project:', project.id);
        selectProject(project.id);
      }
    }
  }, [urlProjectId, projects, contextSelectedProject, selectProject]);

  // Refresh data when project is selected
  useEffect(() => {
    console.log('🔄 [ASBUILT] Data refresh useEffect triggered:');
    console.log('  - contextSelectedProject:', contextSelectedProject?.id);
    console.log('  - projectId:', projectId);
    console.log('  - refreshAllData function:', typeof refreshAllData);
    
    if (contextSelectedProject && projectId) {
      console.log('🔄 [ASBUILT] Calling refreshAllData for project:', projectId);
      refreshAllData(projectId);
    } else {
      console.log('❌ [ASBUILT] Not calling refreshAllData - missing contextSelectedProject or projectId');
    }
  }, [contextSelectedProject, projectId, refreshAllData]);


  const handleFileView = (file: FileMetadata) => {
    setSelectedFile(file);
    setShowFileViewer(true);
  };

  const handleRecordView = async (recordId: string) => {
    setLoadingRecord(true);
    try {
      console.log('🔍 [ASBUILT] Fetching record details for:', recordId);
      const record = await getAsbuiltRecordDetails(recordId);
      setSelectedRecord(record);
      setShowRecordViewer(true);
    } catch (error) {
      console.error('❌ [ASBUILT] Failed to load record:', error);
      // TODO: Show error toast/notification
    } finally {
      setLoadingRecord(false);
    }
  };

  const handleDeleteRecord = async (recordId: string, panelNumber: string) => {
    if (!confirm(`Are you sure you want to delete record for panel ${panelNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      console.log('🗑️ [ASBUILT] Deleting record:', recordId);
      await deleteRecord(recordId);
      console.log('✅ [ASBUILT] Record deleted successfully');
      // The context will automatically update the UI by removing the record from the list
    } catch (error) {
      console.error('❌ [ASBUILT] Failed to delete record:', error);
      alert('Failed to delete record. Please try again.');
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete file "${fileName}"? This will also delete all associated records. This action cannot be undone.`)) {
      return;
    }

    try {
      console.log('🗑️ [ASBUILT] Deleting file:', fileId);
      await deleteFile(fileId);
      console.log('✅ [ASBUILT] File deleted successfully');
      // The context will automatically update the UI by removing the file from the list
    } catch (error) {
      console.error('❌ [ASBUILT] Failed to delete file:', error);
      alert('Failed to delete file. Please try again.');
    }
  };

  const handleImportComplete = () => {
    console.log('🔍 [ASBUILT] Import completed, refreshing data...');
    if (contextSelectedProject) {
      refreshAllData(contextSelectedProject.id);
    }
    setShowImportModal(false);
  };

  const filteredRecords = projectRecords.filter(record => {
    const matchesSearch = !searchQuery || 
      record.panelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(record.mappedData).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDomain = selectedDomain === 'all' || record.domain === selectedDomain;
    
    return matchesSearch && matchesDomain;
  });

  // Get all files from the shared context
  const allFiles = Array.from(fileMetadata.values());
  const filteredFiles = allFiles.filter(file => {
    const matchesSearch = !searchQuery || 
      file.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.panelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.domain.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDomain = selectedDomain === 'all' || file.domain === selectedDomain;
    
    return matchesSearch && matchesDomain;
  });

  const getDomainConfig = (domain: string) => {
    return ASBUILT_DOMAINS.find(d => d.domain === domain) || ASBUILT_DOMAINS[0];
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-green-100 text-green-800">High</Badge>;
    if (confidence >= 0.6) return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    return <Badge className="bg-red-100 text-red-800">Low</Badge>;
  };

  console.log('🔍 [ASBUILT] Loading states check:');
  console.log('🔍 [ASBUILT] projects.length:', projects.length);
  console.log('🔍 [ASBUILT] projectsLoading:', projectsLoading);
  console.log('🔍 [ASBUILT] isLoading (context):', isLoading);
  console.log('🔍 [ASBUILT] contextError:', contextError);
  console.log('🔍 [ASBUILT] projectsError:', projectsError);
  console.log('🔍 [ASBUILT] projects.length === 0:', projects.length === 0);
  console.log('🔍 [ASBUILT] !projectsLoading:', !projectsLoading);
  console.log('🔍 [ASBUILT] Condition (projects.length === 0 && !projectsLoading):', projects.length === 0 && !projectsLoading);
  
  if (projects.length === 0 && !projectsLoading) {
    console.log('🔍 [ASBUILT] Showing no projects available message');
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Available</h3>
          <p className="text-gray-500 mb-4">No projects found. Please create a project first.</p>
          <Button
            onClick={() => window.location.href = '/dashboard/projects'}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  if (contextError || projectsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-red-600 mb-4">{contextError || projectsError}</p>
          <Button
            onClick={() => refreshAllData(projectId)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  console.log('🔍 [ASBUILT] === CONDITIONAL RENDERING CHECK ===');
  console.log('🔍 [ASBUILT] contextSelectedProject value:', contextSelectedProject);
  console.log('🔍 [ASBUILT] projectRecords length:', projectRecords.length);
  console.log('🔍 [ASBUILT] isLoading:', isLoading);
  console.log('🔍 [ASBUILT] error:', contextError);
  
  if (!contextSelectedProject) {
    console.log('🔍 [ASBUILT] ✅ Taking project selection branch');
    console.log('🔍 [ASBUILT] Rendering project selection UI');
    console.log('🔍 [ASBUILT] Projects state:', projects);
    console.log('🔍 [ASBUILT] Projects length:', projects.length);
    console.log('🔍 [ASBUILT] ContextSelectedProject:', contextSelectedProject);
    console.log('🔍 [ASBUILT] About to return JSX for project selection');
    
    return (
      <div className="space-y-6">
        <div className="p-4 bg-red-500 text-white text-xl font-bold">
          DEBUG: This should be visible if JSX is rendering!
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">As-Built Data</h1>
            <p className="text-gray-600 mt-1">Select a project to view as-built records.</p>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Select Project ({projects.length} available)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-2 bg-yellow-100 rounded">
              <p className="text-sm">Debug: {projects.length} projects loaded</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                console.log('🔍 [ASBUILT] About to map projects:', projects);
                return null;
              })()}
              {projects.length === 0 ? (
                <div className="col-span-2 text-center py-8">
                  <p className="text-gray-500">No projects available</p>
                </div>
              ) : (
                projects.map((project, index) => {
                  console.log(`🔍 [ASBUILT] Rendering project ${index}:`, project);
                  return (
                    <div
                      key={project.id}
                      onClick={() => {
                        console.log('🔍 [ASBUILT] Project clicked:', project.name);
                        selectProject(project.id);
                      }}
                      className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors"
                    >
                      <h3 className="font-medium text-gray-900">{project.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                      <p className="text-xs text-gray-400 mt-2">Location: {project.location}</p>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log('🔍 [ASBUILT] ❌ Taking main content branch (project selected)');
  console.log('🔍 [ASBUILT] Rendering main content with selected project');
  console.log('🔍 [ASBUILT] ContextSelectedProject:', contextSelectedProject);
  console.log('🔍 [ASBUILT] Projects:', projects);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">As-Built Data</h1>
          <p className="text-gray-600 mt-1">
            Manage and view as-built records for panels, seaming, testing, and more.
            {contextSelectedProject && (
              <span className="ml-2 text-blue-600 font-medium">
                • {contextSelectedProject.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => clearSelection()}
          className="text-gray-600 hover:text-gray-800"
        >
          Change Project
        </Button>
          <Button
            variant="outline"
            onClick={() => refreshAllData(projectId)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setShowImportModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Data
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'records' | 'files')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="records">Records ({filteredRecords.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({filteredFiles.length})</TabsTrigger>
        </TabsList>

        {/* Summary Cards */}
        {projectSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Records</p>
                    <p className="text-2xl font-bold text-gray-900">{projectSummary.totalRecords}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Confidence</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Math.round(projectSummary.averageConfidence * 100)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Review Required</p>
                    <p className="text-2xl font-bold text-gray-900">{projectSummary.reviewRequired}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Filter className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Files</p>
                    <p className="text-2xl font-bold text-gray-900">{allFiles.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Domains</option>
                  {ASBUILT_DOMAINS.map((domain) => (
                    <option key={domain.domain} value={domain.domain}>
                      {domain.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Content */}
        <TabsContent value="records">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Records ({filteredRecords.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading records...</span>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-8">
                  <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Records Found</h3>
                  <p className="text-gray-500 mb-4">
                    {projectRecords.length === 0 
                      ? "No as-built data has been imported yet."
                      : "No records match your current filters."
                    }
                  </p>
                  <Button
                    onClick={() => setShowImportModal(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import Data
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Panel</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Domain</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Confidence</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Created</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record) => {
                        const domainConfig = getDomainConfig(record.domain);
                        return (
                          <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">
                                {record.mappedData.panelNumber || record.panelId}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{domainConfig.icon}</span>
                                <span className="font-medium text-gray-900">
                                  {domainConfig.displayName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${getConfidenceColor(record.aiConfidence)}`}>
                                  {Math.round(record.aiConfidence * 100)}%
                                </span>
                                {getConfidenceBadge(record.aiConfidence)}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {record.requiresReview ? (
                                <Badge className="bg-yellow-100 text-yellow-800">Review Required</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800">Approved</Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {new Date(record.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRecordView(record.id)}
                                  disabled={loadingRecord}
                                >
                                  {loadingRecord ? 'Loading...' : 'View'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteRecord(record.id, record.mappedData.panelNumber || record.panelId)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Files ({filteredFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Files Found</h3>
                  <p className="text-gray-500 mb-4">
                    {allFiles.length === 0 
                      ? "No files have been imported yet."
                      : "No files match your current filters."
                    }
                  </p>
                  <Button
                    onClick={() => setShowImportModal(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import Files
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredFiles.map((file) => {
                    const getFileIcon = (fileType: string) => {
                      switch (fileType) {
                        case 'excel':
                          return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
                        case 'pdf':
                          return <FileText className="h-8 w-8 text-red-600" />;
                        case 'image':
                          return <Image className="h-8 w-8 text-blue-600" />;
                        default:
                          return <FileText className="h-8 w-8 text-gray-600" />;
                      }
                    };

                    const formatFileSize = (bytes: number): string => {
                      if (bytes === 0) return '0 Bytes';
                      const k = 1024;
                      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                      const i = Math.floor(Math.log(bytes) / Math.log(k));
                      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                    };

                    return (
                      <div key={file.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          {getFileIcon(file.fileType)}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{file.fileName}</h4>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.fileSize)} • {file.fileType.toUpperCase()}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                Panel {file.panelId}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {file.domain}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(file.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFileView(file)}
                            className="flex-1"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(file.downloadUrl, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteFile(file.id, file.fileName)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Excel Import Modal */}
      {showImportModal && contextSelectedProject && (
        <ExcelImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          projectId={contextSelectedProject.id}
          panelId="project-wide" // Import for all panels in the project
          onImportComplete={handleImportComplete}
        />
      )}

      {/* File Viewer Modal */}
      <FileViewerModal
        isOpen={showFileViewer}
        onClose={() => {
          setShowFileViewer(false);
          setSelectedFile(null);
        }}
        file={selectedFile}
        showDataMapping={true}
        panelId={selectedFile?.panelId}
        domain={selectedFile?.domain}
      />

      {/* Record Viewer Modal */}
      <RecordViewerModal
        isOpen={showRecordViewer}
        onClose={() => {
          setShowRecordViewer(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
        loading={loadingRecord}
      />
    </div>
  );
}
