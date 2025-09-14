import { Suspense } from 'react';
import Loading from './loading';
import Error from './error';
import PanelLayoutRefactored from './panel-layout-refactored';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PanelLayoutPage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <Suspense fallback={<Loading />}>
      <PanelLayoutRefactored />
    </Suspense>
  );
}
