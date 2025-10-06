'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { AsbuiltDataProvider } from '@/contexts/AsbuiltDataContext';
import AsbuiltPageContent from './AsbuiltPageContent';

export default function AsbuiltPageWrapper() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Selected</h3>
          <p className="text-gray-500 mb-4">Please select a project to view as-built data.</p>
        </div>
      </div>
    );
  }

  return (
    <AsbuiltDataProvider projectId={projectId}>
      <AsbuiltPageContent />
    </AsbuiltDataProvider>
  );
}
