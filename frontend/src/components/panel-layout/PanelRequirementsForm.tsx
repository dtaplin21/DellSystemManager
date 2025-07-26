'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Package, 
  Ruler, 
  Settings, 
  MapPin, 
  Save, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Upload,
  Brain,
  Download,
  Info
} from 'lucide-react';
import { 
  getPanelRequirements, 
  savePanelRequirements, 
  updatePanelRequirements,
  getPanelRequirementsAnalysis,
  uploadDocument,
  fetchDocuments,
  downloadDocument,
  automateLayout,
  analyzeDocumentsForPanelRequirements
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface PanelRequirementsFormProps {
  projectId: string;
  onRequirementsChange?: (requirements: any, confidence: number) => void;
  onLayoutGenerated?: (result: any) => void;
}

interface PanelRequirements {
  panelSpecifications?: {
    panelCount?: number;
    dimensions?: string;
    materials?: string;
    panelNumbers?: string[];
  };
  materialRequirements?: {
    primaryMaterial?: string;
    thickness?: string;
    seamRequirements?: string;
    secondaryMaterial?: string;
  };
  rollInventory?: {
    rolls?: Array<{
      id: string;
      dimensions: string;
      quantity: number;
    }>;
    totalQuantity?: number;
  };
  installationNotes?: {
    requirements?: string;
    constraints?: string;
    notes?: string;
  };
  siteDimensions?: {
    width?: number;
    length?: number;
    terrainType?: string;
  };
}

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export default function PanelRequirementsForm({ projectId, onRequirementsChange, onLayoutGenerated }: PanelRequirementsFormProps) {
  const { toast } = useToast();
  const [requirements, setRequirements] = useState<PanelRequirements>({});
  const [confidence, setConfidence] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('ai-analysis');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [selectedDocumentsForAnalysis, setSelectedDocumentsForAnalysis] = useState<string[]>([]);

  useEffect(() => {
    loadRequirements();
    loadDocuments();
  }, [projectId]);

  const loadRequirements = async () => {
    try {
      setLoading(true);
      const response = await getPanelRequirements(projectId);
      if (response.success) {
        setRequirements(response.requirements || {});
        setConfidence(response.confidence || 0);
        
        // Load analysis
        const analysisResponse = await getPanelRequirementsAnalysis(projectId);
        if (analysisResponse.success) {
          setAnalysis(analysisResponse.analysis);
        }
        
        if (onRequirementsChange) {
          onRequirementsChange(response.requirements, response.confidence);
        }
      }
    } catch (error) {
      console.error('Error loading panel requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await fetchDocuments(projectId);
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const saveRequirements = async () => {
    try {
      setSaving(true);
      const response = await savePanelRequirements(projectId, requirements);
      if (response.success) {
        setConfidence(response.confidence);
        setAnalysis(response.analysis);
        if (onRequirementsChange) {
          onRequirementsChange(response.requirements, response.confidence);
        }
        toast({
          title: 'Success',
          description: 'Panel requirements saved successfully',
        });
      }
    } catch (error) {
      console.error('Error saving panel requirements:', error);
      toast({
        title: 'Error',
        description: 'Failed to save panel requirements',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await uploadDocument(projectId, file);
      }
      
      toast({
        title: 'Success',
        description: 'Documents uploaded successfully',
      });
      
      loadDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload documents',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocument = async (documentId: string, filename: string) => {
    try {
      const blob = await downloadDocument(documentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateLayout = async () => {
    if (confidence < 50) {
      toast({
        title: 'Insufficient Requirements',
        description: 'Please complete more requirements before generating layout',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      console.log('🚀 Starting AI layout generation with requirements:', requirements);
      
      const result = await automateLayout(
        projectId,
        [], // panels array (empty for now, as AI generates new ones)
        documents // Use uploaded documents
      );

      console.log('🎯 AI layout generation result:', result);
      
      if (onLayoutGenerated) {
        onLayoutGenerated(result);
      }

      if (result.status === 'success') {
        toast({
          title: 'Success',
          description: 'Panel layout generated successfully!',
        });
      } else if (result.status === 'insufficient_information') {
        toast({
          title: 'Insufficient Information',
          description: 'Please provide more requirements for accurate panel generation',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Layout generation error:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate panel layout',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleAIAnalysis = async () => {
    if (selectedDocumentsForAnalysis.length === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select at least one document for AI analysis',
        variant: 'destructive',
      });
      return;
    }

    setAiAnalyzing(true);
    try {
      console.log('🤖 Starting AI analysis of documents:', selectedDocumentsForAnalysis);
      
      // Get the selected documents
      const documentsToAnalyze = documents.filter(doc => 
        selectedDocumentsForAnalysis.includes(doc.id)
      );

      const result = await analyzeDocumentsForPanelRequirements(projectId, documentsToAnalyze);
      
      console.log('✅ AI analysis result:', result);

      if (result.success) {
        // Auto-populate form with extracted requirements
        setRequirements(result.requirements);
        setConfidence(result.confidence);
        setAiAnalysisResult(result.analysis);
        
        // Update parent component
        if (onRequirementsChange) {
          onRequirementsChange(result.requirements, result.confidence);
        }

        toast({
          title: 'AI Analysis Complete',
          description: `Successfully extracted requirements with ${result.confidence}% confidence`,
        });

        // Show missing requirements if any
        if (result.missingRequirements && Object.keys(result.missingRequirements).length > 0) {
          toast({
            title: 'Missing Information Detected',
            description: 'Some requirements could not be extracted. Please review and complete manually.',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Analysis Failed',
          description: result.error || 'Failed to analyze documents',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      toast({
        title: 'Error',
        description: 'Failed to analyze documents with AI',
        variant: 'destructive',
      });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocumentsForAnalysis(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const updateField = (section: keyof PanelRequirements, field: string, value: any) => {
    setRequirements(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const tabs = [
    { id: 'ai-analysis', label: 'AI Analysis', icon: Brain },
    { id: 'panel-specs', label: 'Panel Specifications', icon: FileText },
    { id: 'materials', label: 'Material Requirements', icon: Package },
    { id: 'rolls', label: 'Roll Inventory', icon: Ruler },
    { id: 'installation', label: 'Installation Notes', icon: Settings },
    { id: 'site', label: 'Site Dimensions', icon: MapPin },
    { id: 'documents', label: 'Documents', icon: Upload },
  ];

  const getStatusColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (confidence: number) => {
    if (confidence >= 80) return <CheckCircle className="h-4 w-4" />;
    if (confidence >= 50) return <AlertCircle className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading panel requirements...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Confidence Score and Generate Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Panel Layout Requirements
              </CardTitle>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Confidence:</span>
                <span className={`text-lg font-semibold ${getStatusColor(confidence)} flex items-center`}>
                  {getStatusIcon(confidence)}
                  <span className="ml-1">{confidence}%</span>
                </span>
                <Progress value={confidence} className="w-24" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                onClick={saveRequirements} 
                disabled={saving}
                variant="outline"
                className="flex items-center space-x-2"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{saving ? 'Saving...' : 'Save Requirements'}</span>
              </Button>
              <Button 
                onClick={handleGenerateLayout}
                disabled={generating || confidence < 50}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
                <span>{generating ? 'Generating...' : 'Generate Layout'}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <Card>
        <CardContent className="p-6">
          {activeTab === 'ai-analysis' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">AI Document Analysis</h3>
                <Button
                  onClick={handleAIAnalysis}
                  disabled={aiAnalyzing || selectedDocumentsForAnalysis.length === 0}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
                >
                  {aiAnalyzing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4" />
                      <span>Analyze Documents</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900">How AI Analysis Works</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Select documents below and click "Analyze Documents" to automatically extract panel requirements. 
                      The AI will analyze your documents and populate the form fields with extracted information.
                    </p>
                  </div>
                </div>
              </div>

              {/* Document Selection */}
              <div className="space-y-4">
                <h4 className="font-semibold">Select Documents for Analysis</h4>
                <div className="grid gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedDocumentsForAnalysis.includes(doc.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleDocumentSelection(doc.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocumentsForAnalysis.includes(doc.id)}
                        onChange={() => toggleDocumentSelection(doc.id)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(doc.uploadedAt).toLocaleDateString()} • {doc.type}
                        </p>
                      </div>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Upload className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No documents uploaded yet.</p>
                      <p className="text-sm">Upload documents in the Documents tab to analyze them.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Analysis Results */}
              {aiAnalysisResult && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Analysis Results</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-900">Analysis Complete</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Document Types Analyzed:</span>
                        <p className="text-gray-600">{aiAnalysisResult.documentTypes?.join(', ') || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="font-medium">Panel Specifications Found:</span>
                        <p className="text-gray-600">{aiAnalysisResult.panelSpecifications?.length || 0} panels</p>
                      </div>
                      <div>
                        <span className="font-medium">Roll Information Found:</span>
                        <p className="text-gray-600">{aiAnalysisResult.rollInformation?.length || 0} rolls</p>
                      </div>
                      <div>
                        <span className="font-medium">Material Requirements:</span>
                        <p className="text-gray-600">{aiAnalysisResult.materialRequirements ? 'Extracted' : 'Not found'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Confidence Indicator */}
              {confidence > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Extraction Confidence</h4>
                  <div className="flex items-center space-x-3">
                    <Progress value={confidence} className="flex-1" />
                    <span className={`font-semibold ${getStatusColor(confidence)}`}>
                      {confidence}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {confidence >= 80 
                      ? 'High confidence - Most requirements extracted successfully'
                      : confidence >= 50 
                        ? 'Medium confidence - Some requirements may need manual review'
                        : 'Low confidence - Please review and complete requirements manually'
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'panel-specs' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Panel Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="panelCount">Number of Panels</Label>
                  <Input
                    id="panelCount"
                    type="number"
                    value={requirements.panelSpecifications?.panelCount || ''}
                    onChange={(e) => updateField('panelSpecifications', 'panelCount', parseInt(e.target.value) || undefined)}
                    placeholder="e.g., 24"
                  />
                </div>
                <div>
                  <Label htmlFor="dimensions">Panel Dimensions</Label>
                  <Input
                    id="dimensions"
                    value={requirements.panelSpecifications?.dimensions || ''}
                    onChange={(e) => updateField('panelSpecifications', 'dimensions', e.target.value)}
                    placeholder="e.g., 20ft x 100ft"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="materials">Panel Materials</Label>
                  <Textarea
                    id="materials"
                    value={requirements.panelSpecifications?.materials || ''}
                    onChange={(e) => updateField('panelSpecifications', 'materials', e.target.value)}
                    placeholder="Describe the materials used for panels..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Material Requirements</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryMaterial">Primary Material</Label>
                  <Input
                    id="primaryMaterial"
                    value={requirements.materialRequirements?.primaryMaterial || ''}
                    onChange={(e) => updateField('materialRequirements', 'primaryMaterial', e.target.value)}
                    placeholder="e.g., HDPE Geomembrane"
                  />
                </div>
                <div>
                  <Label htmlFor="thickness">Material Thickness</Label>
                  <Input
                    id="thickness"
                    value={requirements.materialRequirements?.thickness || ''}
                    onChange={(e) => updateField('materialRequirements', 'thickness', e.target.value)}
                    placeholder="e.g., 60 mil"
                  />
                </div>
                <div>
                  <Label htmlFor="seamRequirements">Seam Requirements</Label>
                  <Textarea
                    id="seamRequirements"
                    value={requirements.materialRequirements?.seamRequirements || ''}
                    onChange={(e) => updateField('materialRequirements', 'seamRequirements', e.target.value)}
                    placeholder="Describe seam requirements and methods..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="secondaryMaterial">Secondary Material (if applicable)</Label>
                  <Input
                    id="secondaryMaterial"
                    value={requirements.materialRequirements?.secondaryMaterial || ''}
                    onChange={(e) => updateField('materialRequirements', 'secondaryMaterial', e.target.value)}
                    placeholder="e.g., Geotextile backing"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rolls' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Roll Inventory</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="rollDimensions">Roll Dimensions</Label>
                    <Input
                      id="rollDimensions"
                      value={requirements.rollInventory?.rolls?.[0]?.dimensions || ''}
                      onChange={(e) => updateField('rollInventory', 'rolls', [{
                        id: '1',
                        dimensions: e.target.value,
                        quantity: requirements.rollInventory?.rolls?.[0]?.quantity || 1
                      }])}
                      placeholder="e.g., 20ft x 100ft"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rollQuantity">Quantity Available</Label>
                    <Input
                      id="rollQuantity"
                      type="number"
                      value={requirements.rollInventory?.rolls?.[0]?.quantity || ''}
                      onChange={(e) => updateField('rollInventory', 'rolls', [{
                        id: '1',
                        dimensions: requirements.rollInventory?.rolls?.[0]?.dimensions || '',
                        quantity: parseInt(e.target.value) || 0
                      }])}
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="totalQuantity">Total Quantity</Label>
                    <Input
                      id="totalQuantity"
                      type="number"
                      value={requirements.rollInventory?.totalQuantity || ''}
                      onChange={(e) => updateField('rollInventory', 'totalQuantity', parseInt(e.target.value) || undefined)}
                      placeholder="e.g., 100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'installation' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Installation Notes</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="requirements">Installation Requirements</Label>
                  <Textarea
                    id="requirements"
                    value={requirements.installationNotes?.requirements || ''}
                    onChange={(e) => updateField('installationNotes', 'requirements', e.target.value)}
                    placeholder="Describe specific installation requirements..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="constraints">Installation Constraints</Label>
                  <Textarea
                    id="constraints"
                    value={requirements.installationNotes?.constraints || ''}
                    onChange={(e) => updateField('installationNotes', 'constraints', e.target.value)}
                    placeholder="Describe any constraints or limitations..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={requirements.installationNotes?.notes || ''}
                    onChange={(e) => updateField('installationNotes', 'notes', e.target.value)}
                    placeholder="Any additional notes or special considerations..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'site' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Site Dimensions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="siteWidth">Site Width (ft)</Label>
                  <Input
                    id="siteWidth"
                    type="number"
                    value={requirements.siteDimensions?.width || ''}
                    onChange={(e) => updateField('siteDimensions', 'width', parseInt(e.target.value) || undefined)}
                    placeholder="e.g., 400"
                  />
                </div>
                <div>
                  <Label htmlFor="siteLength">Site Length (ft)</Label>
                  <Input
                    id="siteLength"
                    type="number"
                    value={requirements.siteDimensions?.length || ''}
                    onChange={(e) => updateField('siteDimensions', 'length', parseInt(e.target.value) || undefined)}
                    placeholder="e.g., 400"
                  />
                </div>
                <div>
                  <Label htmlFor="terrainType">Terrain Type</Label>
                  <Select
                    value={requirements.siteDimensions?.terrainType || ''}
                    onValueChange={(value) => updateField('siteDimensions', 'terrainType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select terrain type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="sloped">Sloped</SelectItem>
                      <SelectItem value="irregular">Irregular</SelectItem>
                      <SelectItem value="hilly">Hilly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Project Documents</h3>
              
              {/* Upload Section */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Documents</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload panel specifications, material data, site plans, and other relevant documents
                  </p>
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button variant="outline" disabled={uploading}>
                      {uploading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Documents
                        </>
                      )}
                    </Button>
                  </Label>
                </div>
              </div>

              {/* Documents List */}
              <div className="space-y-2">
                <h4 className="font-semibold">Uploaded Documents</h4>
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(doc.uploadedAt).toLocaleDateString()} • {doc.type}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocument(doc.id, doc.name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {documents.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    No documents uploaded yet. Upload documents to help with panel generation.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Display */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Requirements Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.status === 'insufficient' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Additional information is needed for accurate panel generation. Please complete the missing fields above.
                </AlertDescription>
              </Alert>
            )}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Recommendations:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {analysis.recommendations.map((rec: string, index: number) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 