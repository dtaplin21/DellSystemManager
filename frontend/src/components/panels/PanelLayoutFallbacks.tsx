'use client';

import React from 'react';
import { Loader2, AlertCircle, Plus, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LoadingFallbackProps {
  message?: string;
}

export function LoadingFallback({ message = 'Loading panel layout...' }: LoadingFallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-sm text-gray-600">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface ErrorFallbackProps {
  error: string;
  onRetry?: () => void;
  onClearStorage?: () => void;
}

export function ErrorFallback({ error, onRetry, onClearStorage }: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-lg">Error Loading Panels</CardTitle>
          <CardDescription>
            {error}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {onRetry && (
            <Button onClick={onRetry} className="w-full">
              Try Again
            </Button>
          )}
          {onClearStorage && (
            <Button 
              variant="outline" 
              onClick={onClearStorage} 
              className="w-full"
            >
              Clear Local Storage & Retry
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface EmptyStateFallbackProps {
  onAddPanel?: () => void;
  onImportLayout?: () => void;
}

export function EmptyStateFallback({ onAddPanel, onImportLayout }: EmptyStateFallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Grid3X3 className="h-6 w-6 text-gray-600" />
          </div>
          <CardTitle className="text-lg">No Panels Found</CardTitle>
          <CardDescription>
            Start by adding panels to your layout or importing an existing design
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {onAddPanel && (
            <Button onClick={onAddPanel} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add First Panel
            </Button>
          )}
          {onImportLayout && (
            <Button variant="outline" onClick={onImportLayout} className="w-full">
              Import Layout
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface HydrationFallbackProps {
  message?: string;
}

export function HydrationFallback({ message = 'Initializing panel layout...' }: HydrationFallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Grid3X3 className="h-6 w-6 text-blue-600" />
        </div>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}
