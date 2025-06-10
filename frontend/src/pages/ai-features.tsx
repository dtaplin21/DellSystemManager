'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import QCDataAutoAnalysis from '@/components/qc-data/auto-analysis';
import PanelLayoutAutoOptimizer from '@/components/panel-layout/auto-optimizer';
import DocumentAutoExtractor from '@/components/documents/auto-extractor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AIServiceStatus from '@/components/shared/ai-service-status';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Brain, Settings } from 'lucide-react';

export default function AIFeaturesPage() {
  const [activeTab, setActiveTab] = useState('qc-analysis');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const { toast } = useToast();
  
  const handleConfigureAI = () => {
    setShowSettingsDialog(true);
    toast({
      title: "API Configuration",
      description: "To enable enhanced AI features, an OpenAI API key is required.",
    });
  };

  return (
    <div className="container max-w-6xl mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <Brain className="mr-2 h-6 w-6 text-purple-500" />
            AI Automation
          </h1>
          <p className="text-muted-foreground">
            Boost productivity with AI-powered analysis and automation features
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center"
          onClick={handleConfigureAI}
        >
          <Settings className="h-4 w-4 mr-2" />
          Configure AI
        </Button>
      </div>
      
      <div className="mb-6">
        <AIServiceStatus onConfigure={handleConfigureAI} />
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <div className="pb-3">
            <CardTitle>
              <div>AI Feature Showcase</div>
            </CardTitle>
            <CardDescription>
              Explore how AI can automate repetitive tasks and provide valuable insights for your geosynthetic projects
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="qc-analysis">QC Data Analysis</TabsTrigger>
              <TabsTrigger value="panel-optimization">Panel Layout Optimization</TabsTrigger>
              <TabsTrigger value="document-extraction">Document Data Extraction</TabsTrigger>
            </TabsList>
            
            <TabsContent value="qc-analysis" className="mt-0">
              <div className="mb-4">
                <div className="flex items-center p-3 bg-blue-50 text-blue-700 rounded-md">
                  <AlertTriangle className="h-5 w-5 mr-2 text-blue-500" />
                  <p className="text-sm">This is a demonstration of the AI-powered QC data analysis feature. In a real project, this would analyze your actual project data.</p>
                </div>
              </div>
              <QCDataAutoAnalysis projectId="demo-project" />
            </TabsContent>
            
            <TabsContent value="panel-optimization" className="mt-0">
              <div className="mb-4">
                <div className="flex items-center p-3 bg-blue-50 text-blue-700 rounded-md">
                  <AlertTriangle className="h-5 w-5 mr-2 text-blue-500" />
                  <p className="text-sm">This is a demonstration of the AI-powered panel layout optimization feature. In a real project, this would optimize your actual panel designs.</p>
                </div>
              </div>
              <PanelLayoutAutoOptimizer projectId="demo-project" />
            </TabsContent>
            
            <TabsContent value="document-extraction" className="mt-0">
              <div className="mb-4">
                <div className="flex items-center p-3 bg-blue-50 text-blue-700 rounded-md">
                  <AlertTriangle className="h-5 w-5 mr-2 text-blue-500" />
                  <p className="text-sm">This is a demonstration of the AI-powered document extraction feature. In a real project, this would analyze your actual project documents.</p>
                </div>
              </div>
              <DocumentAutoExtractor projectId="demo-project" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="text-lg">AI Features Work Without API Keys</div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              All AI features in this application work with built-in fallback algorithms, even without OpenAI API access. 
              This ensures core functionality is always available.
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="text-lg">Advanced Features with OpenAI</div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              For enhanced analysis quality and detailed recommendations, connect your OpenAI API key. 
              This unlocks the full potential of the AI features.
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="text-lg">Data Privacy & Security</div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Your project data is processed securely. When using built-in algorithms, all processing happens 
              locally. With OpenAI, only necessary data is transmitted securely.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}