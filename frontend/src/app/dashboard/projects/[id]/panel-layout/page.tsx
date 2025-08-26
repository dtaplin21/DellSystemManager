import { Suspense } from 'react';
import { getProjectSafe, getPanelLayoutSafe } from '@/lib/safe-api';
import PanelLayoutClient from './panel-layout-client';
import Loading from './loading';
import Error from './error';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PanelLayoutPage({ params }: PageProps) {
  try {
    const { id } = await params;
    
    // Safely fetch data with fallbacks
    const [project, layout] = await Promise.all([
      getProjectSafe(id),
      getPanelLayoutSafe(id)
    ]);
    
    return (
      <Suspense fallback={<Loading />}>
        <PanelLayoutClient 
          projectId={id}
          initialProject={project}
          initialLayout={layout}
        />
      </Suspense>
    );
  } catch (error) {
    console.error('🚨 Panel Layout Page Error:', error);
    
    // Return error boundary
    return <Error error={error as Error} reset={() => window.location.reload()} />;
  }
}
