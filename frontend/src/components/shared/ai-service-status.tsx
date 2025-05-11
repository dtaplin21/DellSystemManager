import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import axios from 'axios';
import { AlertTriangle, Check, Settings, X } from 'lucide-react';

interface ServiceStatusProps {
  onConfigure?: () => void;
  compact?: boolean;
}

export default function AIServiceStatus({ onConfigure, compact = false }: ServiceStatusProps) {
  const [serviceStatus, setServiceStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchServiceStatus = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('/api/system/services');
        setServiceStatus(response.data);
      } catch (error) {
        console.error('Error fetching service status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchServiceStatus();
  }, []);

  if (isLoading) {
    return compact ? null : (
      <div className="animate-pulse flex items-center space-x-2 p-2 bg-gray-100 rounded-md">
        <div className="h-4 bg-gray-200 rounded w-4"></div>
        <div className="h-4 bg-gray-200 rounded w-40"></div>
      </div>
    );
  }

  if (!serviceStatus || !serviceStatus.services) {
    return compact ? null : (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Could not retrieve service status information.
        </AlertDescription>
      </Alert>
    );
  }

  const { services, missingSecrets } = serviceStatus;
  
  // If all AI services are available, show a success message
  if (!missingSecrets || missingSecrets.length === 0 || 
      !missingSecrets.some((s: string) => s.startsWith('ai.'))) {
    if (compact) {
      return (
        <div className="flex items-center space-x-2 text-sm text-green-600">
          <Check className="h-4 w-4" />
          <span>All AI services are available</span>
        </div>
      );
    }
    
    return (
      <Alert className="bg-green-50 text-green-700 border-green-200">
        <Check className="h-4 w-4" />
        <AlertTitle>AI Services Ready</AlertTitle>
        <AlertDescription>
          All AI automation services are configured and ready to use.
        </AlertDescription>
      </Alert>
    );
  }
  
  // If there are missing AI services, show a warning
  const aiMissingServices = missingSecrets.filter((s: string) => s.startsWith('ai.'));
  
  if (compact) {
    return (
      <div className="flex items-center space-x-2 text-sm text-amber-600">
        <AlertTriangle className="h-4 w-4" />
        <span>Some AI services need configuration</span>
        {onConfigure && (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 px-2 text-xs"
            onClick={onConfigure}
          >
            <Settings className="h-3 w-3 mr-1" />
            Configure
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <Alert className="bg-amber-50 text-amber-700 border-amber-200">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex justify-between">
        <span>AI Services Limited</span>
        <Button
          variant="link"
          className="p-0 h-auto text-amber-700"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show Less' : 'Show Details'}
        </Button>
      </AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          Some AI automation features require additional configuration.
        </p>
        
        {isExpanded && (
          <div className="mt-2 text-sm">
            <p className="font-medium mb-1">Missing services:</p>
            <ul className="space-y-1 list-disc pl-5">
              {aiMissingServices.map((service: string, index: number) => (
                <li key={index}>
                  {service === 'ai.openai' ? 'OpenAI API for advanced AI features' : service}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {onConfigure && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 bg-white"
            onClick={onConfigure}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure AI Services
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}