'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, 
  CheckCircle, 
  XCircle, 
  Smartphone,
  Clock
} from 'lucide-react';

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
}

interface FormReviewTableProps {
  forms: Form[];
  onView: (form: Form) => void;
  onApprove: (formId: string, notes?: string) => void;
  onReject: (formId: string, reason: string, notes?: string) => void;
  onBulkApprove: (formIds: string[]) => void;
  onBulkReject: (formIds: string[], reason: string) => void;
}

const DOMAIN_LABELS: Record<string, string> = {
  panel_placement: 'Panel Placement',
  repairs: 'Repairs',
  panel_seaming: 'Panel Seaming',
  non_destructive: 'Non-Destructive',
  trial_weld: 'Trial Weld',
  destructive: 'Destructive'
};

export default function FormReviewTable({
  forms,
  onView,
  onApprove,
  onReject,
  onBulkApprove,
  onBulkReject
}: FormReviewTableProps) {
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  const toggleSelect = (formId: string) => {
    const newSelected = new Set(selectedForms);
    if (newSelected.has(formId)) {
      newSelected.delete(formId);
    } else {
      newSelected.add(formId);
    }
    setSelectedForms(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedForms.size === forms.length) {
      setSelectedForms(new Set());
    } else {
      setSelectedForms(new Set(forms.map(f => f.id)));
    }
  };

  const handleBulkApprove = () => {
    if (selectedForms.size === 0) return;
    onBulkApprove(Array.from(selectedForms));
    setSelectedForms(new Set());
  };

  const handleBulkReject = () => {
    if (selectedForms.size === 0 || !bulkRejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    onBulkReject(Array.from(selectedForms), bulkRejectReason);
    setSelectedForms(new Set());
    setBulkRejectReason('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getFormIdentifier = (form: Form) => {
    const data = form.mapped_data || {};
    return data.panelNumber || data.repairId || data.sampleId || form.id.slice(0, 8);
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedForms.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-900">
              {selectedForms.size} form{selectedForms.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleBulkApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Selected
            </Button>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Rejection reason..."
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              />
              <Button
                size="sm"
                onClick={handleBulkReject}
                className="bg-red-600 hover:bg-red-700"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Selected
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedForms(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4">
                <input
                  type="checkbox"
                  checked={selectedForms.size === forms.length && forms.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Form</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Submitted</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => {
              const identifier = getFormIdentifier(form);
              return (
                <tr key={form.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedForms.has(form.id)}
                      onChange={() => toggleSelect(form.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="font-medium text-gray-900">{identifier}</div>
                        <div className="text-xs text-gray-500">Mobile App</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">
                      {DOMAIN_LABELS[form.domain] || form.domain}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(form.status)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(form.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onView(form)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      {form.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onApprove(form.id)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const reason = prompt('Rejection reason:');
                              if (reason) {
                                onReject(form.id, reason);
                              }
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

