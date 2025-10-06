'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { AsbuiltDataProvider } from '@/contexts/AsbuiltDataContext';
import AsbuiltPageContent from './AsbuiltPageContent';

export default function AsbuiltPageWrapper() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  // Always render AsbuiltPageContent - it will handle project selection internally

  return (
    <AsbuiltDataProvider projectId={projectId}>
      <AsbuiltPageContent />
    </AsbuiltDataProvider>
  );
}
