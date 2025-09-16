'use client';

import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFullscreenState } from '@/contexts/PanelContext';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import sidebarDataCache from '@/services/SidebarDataCache';
import { Panel } from '@/types/panel';

// Lazy load the full sidebar component
const PanelSidebar = lazy(() => import('@/components/panel-layout/panel-sidebar'));

interface LazyFullSidebarProps {
  projectId: string;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

// Loading skeleton component
const SidebarSkeleton = () => (
  <div className="fixed left-0 top-0 h-full w-96 bg-white border-r border-gray-200 shadow-2xl z-[99999] overflow-hidden flex flex-col">
    <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
        <div>
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
    
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-2 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </div>
);

// Error boundary component
const SidebarErrorBoundary = ({ 
  error, 
  onRetry, 
  onClose 
}: { 
  error: Error; 
  onRetry: () => void; 
  onClose: () => void; 
}) => (
  <div className="fixed left-0 top-0 h-full w-96 bg-white border-r border-gray-200 shadow-2xl z-[99999] overflow-hidden flex flex-col">
    <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
      <div className="flex items-center gap-4">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <div>
          <h2 className="text-xl font-bold text-red-900">Sidebar Error</h2>
          <p className="text-red-700">Failed to load panel data</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="h-8 w-8 p-0"
      >
        ×
      </Button>
    </div>
    
    <div className="flex-1 overflow-y-auto p-6">
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Unable to Load Panel Data
            </h3>
            <p className="text-red-700 mb-4">
              {error.message || 'An unexpected error occurred while loading the sidebar data.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={onRetry} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                Try Again
              </Button>
              <Button onClick={onClose} variant="outline">
                Close Sidebar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

export function LazyFullSidebar({ projectId, onClose, onError }: LazyFullSidebarProps) {
  const { fullscreen, dispatchFullscreen } = useFullscreenState();
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const performance = usePerformanceMonitoring({
    enabled: true,
    samplingRate: 0.1,
    thresholds: {
      maxRenderTime: 32,
      maxMemoryUsage: 300 * 1024 * 1024,
      maxInteractionDelay: 150,
      maxErrorRate: 0.01,
      maxSidebarLoadTime: 3000,
    },
  });

  const selectedPanel = fullscreen.sidebarPanel || fullscreen.selectedPanel;

  // Handle sidebar close
  const handleClose = useCallback(() => {
    dispatchFullscreen({ type: 'SET_FULL_SIDEBAR', payload: false });
    setError(null);
    onClose?.();
  }, [dispatchFullscreen, onClose]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setError(null);
    setRetryCount(prev => prev + 1);
    setIsLoading(true);
    
    // Clear cache for this panel to force fresh data
    if (selectedPanel) {
      sidebarDataCache.delete(selectedPanel.id, projectId);
    }
  }, [selectedPanel, projectId]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    console.error('Sidebar error:', error);
    setError(error);
    setIsLoading(false);
    performance.trackError(error);
    onError?.(error);
  }, [performance, onError]);

  // Preload sidebar data when panel is selected
  useEffect(() => {
    if (!selectedPanel || !fullscreen.fullSidebarVisible) return;

    const preloadData = async () => {
      try {
        performance.startInteractionTiming();
        setIsLoading(true);
        setError(null);

        // Check cache first
        const cachedData = sidebarDataCache.get(selectedPanel.id, projectId);
        if (cachedData) {
          performance.trackCacheHit();
          setIsLoading(false);
          performance.endInteractionTiming();
          return;
        }

        performance.trackCacheMiss();

        // Simulate API call (replace with actual API call)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        
        // Mock data (replace with actual data fetching)
        const mockData = {
          panelDetails: {
            id: selectedPanel.id,
            name: selectedPanel.panelNumber || selectedPanel.id,
            type: selectedPanel.type || 'standard',
            status: 'active',
          },
          asbuiltData: {
            panelPlacement: [],
            panelSeaming: [],
            nonDestructive: [],
            trialWeld: [],
            repairs: [],
            destructive: [],
          },
          rightNeighborPeek: {
            panelNumber: 'P-002',
            quickStatus: 'Complete',
            link: `/dashboard/projects/${projectId}/panels/P-002`,
          },
          metadata: {
            panelId: selectedPanel.id,
            projectId,
            lastUpdated: Date.now(),
            dataSize: 1024,
          },
        };

        // Cache the data
        sidebarDataCache.set(selectedPanel.id, projectId, mockData);
        
        setIsLoading(false);
        performance.endInteractionTiming();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load sidebar data');
        handleError(error);
      }
    };

    preloadData();
  }, [selectedPanel, projectId, fullscreen.fullSidebarVisible, performance, handleError]);

  // Don't render if not in fullscreen or no panel selected
  if (!fullscreen.isFullscreen || !fullscreen.fullSidebarVisible || !selectedPanel) {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <SidebarErrorBoundary
        error={error}
        onRetry={handleRetry}
        onClose={handleClose}
      />
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="fixed left-0 top-0 h-full w-96 bg-white border-r border-gray-200 shadow-2xl z-[99999] overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-4">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Loading Panel Data</h2>
              <p className="text-gray-600">Please wait while we load the panel information...</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            ×
          </Button>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading panel {selectedPanel.panelNumber || selectedPanel.id}...</p>
            {retryCount > 0 && (
              <p className="text-sm text-gray-500 mt-2">Retry attempt {retryCount}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render the actual sidebar
  return (
    <Suspense fallback={<SidebarSkeleton />}>
      <PanelSidebar
        isOpen={true}
        onToggle={handleClose}
        projectId={projectId}
        panelId={selectedPanel.id}
        panelNumber={selectedPanel.panelNumber || selectedPanel.id}
        onClose={handleClose}
      />
    </Suspense>
  );
}

export default LazyFullSidebar;
