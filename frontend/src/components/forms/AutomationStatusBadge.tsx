'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Loader2, 
  CheckCircle, 
  XCircle,
  RefreshCw
} from 'lucide-react';

interface AutomationStatusBadgeProps {
  job?: {
    job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: any;
    error_message?: string;
  };
  onRetry?: (jobId: string) => void;
}

export default function AutomationStatusBadge({ job, onRetry }: AutomationStatusBadgeProps) {
  if (!job) {
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-500">
        <span className="text-xs">No automation</span>
      </Badge>
    );
  }

  const { status, progress, error_message } = job;

  switch (status) {
    case 'queued':
      return (
        <Badge className="bg-gray-100 text-gray-700 border-gray-300">
          <Clock className="h-3 w-3 mr-1" />
          <span className="text-xs">Queued</span>
        </Badge>
      );

    case 'processing':
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-300">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          <span className="text-xs">Processing {progress}%</span>
        </Badge>
      );

    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-700 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          <span className="text-xs">Completed</span>
        </Badge>
      );

    case 'failed':
      return (
        <div className="flex items-center gap-1">
          <Badge className="bg-red-100 text-red-700 border-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            <span className="text-xs">Failed</span>
          </Badge>
          {onRetry && (
            <button
              onClick={() => onRetry(job.job_id)}
              className="text-red-600 hover:text-red-800 p-1"
              title="Retry job"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      );

    default:
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-500">
          <span className="text-xs">Unknown</span>
        </Badge>
      );
  }
}

