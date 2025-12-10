'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Smartphone, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Download
} from 'lucide-react';
import { useProjects } from '@/contexts/ProjectsProvider';
import { makeAuthenticatedRequest } from '@/lib/api';
import FormStatsCards from '@/components/forms/FormStatsCards';
import FormReviewTable from '@/components/forms/FormReviewTable';
import FormFilters from '@/components/forms/FormFilters';
import FormDetailModal from '@/components/forms/FormDetailModal';

interface Form {
  id: string;
  domain: string;
  status: 'pending' | 'approved' | 'rejected';
  source: string;
  mapped_data: any;
  raw_data: any;
  created_at: string;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  review_notes?: string;
  automation_job?: {
    job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: any;
    error_message?: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
  };
}

export default function FormsPage() {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get('projectId') || '';
  
  const {
    projects,
    selectedProject: contextSelectedProject,
    isLoading: projectsLoading,
    selectProject,
    clearSelection
  } = useProjects();

  const projectId = urlProjectId || contextSelectedProject?.id || '';

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stats, setStats] = useState<any>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    domain: 'all',
    search: ''
  });

  // Handle URL-based project selection
  useEffect(() => {
    if (urlProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === urlProjectId);
      if (project && project.id !== contextSelectedProject?.id) {
        selectProject(project.id);
      }
    }
  }, [urlProjectId, projects, contextSelectedProject, selectProject]);

  // Fetch forms when project changes
  useEffect(() => {
    if (projectId) {
      fetchForms();
      fetchStats();
    }
  }, [projectId, activeTab, filters]);

  // Poll for job status updates (only for processing jobs)
  useEffect(() => {
    if (!projectId) return;

    // Check if there are any processing jobs
    const hasProcessingJobs = forms.some(
      form => form.automation_job?.status === 'processing' || form.automation_job?.status === 'queued'
    );

    if (!hasProcessingJobs) return;

    // Poll every 5 seconds for processing jobs
    const interval = setInterval(() => {
      fetchForms();
    }, 5000);

    return () => clearInterval(interval);
  }, [projectId, forms]);

  const fetchForms = async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const status = activeTab === 'all' ? 'all' : activeTab;
      const response = await makeAuthenticatedRequest(
        `/api/forms/${projectId}?status=${status}&source=mobile&domain=${filters.domain}&search=${encodeURIComponent(filters.search)}`,
        { method: 'GET' }
      );

      const data = await response.json();

      if (data.success) {
        setForms(data.forms || []);
      } else {
        throw new Error(data.error || 'Failed to fetch forms');
      }
    } catch (err: any) {
      console.error('Error fetching forms:', err);
      console.error('Error details:', err);
      // Show more detailed error message
      const errorMessage = err.message || 'Failed to load forms';
      setError(errorMessage + (errorMessage.includes('migration') ? '' : '. Please check backend logs for details.'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!projectId) return;

    try {
      const response = await makeAuthenticatedRequest(
        `/api/forms/${projectId}/stats?source=mobile`,
        { method: 'GET' }
      );

      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleApprove = async (formId: string, notes?: string) => {
    try {
      const response = await makeAuthenticatedRequest(
        `/api/forms/${formId}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ notes })
        }
      );

      const data = await response.json();

      if (data.success) {
        await fetchForms();
        await fetchStats();
        if (selectedForm?.id === formId) {
          setSelectedForm(data.form);
        }
      }
    } catch (err: any) {
      alert(`Failed to approve form: ${err.message}`);
    }
  };

  const handleReject = async (formId: string, reason: string, notes?: string) => {
    try {
      const response = await makeAuthenticatedRequest(
        `/api/forms/${formId}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ reason, notes })
        }
      );

      const data = await response.json();

      if (data.success) {
        await fetchForms();
        await fetchStats();
        if (selectedForm?.id === formId) {
          setSelectedForm(data.form);
        }
      }
    } catch (err: any) {
      alert(`Failed to reject form: ${err.message}`);
    }
  };

  const handleBulkApprove = async (formIds: string[]) => {
    if (!confirm(`Approve ${formIds.length} forms?`)) return;

    try {
      const response = await makeAuthenticatedRequest(
        '/api/forms/bulk-approve',
        {
          method: 'POST',
          body: JSON.stringify({ recordIds: formIds })
        }
      );

      const data = await response.json();

      if (data.success) {
        await fetchForms();
        await fetchStats();
      }
    } catch (err: any) {
      alert(`Failed to approve forms: ${err.message}`);
    }
  };

  const handleBulkReject = async (formIds: string[], reason: string) => {
    if (!confirm(`Reject ${formIds.length} forms?`)) return;

    try {
      const response = await makeAuthenticatedRequest(
        '/api/forms/bulk-reject',
        {
          method: 'POST',
          body: JSON.stringify({ recordIds: formIds, reason })
        }
      );

      const data = await response.json();

      if (data.success) {
        await fetchForms();
        await fetchStats();
      }
    } catch (err: any) {
      alert(`Failed to reject forms: ${err.message}`);
    }
  };

  const handleViewForm = (form: Form) => {
    setSelectedForm(form);
    setShowDetailModal(true);
  };

  const handleRetryJob = async (jobId: string) => {
    if (!confirm('Retry this automation job?')) return;

    try {
      const response = await makeAuthenticatedRequest(
        `/api/jobs/${jobId}/retry`,
        {
          method: 'POST'
        }
      );

      const data = await response.json();

      if (data.success) {
        alert('Job retry queued successfully');
        await fetchForms();
      } else {
        alert(`Failed to retry job: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Failed to retry job: ${err.message}`);
    }
  };

  if (projects.length === 0 && !projectsLoading) {
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

  if (!contextSelectedProject && !projectId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mobile Forms Review</h1>
            <p className="text-gray-600 mt-1">Review and approve forms submitted from the mobile app.</p>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Select Project</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors"
                >
                  <h3 className="font-medium text-gray-900">{project.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="h-8 w-8 text-blue-600" />
            Mobile Forms Review
          </h1>
          <p className="text-gray-600 mt-1">
            Review and approve forms submitted from the mobile app.
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
            onClick={() => {
              fetchForms();
              fetchStats();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && <FormStatsCards stats={stats} />}

      {/* Filters */}
      <FormFilters
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            All Forms
            {stats && <Badge variant="outline">{stats.total || 0}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            Pending
            {stats && <Badge className="bg-yellow-100 text-yellow-800">{stats.pending || 0}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Approved
            {stats && <Badge className="bg-green-100 text-green-800">{stats.approved || 0}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            Rejected
            {stats && <Badge className="bg-red-100 text-red-800">{stats.rejected || 0}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Mobile App Forms ({forms.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Forms</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button onClick={fetchForms}>Retry</Button>
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading forms...</span>
                </div>
              ) : forms.length === 0 ? (
                <div className="text-center py-8">
                  <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Forms Found</h3>
                  <p className="text-gray-500">
                    {activeTab === 'pending' 
                      ? "No pending forms from mobile app."
                      : activeTab === 'approved'
                      ? "No approved forms yet."
                      : activeTab === 'rejected'
                      ? "No rejected forms."
                      : "No forms submitted from mobile app yet."}
                  </p>
                </div>
              ) : (
                <FormReviewTable
                  forms={forms}
                  onView={handleViewForm}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onBulkApprove={handleBulkApprove}
                  onBulkReject={handleBulkReject}
                  onRetryJob={handleRetryJob}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Detail Modal */}
      {showDetailModal && selectedForm && (
        <FormDetailModal
          form={selectedForm}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedForm(null);
          }}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

