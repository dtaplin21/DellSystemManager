import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useProjects } from '@/contexts/ProjectsProvider';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Brain,
  Lightbulb,
  AlertTriangle,
  Check,
  Zap,
  FastForward,
  ArrowRight,
  FolderOpen,
  Users,
  Share2,
  Activity,
  GitBranch
} from 'lucide-react';

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
    route: '/dashboard/projects/[id]/ai-workspace',
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
    route: '/dashboard/projects/[id]/ai-workspace',
    available: false,
    requiredServices: ['ai.openai'],
    projectSpecific: true
  },
  {
    name: 'Automated Reporting',
    icon: <ArrowRight className="h-6 w-6" />,
    description: 'Generate comprehensive project reports with a single click.',
    route: '/dashboard/projects/[id]/ai-workspace',
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

  const orchestratorInfo = serviceStatus?.services?.ai?.orchestrator;
  const orchestratorCapabilities = orchestratorInfo?.capabilities || {};
  const capabilityDefinitions = [
    {
      key: 'multiAgent',
      label: 'Multi-agent crews',
      description: 'Coordinate specialized agents for a single workflow run.'
    },
    {
      key: 'delegation',
      label: 'Delegation support',
      description: 'Agents can hand off subtasks to peers during execution.'
    },
    {
      key: 'sharedContext',
      label: 'Shared context memory',
      description: 'Cross-workflow memory keeps agents aligned with project history.'
    },
    {
      key: 'realTimeCollaboration',
      label: 'Real-time collaboration',
      description: 'Live collaboration channel keeps crews synchronized.'
    },
    {
      key: 'dynamicWorkflows',
      label: 'Dynamic workflows',
      description: 'Blueprints can be registered or updated without redeploys.'
    }
  ];

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
    if (capability.projectSpecific) {
      if (!selectedProjectId) {
        toast({
          title: 'Select a project',
          description: 'Choose a project to open this AI workspace.',
          variant: 'destructive'
        });
        return;
      }

      const targetRoute = capability.route.includes('[id]')
        ? capability.route.replace('[id]', selectedProjectId)
        : capability.route === '/dashboard/qc-data'
          ? `/dashboard/qc-data?projectId=${selectedProjectId}`
          : capability.route === '/dashboard/projects'
            ? `/dashboard/projects/${selectedProjectId}/panel-layout`
            : capability.route;

      router.push(targetRoute);
      return;
    }

    // For non-project-specific features, navigate to the route directly
    router.push(capability.route);
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

          {orchestratorInfo && (
            <Card className="col-span-1 md:col-span-2 lg:col-span-3 border border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-500" />
                  Agent Orchestration
                </CardTitle>
                <CardDescription>
                  Real-time view of the CrewAI-powered workflows coordinating multiple agents.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orchestratorInfo.available ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                        <Share2 className="h-4 w-4" />
                        Collaboration Capabilities
                      </div>
                      <ul className="space-y-3">
                        {capabilityDefinitions.map(capability => (
                          <li key={capability.key} className="flex items-start gap-3">
                            {orchestratorCapabilities[capability.key] ? (
                              <Check className="h-4 w-4 text-green-600 mt-1" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-1" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{capability.label}</p>
                              <p className="text-xs text-muted-foreground">{capability.description}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="h-4 w-4" />
                        Last synced {orchestratorInfo.generatedAt ? new Date(orchestratorInfo.generatedAt * 1000).toLocaleString() : 'recently'}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                        <GitBranch className="h-4 w-4" />
                        Registered Workflows
                      </div>
                      <ul className="space-y-3">
                        {(orchestratorInfo.workflows || []).map((workflow: any) => (
                          <li key={workflow.id} className="rounded-md border p-3 bg-muted/40">
                            <p className="text-sm font-medium">{workflow.name}</p>
                            <p className="text-xs text-muted-foreground">{workflow.description}</p>
                            <div className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">Process: {workflow.process}</div>
                            <div className="mt-2 text-[11px] text-muted-foreground">
                              Agents: {workflow.agents?.map((agent: any) => agent.name).join(', ')}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Agent orchestrator unavailable</p>
                      <p className="text-sm text-muted-foreground">
                        Deploy the Python AI service to unlock collaborative crews and shared memory.
                      </p>
                    </div>
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}