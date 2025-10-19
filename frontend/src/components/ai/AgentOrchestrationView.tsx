'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  PlayCircle,
  PauseCircle,
  RotateCcw
} from 'lucide-react';

interface AgentStatus {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'waiting' | 'completed' | 'error';
  currentTask: string;
  progress: number;
  lastUpdate: string;
}

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  agent: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  startTime?: string;
  endTime?: string;
}

interface OrchestrationStatus {
  workflowId: string;
  workflowName: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  agents: AgentStatus[];
  steps: WorkflowStep[];
  currentStep: number;
  totalSteps: number;
  startTime?: string;
  estimatedCompletion?: string;
}

interface AgentOrchestrationViewProps {
  projectId: string;
  onStartWorkflow?: (workflowType: string) => void;
  onStopWorkflow?: () => void;
  compact?: boolean;
}

export default function AgentOrchestrationView({ 
  projectId, 
  onStartWorkflow, 
  onStopWorkflow,
  compact = false 
}: AgentOrchestrationViewProps) {
  const [orchestrationStatus, setOrchestrationStatus] = useState<OrchestrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState<string[]>([]);

  useEffect(() => {
    fetchOrchestrationStatus();
    fetchAvailableWorkflows();
  }, [projectId]);

  const fetchOrchestrationStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/ai/orchestration/status/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setOrchestrationStatus(data);
      }
    } catch (error) {
      console.error('Error fetching orchestration status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableWorkflows = async () => {
    try {
      const response = await fetch('/api/ai/orchestration/workflows');
      if (response.ok) {
        const data = await response.json();
        setAvailableWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error('Error fetching available workflows:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle':
        return <PauseCircle className="h-4 w-4 text-gray-400" />;
      case 'working':
        return <PlayCircle className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'bg-gray-100 text-gray-800';
      case 'working':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <Brain className="h-4 w-4 text-purple-500" />
        <span className="text-sm text-gray-600">
          {orchestrationStatus?.status === 'running' ? 'Agents Working...' : 'AI Orchestration'}
        </span>
        {orchestrationStatus?.status === 'running' && (
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <CardTitle>AI Agent Orchestration</CardTitle>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrchestrationStatus}
              disabled={isLoading}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            {orchestrationStatus?.status === 'running' ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={onStopWorkflow}
              >
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onStartWorkflow?.('comprehensive')}
                disabled={isLoading}
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                Start Workflow
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Real-time view of AI agents collaborating on your project
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Workflow Status */}
        {orchestrationStatus && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{orchestrationStatus.workflowName}</h3>
                <p className="text-sm text-gray-600">
                  Step {orchestrationStatus.currentStep} of {orchestrationStatus.totalSteps}
                </p>
              </div>
              <Badge className={getStatusColor(orchestrationStatus.status)}>
                {orchestrationStatus.status.toUpperCase()}
              </Badge>
            </div>

            {orchestrationStatus.status === 'running' && (
              <Progress 
                value={(orchestrationStatus.currentStep / orchestrationStatus.totalSteps) * 100} 
                className="w-full"
              />
            )}

            {/* Active Agents */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Active Agents ({orchestrationStatus.agents.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {orchestrationStatus.agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(agent.status)}
                      <div>
                        <p className="font-medium text-sm">{agent.name}</p>
                        <p className="text-xs text-gray-600">{agent.role}</p>
                        {agent.currentTask && (
                          <p className="text-xs text-blue-600 mt-1">{agent.currentTask}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(agent.status)}>
                        {agent.status}
                      </Badge>
                      {agent.progress > 0 && (
                        <div className="mt-1">
                          <Progress value={agent.progress} className="w-16 h-2" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Steps */}
            <div className="space-y-3">
              <h4 className="font-medium">Workflow Steps</h4>
              <div className="space-y-2">
                {orchestrationStatus.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      step.status === 'active' ? 'border-blue-300 bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        step.status === 'completed' ? 'bg-green-500 text-white' :
                        step.status === 'active' ? 'bg-blue-500 text-white' :
                        step.status === 'error' ? 'bg-red-500 text-white' :
                        'bg-gray-300 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{step.name}</p>
                        <p className="text-xs text-gray-600">{step.description}</p>
                        <p className="text-xs text-blue-600">Agent: {step.agent}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(step.status)}>
                      {step.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No Active Orchestration */}
        {!orchestrationStatus && !isLoading && (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">No Active Orchestration</h3>
            <p className="text-gray-600 mb-4">
              Start a workflow to see AI agents collaborate in real-time
            </p>
            <div className="space-y-2">
              {availableWorkflows.map((workflow) => (
                <Button
                  key={workflow}
                  variant="outline"
                  size="sm"
                  onClick={() => onStartWorkflow?.(workflow)}
                  className="mr-2"
                >
                  Start {workflow.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <span className="ml-2 text-gray-600">Loading orchestration status...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
