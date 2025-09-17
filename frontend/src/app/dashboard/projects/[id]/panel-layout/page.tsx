import { Suspense } from 'react';
import Loading from './loading';
import Error from './error';
import { PanelLayoutRefactored } from '@/components/panels/PanelLayoutRefactored';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PanelLayoutPage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <Suspense fallback={<Loading />}>
      <PanelLayoutRefactored 
        panels={[]}
        projectId={id}
        featureFlags={{
          ENABLE_PERSISTENCE: true,
          ENABLE_DRAGGING: true,
          ENABLE_LOCAL_STORAGE: true,
          ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
          ENABLE_WEBSOCKET_UPDATES: false,
        }}
      />
    </Suspense>
  );
}
