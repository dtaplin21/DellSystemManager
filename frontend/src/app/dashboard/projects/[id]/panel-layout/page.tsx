import { Suspense } from 'react';
import Loading from './loading';
import Error from './error';
import PanelLayoutRefactored from './panel-layout-refactored';
import TestPanelData from './test-panel-data';
import DebugData from './debug-data';
import SimplePanelTest from './simple-panel-test';
import MinimalTest from './minimal-test';
import GridTest from './grid-test';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PanelLayoutPage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <Suspense fallback={<Loading />}>
      <GridTest />
    </Suspense>
  );
}
