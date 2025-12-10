'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  Smartphone,
  Clock,
  User,
  Calendar,
  RefreshCw,
  Loader2
} from 'lucide-react';
import AutomationStatusBadge from './AutomationStatusBadge';
import { makeAuthenticatedRequest } from '@/lib/api';

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

interface FormDetailModalProps {
  form: Form;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (formId: string, notes?: string) => void;
  onReject: (formId: string, reason: string, notes?: string) => void;
}

const DOMAIN_LABELS: Record<string, string> = {
  panel_placement: 'Panel Placement',
  repairs: 'Repairs',
  panel_seaming: 'Panel Seaming',
  non_destructive: 'Non-Destructive',
  trial_weld: 'Trial Weld',
  destructive: 'Destructive'
};

export default function FormDetailModal({
  form,
  isOpen,
  onClose,
  onApprove,
  onReject
}: FormDetailModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState(form.review_notes || '');

  if (!isOpen) return null;

  const getStatusBadge = () => {
    switch (form.status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{form.status}</Badge>;
    }
  };

  const handleApprove = () => {
    onApprove(form.id, reviewNotes);
    onClose();
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    onReject(form.id, rejectionReason, reviewNotes);
    onClose();
  };

  const formData = form.mapped_data || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {DOMAIN_LABELS[form.domain] || form.domain}
              </h2>
              <p className="text-sm text-gray-500">Form from Mobile App</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Submitted:</span>
              <span className="font-medium">{new Date(form.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Form ID:</span>
              <span className="font-medium font-mono text-xs">{form.id.slice(0, 8)}...</span>
            </div>
            {form.approved_at && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Reviewed:</span>
                <span className="font-medium">{new Date(form.approved_at).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Form Data */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Form Data</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(formData).map(([key, value]) => (
                  <div key={key} className="border-b border-gray-200 pb-2">
                    <div className="text-sm font-medium text-gray-600 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <div className="text-base text-gray-900 mt-1">
                      {value !== null && value !== undefined ? String(value) : 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Automation Job Status */}
          {form.automation_job && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Automation Status</h3>
                <AutomationStatusBadge 
                  job={form.automation_job}
                  onRetry={async (jobId) => {
                    if (!confirm('Retry this automation job?')) return;
                    try {
                      const response = await makeAuthenticatedRequest(
                        `/api/jobs/${jobId}/retry`,
                        { method: 'POST' }
                      );
                      const data = await response.json();
                      if (data.success) {
                        alert('Job retry queued successfully');
                        window.location.reload();
                      } else {
                        alert(`Failed to retry job: ${data.error}`);
                      }
                    } catch (err: any) {
                      alert(`Failed to retry job: ${err.message}`);
                    }
                  }}
                />
              </div>

              {/* Progress Bar */}
              {(form.automation_job.status === 'processing' || form.automation_job.status === 'queued') && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{form.automation_job.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${form.automation_job.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Job Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Job ID:</span>
                  <span className="ml-2 font-mono text-xs">{form.automation_job.job_id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Created:</span>
                  <span className="ml-2">
                    {new Date(form.automation_job.created_at).toLocaleString()}
                  </span>
                </div>
                {form.automation_job.started_at && (
                  <div>
                    <span className="text-gray-600">Started:</span>
                    <span className="ml-2">
                      {new Date(form.automation_job.started_at).toLocaleString()}
                    </span>
                  </div>
                )}
                {form.automation_job.completed_at && (
                  <div>
                    <span className="text-gray-600">Completed:</span>
                    <span className="ml-2">
                      {new Date(form.automation_job.completed_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Result */}
              {form.automation_job.status === 'completed' && form.automation_job.result && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                  <h4 className="font-semibold text-green-900 mb-2">Result</h4>
                  <div className="text-sm text-green-800">
                    {form.automation_job.result.panels_created && (
                      <p>Panels Created: {form.automation_job.result.panels_created}</p>
                    )}
                    {form.automation_job.result.message && (
                      <p>{form.automation_job.result.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {form.automation_job.status === 'failed' && form.automation_job.error_message && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                  <h4 className="font-semibold text-red-900 mb-2">Error</h4>
                  <p className="text-sm text-red-800">{form.automation_job.error_message}</p>
                </div>
              )}
            </div>
          )}

          {/* Rejection Reason (if rejected) */}
          {form.status === 'rejected' && form.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-2">Rejection Reason</h4>
              <p className="text-red-800">{form.rejection_reason}</p>
            </div>
          )}

          {/* Review Notes */}
          {form.review_notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Review Notes</h4>
              <p className="text-blue-800">{form.review_notes}</p>
            </div>
          )}

          {/* Action Section (if pending) */}
          {form.status === 'pending' && (
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes (optional)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Add notes about this form..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason (required for rejection)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={2}
                  placeholder="Enter reason for rejection..."
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleReject}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={!rejectionReason.trim()}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

