import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import axios from 'axios';
import { Brain, Lightbulb, AlertTriangle, Check, Zap, FastForward, ArrowRight } from 'lucide-react';

interface AICapability {
  name: string;
  icon: React.ReactNode;
  description: string;
  route: string;
  available: boolean;
  requiredServices: string[];
}

const AI_CAPABILITIES: AICapability[] = [
  {
    name: 'Document Analysis',
    icon: <Brain className="h-6 w-6" />,
    description: 'Automatically analyze project documents to extract key information and patterns.',
    route: '/ai/document-analysis',
    available: true,  // Base functionality works without OpenAI
    requiredServices: []
  },
  {
    name: 'QC Data Analysis',
    icon: <Lightbulb className="h-6 w-6" />,
    description: 'Detect anomalies and patterns in your quality control data.',
    route: '/ai/qc-analysis',
    available: true,  // Base functionality works without OpenAI
    requiredServices: []
  },
  {
    name: 'Panel Layout Optimization',
    icon: <Zap className="h-6 w-6" />,
    description: 'Automatically optimize your panel layout for efficiency and reduced waste.',
    route: '/ai/panel-optimization',
    available: true,  // Uses built-in algorithm
    requiredServices: []
  },
  {
    name: 'Smart Recommendations',
    icon: <FastForward className="h-6 w-6" />,
    description: 'Get personalized recommendations based on your project data.',
    route: '/ai/recommendations',
    available: false,  // Requires OpenAI API
    requiredServices: ['ai.openai']
  },
  {
    name: 'Automated Reporting',
    icon: <ArrowRight className="h-6 w-6" />,
    description: 'Generate comprehensive project reports with a single click.',
    route: '/ai/reporting',
    available: false,  // Requires OpenAI API
    requiredServices: ['ai.openai']
  }
];

export default function AIDashboard() {
  const [serviceStatus, setServiceStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchServiceStatus = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('/api/system/services');
        setServiceStatus(response.data);
      } catch (error) {
        console.error('Error fetching service status:', error);
        toast({
          title: 'Service Status Error',
          description: 'Could not fetch AI service availability. Some features may be limited.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchServiceStatus();
  }, [toast]);

  // Update AI capabilities based on service status
  const getCapabilities = () => {
    if (!serviceStatus) {
      return AI_CAPABILITIES;
    }

    return AI_CAPABILITIES.map(capability => {
      // Check if all required services are available
      const available = capability.requiredServices.length === 0 || 
        capability.requiredServices.every(service => {
          const [category, api] = service.split('.');
          return serviceStatus.services?.[category]?.[api];
        });

      return { ...capability, available };
    });
  };

  const handleCapabilityClick = (capability: AICapability) => {
    if (!capability.available) {
      // Find which services are missing
      const missingServices = capability.requiredServices.filter(service => {
        const [category, api] = service.split('.');
        return !serviceStatus?.services?.[category]?.[api];
      });

      toast({
        title: 'Service Not Available',
        description: `This feature requires additional configuration: ${missingServices.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    // TODO: Navigate to the route
    toast({
      title: 'Feature Coming Soon',
      description: 'This AI feature will be available in an upcoming release!',
    });
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">AI Automation</h2>
          <p className="text-muted-foreground">
            Leverage AI to automate tasks and gain insights from your project data.
          </p>
        </div>
        
        {!isLoading && serviceStatus?.missingSecrets?.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 p-2 rounded-md border border-amber-200">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm text-amber-800">
              Some AI features are limited. Configure API keys for full functionality.
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {getCapabilities().map((capability, index) => (
          <Card 
            key={index} 
            className={`overflow-hidden ${!capability.available ? 'opacity-70' : ''}`}
          >
            <CardHeader>
              <div className="pb-2">
                <div className="flex justify-between items-start">
                  <div className={`p-2 rounded-md ${capability.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {capability.icon}
                  </div>
                  {capability.available ? (
                    <div className="flex items-center text-xs text-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      <span>Available</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-gray-500">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      <span>Requires config</span>
                    </div>
                  )}
                </div>
                <CardTitle>
                  <div className="text-lg mt-2">{capability.name}</div>
                </CardTitle>
                <CardDescription>
                  <div className="text-sm">{capability.description}</div>
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                variant={capability.available ? "default" : "outline"}
                className="w-full"
                onClick={() => handleCapabilityClick(capability)}
                disabled={isLoading}
              >
                {capability.available ? "Use Feature" : "Configure"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}