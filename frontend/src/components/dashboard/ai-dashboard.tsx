import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useProjects } from '@/contexts/ProjectsProvider';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Brain, Lightbulb, AlertTriangle, Check, Zap, FastForward, ArrowRight, FolderOpen } from 'lucide-react';

interface AICapability {
  name: string;
  icon: React.ReactNode;
  description: string;
  route: string;
  available: boolean;
  requiredServices: string[];
  projectSpecific?: boolean;
}

const AI_CAPABILITIES: AICapability[] = [
  {
    name: 'Document Analysis',
    icon: <Brain className="h-6 w-6" />,
    description: 'Automatically analyze project documents to extract key information and patterns.',
    route: '/dashboard/ai',
    available: true,
    requiredServices: [],
    projectSpecific: true
  },
  {
    name: 'QC Data Analysis',
    icon: <Lightbulb className="h-6 w-6" />,
    description: 'Detect anomalies and patterns in your quality control data.',
    route: '/dashboard/qc-data',
    available: true,
    requiredServices: [],
    projectSpecific: true
  },
  {
    name: 'Panel Layout Optimization',
    icon: <Zap className="h-6 w-6" />,
    description: 'Automatically optimize your panel layout for efficiency and reduced waste.',
    route: '/dashboard/projects',
    available: true,
    requiredServices: [],
    projectSpecific: true
  },
  {
    name: 'Smart Recommendations',
    icon: <FastForward className="h-6 w-6" />,
    description: 'Get personalized recommendations based on your project data.',
    route: '/dashboard/ai',
    available: false,
    requiredServices: ['ai.openai'],
    projectSpecific: true
  },
  {
    name: 'Automated Reporting',
    icon: <ArrowRight className="h-6 w-6" />,
    description: 'Generate comprehensive project reports with a single click.',
    route: '/dashboard/ai',
    available: false,
    requiredServices: ['ai.openai'],
    projectSpecific: true
  }
];

export default function AIDashboard() {
  const [serviceStatus, setServiceStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();
  const { selectedProject, selectedProjectId } = useProjects();
  const router = useRouter();

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

    // Navigate to the appropriate route with project context
    if (capability.projectSpecific && selectedProjectId) {
      if (capability.route === '/dashboard/ai') {
        router.push(`/dashboard/ai?projectId=${selectedProjectId}`);
      } else if (capability.route === '/dashboard/qc-data') {
        router.push(`/dashboard/qc-data?projectId=${selectedProjectId}`);
      } else if (capability.route === '/dashboard/projects') {
        router.push(`/dashboard/projects/${selectedProjectId}/panel-layout`);
      }
    } else {
      // For non-project-specific features, navigate to the route directly
      router.push(capability.route);
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">
            {selectedProject ? `AI Automation - ${selectedProject.name}` : 'AI Automation'}
          </h2>
          <p className="text-muted-foreground">
            {selectedProject 
              ? `Leverage AI to automate tasks and gain insights from your "${selectedProject.name}" project data.`
              : 'Select a project to access AI automation features.'
            }
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

      {!selectedProject ? (
        <div className="text-center py-12">
          <FolderOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Selected</h3>
          <p className="text-gray-600 mb-6">
            Please select a project to access AI automation features.
          </p>
          <Button 
            onClick={() => router.push('/dashboard/projects')}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Browse Projects
          </Button>
        </div>
      ) : (
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
      )}
    </div>
  );
}