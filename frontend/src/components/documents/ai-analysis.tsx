'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, RefreshCw } from 'lucide-react';
import { analyzeDocuments, uploadDocument, fetchDocuments } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AIAnalysisProps {
  projectId: string;
  documents: any[];
  onDocumentsUpdate?: (documents: any[]) => void;
}

export default function AIAnalysis({ projectId, documents, onDocumentsUpdate }: AIAnalysisProps) {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'question'>('question');
  const [uploading, setUploading] = useState(false);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);
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
      
      console.log('🔍 AI Analysis started:', {
        projectId,
        selectedDocuments,
        question,
        activeTab
      });
      
      // Use the user's question directly
      let analysisQuestion = question;
      
      console.log('🤖 Calling analyzeDocuments with question:', analysisQuestion);
      const result = await analyzeDocuments(projectId, selectedDocuments, analysisQuestion);
      console.log('✅ AI Analysis result:', result);
      
      setAnalysisResult(result);
      
      toast({
        title: 'Analysis Complete',
        description: 'AI has completed analyzing the selected documents.',
      });
    } catch (error) {
      console.error('❌ AI Analysis failed:', error);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(projectId, file);
      }
      
      // Refresh documents list
      const updatedDocuments = await fetchDocuments(projectId);
      if (onDocumentsUpdate) {
        onDocumentsUpdate(updatedDocuments);
      }
      
      toast({
        title: 'Upload Successful',
        description: `${files.length} file(s) uploaded successfully.`,
      });
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload files. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
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
      {/* Hidden file input for uploads */}
      <input
        ref={setFileInputRef}
        type="file"
        multiple
        accept=".pdf,.xlsx,.xls,.dwg,.dxf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardContent>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Select Documents</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef?.click()}
                    disabled={uploading}
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    {uploading ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3 mr-1" />
                    )}
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
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
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          <Card>
            <CardContent>
              <div className="p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold">Ask a Question</h3>
                </div>
                
                <div className="space-y-4">
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
                      {analysisResult.answer}
                    </div>
                    
                    {analysisResult.references && analysisResult.references.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-2">References</h4>
                        <div className="bg-gray-50 p-4 rounded-md">
                          {analysisResult.references.map((ref: any, index: number) => (
                            <div key={index} className="mb-2 text-sm">
                              <strong>Document {index + 1}:</strong> {ref.excerpt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {analysisResult.tokensUsed && (
                      <div className="mt-2 text-xs text-gray-500">
                        Tokens used: {analysisResult.tokensUsed}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
