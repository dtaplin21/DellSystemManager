'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { analyzeImageAndPopulatePanels, populatePanelLayoutFromAnalysis } from '@/lib/api';

interface ImageAnalysisTabProps {
  projectId: string;
}

interface AnalysisResult {
  panels: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    shape: string;
    notes?: string;
  }>;
  detectedInfo?: {
    area?: string;
    damageType?: string;
    repairType?: string;
    location?: string;
  };
}

export default function ImageAnalysisTab({ projectId }: ImageAnalysisTabProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    material: '',
    thickness: '',
    seamsType: '',
    location: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setAnalysisResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      toast({
        title: 'No image selected',
        description: 'Please select or capture an image first.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeImageAndPopulatePanels(projectId, selectedImage);
      setAnalysisResult(result);
      
      // Pre-fill form with detected info if available
      if (result.detectedInfo) {
        setFormData(prev => ({
          ...prev,
          location: result.detectedInfo?.location || prev.location,
          notes: result.detectedInfo?.damageType || result.detectedInfo?.repairType || prev.notes,
        }));
      }

      toast({
        title: 'Analysis complete',
        description: `Detected ${result.panels.length} panel(s) in the image.`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Failed to analyze image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!analysisResult || analysisResult.panels.length === 0) {
      toast({
        title: 'No analysis data',
        description: 'Please analyze an image first.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await populatePanelLayoutFromAnalysis(projectId, {
        panels: analysisResult.panels,
        formData,
      });

      toast({
        title: 'Success',
        description: `Panel layout populated with ${analysisResult.panels.length} panel(s).`,
      });

      // Reset form
      setSelectedImage(null);
      setImagePreview(null);
      setAnalysisResult(null);
      setFormData({
        material: '',
        thickness: '',
        seamsType: '',
        location: '',
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
    } catch (error) {
      console.error('Submit error:', error);
      toast({
        title: 'Failed to populate layout',
        description: error instanceof Error ? error.message : 'Failed to populate panel layout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Image Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Image</CardTitle>
          <CardDescription>
            Take a photo or upload an image of destruct or repair work
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Camera className="h-4 w-4" />
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload File
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {imagePreview && (
            <div className="relative w-full max-w-md">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-auto rounded-lg border"
              />
              {selectedImage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    setAnalysisResult(null);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={!selectedImage || isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze Image'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Analysis Results
            </CardTitle>
            <CardDescription>
              Detected {analysisResult.panels.length} panel(s). Fill out the form below to complete the workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysisResult.detectedInfo && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold mb-2">Detected Information:</h4>
                <ul className="space-y-1 text-sm">
                  {analysisResult.detectedInfo.area && (
                    <li><strong>Area:</strong> {analysisResult.detectedInfo.area}</li>
                  )}
                  {analysisResult.detectedInfo.damageType && (
                    <li><strong>Damage Type:</strong> {analysisResult.detectedInfo.damageType}</li>
                  )}
                  {analysisResult.detectedInfo.repairType && (
                    <li><strong>Repair Type:</strong> {analysisResult.detectedInfo.repairType}</li>
                  )}
                  {analysisResult.detectedInfo.location && (
                    <li><strong>Location:</strong> {analysisResult.detectedInfo.location}</li>
                  )}
                </ul>
              </div>
            )}

            {/* Form */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material">Material</Label>
                <Input
                  id="material"
                  value={formData.material}
                  onChange={(e) => setFormData(prev => ({ ...prev, material: e.target.value }))}
                  placeholder="e.g., HDPE, PVC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thickness">Thickness</Label>
                <Input
                  id="thickness"
                  value={formData.thickness}
                  onChange={(e) => setFormData(prev => ({ ...prev, thickness: e.target.value }))}
                  placeholder="e.g., 60 mil"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seamsType">Seams Type</Label>
                <Input
                  id="seamsType"
                  value={formData.seamsType}
                  onChange={(e) => setFormData(prev => ({ ...prev, seamsType: e.target.value }))}
                  placeholder="e.g., Standard 6-inch overlap"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., North wall, Section A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes or observations..."
                rows={3}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Populating Layout...
                </>
              ) : (
                'Populate Panel Layout'
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

