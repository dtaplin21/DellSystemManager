'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { analyzeDocuments } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AIAnalysisProps {
  projectId: string;
  documents: any[];
}

export default function AIAnalysis({ projectId, documents }: AIAnalysisProps) {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'question' | 'anomalies' | 'summary'>('question');
  const { toast } = useToast();

  const toggleDocument = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleAnalyze = async () => {
    if (selectedDocuments.length === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select at least one document to analyze.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisResult(null);
      
      // Different analysis based on active tab
      let analysisQuestion = question;
      
      if (activeTab === 'anomalies') {
        analysisQuestion = 'Identify any anomalies, patterns, or outliers in the destructive and trial weld data.';
      } else if (activeTab === 'summary') {
        analysisQuestion = 'Provide a comprehensive summary of these documents, including key dates, results, and panel information.';
      }
      
      const result = await analyzeDocuments(projectId, selectedDocuments, analysisQuestion);
      setAnalysisResult(result);
      
      toast({
        title: 'Analysis Complete',
        description: 'AI has completed analyzing the selected documents.',
      });
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: 'Failed to analyze documents. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setQuestion('');
  };

  const renderDocumentList = () => {
    if (documents.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500">
          No documents available for analysis. Please upload documents first.
        </div>
      );
    }

    return (
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {documents.map(doc => (
          <label key={doc.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={selectedDocuments.includes(doc.id)}
              onChange={() => toggleDocument(doc.id)}
              className="rounded text-blue-600"
            />
            <span className="text-sm">{doc.name}</span>
          </label>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Select Documents</h3>
              {renderDocumentList()}
              <div className="mt-4 flex justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDocuments(documents.map(d => d.id))}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDocuments([])}
                >
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-4">
              <div className="flex space-x-2 mb-4">
                <Button 
                  size="sm" 
                  variant={activeTab === 'question' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('question')}
                >
                  Ask a Question
                </Button>
                <Button 
                  size="sm" 
                  variant={activeTab === 'anomalies' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('anomalies')}
                >
                  Find Anomalies
                </Button>
                <Button 
                  size="sm" 
                  variant={activeTab === 'summary' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('summary')}
                >
                  Generate Summary
                </Button>
              </div>
              
              {activeTab === 'question' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Ask a Question</h3>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="e.g., What are the most common issues in panel seaming?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      disabled={isAnalyzing}
                    />
                    <Button 
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !question.trim()}
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Ask'}
                    </Button>
                  </div>
                </div>
              )}
              
              {activeTab === 'anomalies' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Find Anomalies</h3>
                  <p className="text-sm text-gray-500">
                    AI will analyze your destructive and trial weld data to find patterns and anomalies.
                  </p>
                  <Button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Find Anomalies'}
                  </Button>
                </div>
              )}
              
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Generate Summary</h3>
                  <p className="text-sm text-gray-500">
                    AI will create a comprehensive summary of the selected documents.
                  </p>
                  <Button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Generate Summary'}
                  </Button>
                </div>
              )}
              
              {isAnalyzing && (
                <div className="mt-4 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
                  <p className="mt-2 text-sm text-gray-500">
                    Analyzing documents... This may take a moment.
                  </p>
                </div>
              )}
              
              {analysisResult && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold">Analysis Result</h3>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={handleReset}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md whitespace-pre-line">
                    {analysisResult.analysis}
                  </div>
                  
                  {analysisResult.extractedData && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Extracted Data</h4>
                      <div className="bg-gray-50 p-4 rounded-md overflow-x-auto">
                        <pre className="text-xs">
                          {JSON.stringify(analysisResult.extractedData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
