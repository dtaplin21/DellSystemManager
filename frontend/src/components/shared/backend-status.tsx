'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Wifi, WifiOff } from 'lucide-react';

interface BackendStatus {
  isHealthy: boolean;
  lastCheck: Date | null;
  error?: string;
  responseTime?: number;
}

export default function BackendStatus() {
  const [status, setStatus] = useState<BackendStatus>({
    isHealthy: false,
    lastCheck: null
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkBackendHealth = async () => {
    setIsChecking(true);
    const startTime = Date.now();
    
    try {
      const response = await fetch('http://localhost:8003/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        setStatus({
          isHealthy: true,
          lastCheck: new Date(),
          responseTime
        });
      } else {
        setStatus({
          isHealthy: false,
          lastCheck: new Date(),
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseTime
        });
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      setStatus({
        isHealthy: false,
        lastCheck: new Date(),
        error: error.message || 'Connection failed',
        responseTime
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check on mount
    checkBackendHealth();
    
    // Check every 30 seconds
    const interval = setInterval(checkBackendHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (isChecking) {
      return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />;
    }
    
    if (status.isHealthy) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    
    return <AlertCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusColor = () => {
    if (status.isHealthy) return 'bg-green-100 text-green-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wifi className="h-4 w-4" />
          Backend Status
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <Badge className={getStatusColor()}>
                {status.isHealthy ? 'Healthy' : 'Unhealthy'}
              </Badge>
            </div>
          </div>
          
          {status.responseTime && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Response Time:</span>
              <span className="text-sm text-gray-600">
                {status.responseTime}ms
              </span>
            </div>
          )}
          
          {status.lastCheck && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Last Check:</span>
              <span className="text-sm text-gray-600">
                {status.lastCheck.toLocaleTimeString()}
              </span>
            </div>
          )}
          
          {status.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2">
              <p className="text-xs text-red-700 font-medium">Error:</p>
              <p className="text-xs text-red-600">{status.error}</p>
            </div>
          )}
          
          <Button
            onClick={checkBackendHealth}
            disabled={isChecking}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isChecking ? 'Checking...' : 'Check Now'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
