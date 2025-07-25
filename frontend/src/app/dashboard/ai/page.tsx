'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Upload, 
  Download, 
  Settings,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { 
  fetchProjects, 
  uploadDocument, 
  fetchDocuments, 
  downloadDocument,
  getPanelRequirements,
  savePanelRequirements,
  getPanelRequirementsAnalysis
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import PanelRequirementsForm from '@/components/panel-layout/PanelRequirementsForm';

interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

interface JobStatus {
  status: 'idle' | 'processing' | 'success' | 'error' | 'insufficient_information' | 'partial' | 'fallback';
  created_at?: string;
  actions?: any[];
  summary?: string;
  guidance?: any;
  missingParameters?: any;
  warnings?: string[];
  analysis?: any;
}

export default function AIPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isAuthenticated, loading } = useSupabaseAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus>({ status: 'idle' });
  const [requirements, setRequirements] = useState<any>(null);
  const [requirementsConfidence, setRequirementsConfidence] = useState(0);
  const [activeSection, setActiveSection] = useState<'documents' | 'requirements'>('requirements');

  // Check authentication
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      console.log('User not authenticated, redirecting to login');
      router.push('/login');
      return;
    }
  }, [isAuthenticated, loading, router]);

  // Load projects only when authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      loadProjects();
    }
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (selectedProject) {
      loadDocuments();
      loadRequirements();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      console.log('Loading projects for authenticated user...');
      const response = await fetchProjects();
      console.log('Projects response:', response);
      
      // Backend returns projects as array directly, not wrapped in { projects: [...] }
      const projectsArray = Array.isArray(response) ? response : (response.projects || []);
      setProjects(projectsArray);
      
      if (projectsArray.length > 0) {
        setSelectedProject(projectsArray[0]);
        console.log('Selected first project:', projectsArray[0]);
      } else {
        console.log('No projects found');
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      if (error instanceof Error && error.message.includes('Authentication required')) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to access your projects',
          variant: 'destructive',
        });
        router.push('/login');
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load projects',
          variant: 'destructive',
        });
      }
    }
  };

  const loadDocuments = async () => {
    if (!selectedProject) return;
    
    try {
      const response = await fetchDocuments(selectedProject.id);
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const loadRequirements = async () => {
    if (!selectedProject) return;
    
    try {
      const response = await getPanelRequirements(selectedProject.id);
      if (response.success) {
        setRequirements(response.requirements);
        setRequirementsConfidence(response.confidence);
      }
    } catch (error) {
      console.error('Error loading requirements:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !selectedProject) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await uploadDocument(selectedProject.id, file);
      }
      
      toast({
        title: 'Success',
        description: 'Documents uploaded successfully',
      });
      
      loadDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload documents',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocument = async (documentId: string, filename: string) => {
    try {
      const blob = await downloadDocument(documentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive',
      });
    }
  };

  const handleReadWithAI = (documentId: string) => {
    setSelectedDocuments([documentId]);
    // You can implement AI document reading functionality here
    toast({
      title: 'AI Reading',
      description: 'AI is analyzing the selected document...',
    });
  };



  const handleRequirementsChange = (newRequirements: any, confidence: number) => {
    setRequirements(newRequirements);
    setRequirementsConfidence(confidence);
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show authentication required message
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
                <p className="text-gray-600 mb-4">Please log in to access the AI Assistant.</p>
                <Button onClick={() => router.push('/login')}>
                  Go to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">AI Assistant</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Finish update:</span>
          <span className="text-sm font-semibold">{requirementsConfidence.toFixed(1)}%</span>
        </div>
      </div>

      {/* Project Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Project Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const project = projects.find(p => p.id === e.target.value);
              setSelectedProject(project || null);
            }}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveSection('requirements')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeSection === 'requirements'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Panel Requirements</span>
        </button>
        <button
          onClick={() => setActiveSection('documents')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeSection === 'documents'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Documents</span>
        </button>

      </div>

      {/* Panel Requirements Section */}
      {activeSection === 'requirements' && selectedProject && (
        <PanelRequirementsForm
          projectId={selectedProject.id}
          onRequirementsChange={handleRequirementsChange}
          onLayoutGenerated={(result) => {
            setJobStatus({
              status: result.status || 'success',
              created_at: new Date().toISOString(),
              actions: result.actions || [],
              summary: result.summary,
              guidance: result.guidance,
              missingParameters: result.missingParameters,
              warnings: result.warnings,
              analysis: result.analysis
            });
          }}
        />
      )}

      {/* Documents Section */}
      {activeSection === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Project Documents</span>
              <div className="flex items-center space-x-2">
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <Button variant="outline" disabled={uploading}>
                    {uploading ? (
                      <>
                        <Upload className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Documents
                      </>
                    )}
                  </Button>
                </Label>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className={`document-item${selectedDocuments.includes(doc.id) ? ' selected' : ''}`}>
                  <div className="doc-info">
                    <span className="doc-name">{doc.name}</span>
                    <span className="doc-date">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="doc-actions">
                    <button className="btn-read-ai" onClick={() => handleReadWithAI(doc.id)}>
                      <FileText className="h-4 w-4 mr-1" /> Read
                    </button>
                    <button className="btn-download" onClick={() => handleDownloadDocument(doc.id, doc.name)}>
                      <Download className="h-4 w-4 mr-1" /> Download
                    </button>
                  </div>
                </div>
              ))}
              {documents.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  No documents uploaded yet. Upload documents to get started.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}