import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import axios from 'axios';
import { AlertTriangle, ArrowRight, Check, FileSpreadsheet, LineChart, Lightbulb, BarChart } from 'lucide-react';

interface QCDataAnalysisProps {
  projectId: string;
  onAnalysisComplete?: (results: any) => void;
}

interface QCDataInsight {
  type: 'anomaly' | 'pattern' | 'recommendation';
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high';
  dataPoints?: number[];
  category?: string;
}

interface AnalysisResult {
  summary: {
    totalSamples: number;
    passedTests: number;
    failedTests: number;
    anomalies: number;
  };
  insights: QCDataInsight[];
  charts?: {
    type: string;
    title: string;
    data: any;
  }[];
}

export default function QCDataAutoAnalysis({ projectId, onAnalysisComplete }: QCDataAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Analysis results will be fetched from API

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`/api/qc-data/${projectId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to run analysis');
      }

      const results = await response.json();
      setAnalysisResults(results);
      
      toast({
        title: 'Analysis Complete',
        description: 'QC data analysis has been completed successfully.',
      });
      
      if (onAnalysisComplete) {
        onAnalysisComplete(results);
      }
    } catch (err) {
      setError('Failed to analyze QC data. Please try again.');
      toast({
        title: 'Analysis Failed',
        description: 'Could not complete the QC data analysis. Please check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-500 bg-red-50 border-red-200';
      case 'medium':
        return 'text-amber-500 bg-amber-50 border-amber-200';
      case 'low':
        return 'text-blue-500 bg-blue-50 border-blue-200';
      default:
        return 'text-green-500 bg-green-50 border-green-200';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'anomaly':
        return <AlertTriangle className="h-5 w-5" />;
      case 'pattern':
        return <LineChart className="h-5 w-5" />;
      case 'recommendation':
        return <Lightbulb className="h-5 w-5" />;
      default:
        return <BarChart className="h-5 w-5" />;
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>
          <div className="flex items-center justify-between">
            <span>QC Data Auto-Analysis</span>
            {analysisResults && (
              <div className="flex items-center text-xs space-x-1 text-green-600 bg-green-50 px-2 py-1 rounded">
                <Check className="h-3 w-3" />
                <span>Analysis Complete</span>
              </div>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          Automatically analyze quality control data to identify patterns, anomalies, and recommendations
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {!analysisResults && (
          <div className="text-center py-6">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-muted-foreground mb-6">
              Let AI analyze your QC data to find patterns, anomalies, and generate recommendations 
              that you might miss with manual review.
            </p>
            
            <Button 
              onClick={runAnalysis} 
              disabled={isAnalyzing}
              className="w-full max-w-xs"
            >
              {isAnalyzing ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> 
                  Analyzing Data...
                </>
              ) : (
                <>
                  Run AI Analysis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
        
        {analysisResults && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                <div className="text-sm text-blue-600 font-medium">Total Samples</div>
                <div className="text-xl font-bold">{analysisResults.summary.totalSamples}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-md border border-green-100">
                <div className="text-sm text-green-600 font-medium">Passed Tests</div>
                <div className="text-xl font-bold">{analysisResults.summary.passedTests}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-md border border-red-100">
                <div className="text-sm text-red-600 font-medium">Failed Tests</div>
                <div className="text-xl font-bold">{analysisResults.summary.failedTests}</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-md border border-amber-100">
                <div className="text-sm text-amber-600 font-medium">Anomalies Found</div>
                <div className="text-xl font-bold">{analysisResults.summary.anomalies}</div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3">Key Insights</h3>
              <div className="space-y-3">
                {analysisResults.insights.map((insight, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-md border flex ${getSeverityColor(insight.severity)}`}
                  >
                    <div className="mr-3 mt-0.5">
                      {getInsightIcon(insight.type)}
                    </div>
                    <div>
                      <h4 className="font-medium">{insight.title}</h4>
                      <p className="text-sm mt-1">{insight.description}</p>
                      {insight.category && (
                        <div className="text-xs mt-2 inline-block px-2 py-0.5 rounded bg-white bg-opacity-50">
                          {insight.category}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setAnalysisResults(null)}>
                Run Analysis Again
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}