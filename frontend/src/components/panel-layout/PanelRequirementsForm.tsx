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
  getPanelRequirements, 
  savePanelRequirements, 
  updatePanelRequirements,
  getPanelRequirementsAnalysis 
} from '@/lib/api';
import { 
  FileText, 
  Package, 
  Ruler, 
  Settings, 
  MapPin, 
  Save, 
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface PanelRequirementsFormProps {
  projectId: string;
  onRequirementsChange?: (requirements: any, confidence: number) => void;
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

export default function PanelRequirementsForm({ projectId, onRequirementsChange }: PanelRequirementsFormProps) {
  const [requirements, setRequirements] = useState<PanelRequirements>({});
  const [confidence, setConfidence] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('panel-specs');

  useEffect(() => {
    loadRequirements();
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
      }
    } catch (error) {
      console.error('Error saving panel requirements:', error);
    } finally {
      setSaving(false);
    }
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
    { id: 'panel-specs', label: 'Panel Specifications', icon: FileText },
    { id: 'materials', label: 'Material Requirements', icon: Package },
    { id: 'rolls', label: 'Roll Inventory', icon: Ruler },
    { id: 'installation', label: 'Installation Notes', icon: Settings },
    { id: 'site', label: 'Site Dimensions', icon: MapPin },
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
      {/* Header with Confidence Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Panel Layout Requirements
            </CardTitle>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-600">Confidence Score</div>
                <div className={`text-lg font-semibold ${getStatusColor(confidence)} flex items-center`}>
                  {getStatusIcon(confidence)}
                  <span className="ml-1">{confidence}%</span>
                </div>
              </div>
              <Progress value={confidence} className="w-24" />
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
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={saveRequirements} 
          disabled={saving}
          className="flex items-center space-x-2"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{saving ? 'Saving...' : 'Save Requirements'}</span>
        </Button>
      </div>

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