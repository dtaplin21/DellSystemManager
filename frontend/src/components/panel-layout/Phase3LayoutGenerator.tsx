'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateAdvancedLayout } from '@/lib/api';
import { 
  Brain, 
  Zap, 
  Target, 
  TrendingUp, 
  Settings, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Info,
  BarChart3,
  Layers,
  MapPin,
  DollarSign,
  Users,
  Mountain
} from 'lucide-react';

interface Phase3LayoutGeneratorProps {
  projectId: string;
  onLayoutGenerated: (layout: any) => void;
  onProgressUpdate: (progress: number) => void;
}

interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  benefits: string[];
}

interface LayoutAlgorithm {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  complexity: 'low' | 'medium' | 'high';
}

interface GenerationOptions {
  strategy: string;
  algorithm: string;
  optimizationLevel: 'low' | 'medium' | 'high';
  constraints: {
    spacing: number;
    margin: number;
    terrainType: string;
    materialEfficiency: number;
    laborEfficiency: number;
    costOptimization: number;
  };
}

export default function Phase3LayoutGenerator({ 
  projectId, 
  onLayoutGenerated, 
  onProgressUpdate 
}: Phase3LayoutGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationResult, setGenerationResult] = useState<any>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [options, setOptions] = useState<GenerationOptions>({
    strategy: 'balanced',
    algorithm: 'adaptive',
    optimizationLevel: 'high',
    constraints: {
      spacing: 10,
      margin: 50,
      terrainType: 'flat',
      materialEfficiency: 90,
      laborEfficiency: 85,
      costOptimization: 80
    }
  });

  const { toast } = useToast();
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const optimizationStrategies: OptimizationStrategy[] = [
    {
      id: 'balanced',
      name: 'Balanced Approach',
      description: 'Optimizes for material efficiency, labor efficiency, and cost simultaneously',
      icon: <Target className="h-5 w-5" />,
      benefits: ['Optimal overall performance', 'Balanced resource utilization', 'Cost-effective solution']
    },
    {
      id: 'material',
      name: 'Material Efficiency',
      description: 'Maximizes material utilization and minimizes waste',
      icon: <Layers className="h-5 w-5" />,
      benefits: ['Reduced material waste', 'Lower material costs', 'Better roll utilization']
    },
    {
      id: 'labor',
      name: 'Labor Efficiency',
      description: 'Optimizes for faster installation and reduced labor costs',
      icon: <Users className="h-5 w-5" />,
      benefits: ['Faster installation', 'Reduced labor costs', 'Improved workflow']
    },
    {
      id: 'cost',
      name: 'Cost Optimization',
      description: 'Minimizes total project costs while maintaining quality',
      icon: <DollarSign className="h-5 w-5" />,
      benefits: ['Lower total costs', 'Better ROI', 'Budget optimization']
    },
    {
      id: 'terrain',
      name: 'Terrain Adaptive',
      description: 'Adapts layout to complex terrain and elevation changes',
      icon: <Mountain className="h-5 w-5" />,
      benefits: ['Terrain adaptation', 'Elevation optimization', 'Complex site handling']
    }
  ];

  const layoutAlgorithms: LayoutAlgorithm[] = [
    {
      id: 'grid',
      name: 'Grid Placement',
      description: 'Organized grid-based placement for uniform layouts',
      bestFor: 'Regular sites with uniform terrain',
      complexity: 'low'
    },
    {
      id: 'quadrant',
      name: 'Quadrant Placement',
      description: 'Divides site into quadrants for balanced distribution',
      bestFor: 'Large sites with multiple work zones',
      complexity: 'medium'
    },
    {
      id: 'adaptive',
      name: 'Adaptive Placement',
      description: 'Intelligently adapts to terrain and constraints',
      bestFor: 'Complex terrain and irregular sites',
      complexity: 'high'
    },
    {
      id: 'genetic',
      name: 'Genetic Algorithm',
      description: 'Advanced optimization using evolutionary algorithms',
      bestFor: 'Large-scale projects with many constraints',
      complexity: 'high'
    }
  ];

  const handleGenerateLayout = async () => {
    try {
      setIsGenerating(true);
      setGenerationError(null);
      setGenerationProgress(0);
      setGenerationResult(null);

      // Start progress simulation
      startProgressSimulation();

      console.log('🚀 Phase 3: Starting advanced layout generation with options:', options);

      const result = await generateAdvancedLayout(projectId, options);

      // Stop progress simulation
      stopProgressSimulation();

      if (result.success) {
        setGenerationResult(result);
        onLayoutGenerated(result.layout);
        onProgressUpdate(100);
        
        toast({
          title: 'Phase 3 Layout Generated Successfully',
          description: `Generated ${result.layout.length} panels with ${result.optimization.strategy} optimization`,
          variant: 'default'
        });

        console.log('✅ Phase 3: Layout generation completed successfully:', result);
      } else {
        setGenerationError(result.error || 'Layout generation failed');
        onProgressUpdate(0);
        
        toast({
          title: 'Layout Generation Failed',
          description: result.error || 'An error occurred during layout generation',
          variant: 'destructive'
        });

        console.error('❌ Phase 3: Layout generation failed:', result);
      }

    } catch (error) {
      stopProgressSimulation();
      setGenerationError(error instanceof Error ? error.message : 'Unknown error occurred');
      onProgressUpdate(0);
      
      toast({
        title: 'Generation Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });

      console.error('❌ Phase 3: Layout generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const startProgressSimulation = () => {
    let progress = 0;
    progressIntervalRef.current = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) progress = 90; // Don't go to 100% until actual completion
      setGenerationProgress(progress);
      onProgressUpdate(progress);
    }, 500);
  };

  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const handleStrategyChange = (strategy: string) => {
    setOptions(prev => ({ ...prev, strategy }));
  };

  const handleAlgorithmChange = (algorithm: string) => {
    setOptions(prev => ({ ...prev, algorithm }));
  };

  const handleOptimizationLevelChange = (level: 'low' | 'medium' | 'high') => {
    setOptions(prev => ({ ...prev, optimizationLevel: level }));
  };

  const handleConstraintChange = (key: string, value: number | string) => {
    setOptions(prev => ({
      ...prev,
      constraints: {
        ...prev.constraints,
        [key]: value
      }
    }));
  };

  const getStrategyIcon = (strategyId: string) => {
    const strategy = optimizationStrategies.find(s => s.id === strategyId);
    return strategy?.icon || <Target className="h-5 w-5" />;
  };

  const getAlgorithmComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    return () => {
      stopProgressSimulation();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-600" />
            Phase 3: Advanced AI Layout Generation
          </h2>
          <p className="text-gray-600 mt-1">
            Intelligent panel placement with advanced optimization algorithms
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          Phase 3
        </Badge>
      </div>

      {/* Generation Progress */}
      {isGenerating && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="font-medium">Generating Advanced Layout...</span>
                </div>
                <span className="text-sm text-gray-500">{Math.round(generationProgress)}%</span>
              </div>
              <Progress value={generationProgress} className="w-full" />
              <div className="text-sm text-gray-600">
                {generationProgress < 30 && 'Analyzing requirements and constraints...'}
                {generationProgress >= 30 && generationProgress < 60 && 'Generating intelligent panel placement...'}
                {generationProgress >= 60 && generationProgress < 90 && 'Applying advanced optimization...'}
                {generationProgress >= 90 && 'Finalizing layout and analysis...'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {generationError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Generation Error</AlertTitle>
          <AlertDescription>{generationError}</AlertDescription>
        </Alert>
      )}

      {/* Configuration Tabs */}
      <Tabs defaultValue="strategy" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="algorithm">Algorithm</TabsTrigger>
          <TabsTrigger value="constraints">Constraints</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {/* Strategy Configuration */}
        <TabsContent value="strategy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Optimization Strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {optimizationStrategies.map((strategy) => (
                  <Card
                    key={strategy.id}
                    className={`cursor-pointer transition-all ${
                      options.strategy === strategy.id
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleStrategyChange(strategy.id)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <div className="text-blue-600">{strategy.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{strategy.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{strategy.description}</p>
                          <ul className="mt-2 space-y-1">
                            {strategy.benefits.map((benefit, index) => (
                              <li key={index} className="text-xs text-gray-500 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                {benefit}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Algorithm Configuration */}
        <TabsContent value="algorithm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Layout Algorithm
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {layoutAlgorithms.map((algorithm) => (
                  <Card
                    key={algorithm.id}
                    className={`cursor-pointer transition-all ${
                      options.algorithm === algorithm.id
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleAlgorithmChange(algorithm.id)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{algorithm.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{algorithm.description}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            <strong>Best for:</strong> {algorithm.bestFor}
                          </p>
                        </div>
                        <Badge className={getAlgorithmComplexityColor(algorithm.complexity)}>
                          {algorithm.complexity}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Constraints Configuration */}
        <TabsContent value="constraints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Layout Constraints
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Optimization Level */}
              <div className="space-y-2">
                <Label>Optimization Level</Label>
                <Select value={options.optimizationLevel} onValueChange={handleOptimizationLevelChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (Fast)</SelectItem>
                    <SelectItem value="medium">Medium (Balanced)</SelectItem>
                    <SelectItem value="high">High (Thorough)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Spacing */}
              <div className="space-y-2">
                <Label>Panel Spacing: {options.constraints.spacing} ft</Label>
                <Slider
                  value={[options.constraints.spacing]}
                  onValueChange={(value) => handleConstraintChange('spacing', value[0])}
                  max={20}
                  min={5}
                  step={1}
                />
              </div>

              {/* Margin */}
              <div className="space-y-2">
                <Label>Site Margin: {options.constraints.margin} ft</Label>
                <Slider
                  value={[options.constraints.margin]}
                  onValueChange={(value) => handleConstraintChange('margin', value[0])}
                  max={100}
                  min={20}
                  step={5}
                />
              </div>

              {/* Terrain Type */}
              <div className="space-y-2">
                <Label>Terrain Type</Label>
                <Select 
                  value={options.constraints.terrainType} 
                  onValueChange={(value) => handleConstraintChange('terrainType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="sloped">Sloped</SelectItem>
                    <SelectItem value="complex">Complex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Efficiency Targets */}
              <div className="space-y-4">
                <Label>Efficiency Targets</Label>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">Material Efficiency</Label>
                    <span className="text-sm text-gray-500">{options.constraints.materialEfficiency}%</span>
                  </div>
                  <Slider
                    value={[options.constraints.materialEfficiency]}
                    onValueChange={(value) => handleConstraintChange('materialEfficiency', value[0])}
                    max={100}
                    min={70}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">Labor Efficiency</Label>
                    <span className="text-sm text-gray-500">{options.constraints.laborEfficiency}%</span>
                  </div>
                  <Slider
                    value={[options.constraints.laborEfficiency]}
                    onValueChange={(value) => handleConstraintChange('laborEfficiency', value[0])}
                    max={100}
                    min={70}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">Cost Optimization</Label>
                    <span className="text-sm text-gray-500">{options.constraints.costOptimization}%</span>
                  </div>
                  <Slider
                    value={[options.constraints.costOptimization]}
                    onValueChange={(value) => handleConstraintChange('costOptimization', value[0])}
                    max={100}
                    min={70}
                    step={5}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Display */}
        <TabsContent value="results" className="space-y-4">
          {generationResult ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Generation Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{generationResult.layout.length}</div>
                    <div className="text-sm text-gray-600">Panels Generated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{generationResult.confidence}%</div>
                    <div className="text-sm text-gray-600">Confidence Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{generationResult.optimization.strategy}</div>
                    <div className="text-sm text-gray-600">Strategy Used</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{generationResult.optimization.algorithm}</div>
                    <div className="text-sm text-gray-600">Algorithm</div>
                  </div>
                </div>

                {/* Analysis */}
                {generationResult.analysis && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Optimization Analysis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-blue-800">Material Efficiency</div>
                        <div className="text-lg font-bold text-blue-600">
                          {Math.round(generationResult.analysis.improvements.materialEfficiency)}%
                        </div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-green-800">Cost Savings</div>
                        <div className="text-lg font-bold text-green-600">
                          ${Math.round(generationResult.analysis.improvements.costSavings)}
                        </div>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-purple-800">Labor Efficiency</div>
                        <div className="text-lg font-bold text-purple-600">
                          {Math.round(generationResult.analysis.improvements.laborEfficiency)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {generationResult.recommendations && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Recommendations</h4>
                    <ul className="space-y-2">
                      {generationResult.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No results yet. Generate a layout to see results here.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            {getStrategyIcon(options.strategy)}
            {optimizationStrategies.find(s => s.id === options.strategy)?.name}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            {layoutAlgorithms.find(a => a.id === options.algorithm)?.name}
          </Badge>
          <Badge variant="outline">
            {options.optimizationLevel} optimization
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOptions({
                strategy: 'balanced',
                algorithm: 'adaptive',
                optimizationLevel: 'high',
                constraints: {
                  spacing: 10,
                  margin: 50,
                  terrainType: 'flat',
                  materialEfficiency: 90,
                  laborEfficiency: 85,
                  costOptimization: 80
                }
              });
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          <Button
            onClick={handleGenerateLayout}
            disabled={isGenerating}
            className="min-w-[140px]"
          >
            {isGenerating ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Generate Layout
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 