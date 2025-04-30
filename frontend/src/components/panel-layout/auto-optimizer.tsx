import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Maximize, 
  Minimize, 
  RefreshCw, 
  XCircle, 
  Zap, 
  ArrowRight, 
  Check,
  PanelLeftClose,
  PanelRightClose
} from 'lucide-react';

interface PanelOptimizationProps {
  projectId: string;
  onOptimizationComplete?: (results: any) => void;
  currentWastePercentage?: number;
}

export default function PanelLayoutAutoOptimizer({ 
  projectId, 
  onOptimizationComplete,
  currentWastePercentage = 15.3
}: PanelOptimizationProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const runOptimization = async () => {
    setIsOptimizing(true);
    setError(null);

    try {
      // In a real implementation, this would be an API call
      // const response = await axios.post(`/api/projects/${projectId}/panels/optimize`);
      // setOptimizationResults(response.data);
      
      // For demonstration, simulate an API call with a delay
      setTimeout(() => {
        // Mock optimization results
        const mockResults = {
          before: {
            totalPanels: 48,
            wastePercentage: currentWastePercentage,
            totalMaterialArea: 1250.5,
            totalAreaUsed: 1059.2,
            estimatedCost: 18750
          },
          after: {
            totalPanels: 45,
            wastePercentage: 8.7,
            totalMaterialArea: 1200.8,
            totalAreaUsed: 1096.3,
            estimatedCost: 18012
          },
          savings: {
            wasteReduction: currentWastePercentage - 8.7,
            materialSaved: 49.7,
            costSaved: 738,
            percentageSaved: 3.9
          },
          changesSummary: [
            "Combined 3 small panels in north section",
            "Realigned panels along east boundary",
            "Rotated 5 panels to optimize material usage",
            "Modified seam locations to reduce waste cuts"
          ]
        };
        
        setOptimizationResults(mockResults);
        
        if (onOptimizationComplete) {
          onOptimizationComplete(mockResults);
        }
        
        setIsOptimizing(false);
        
        toast({
          title: "Optimization Complete",
          description: `Panel layout optimized, reducing waste by ${mockResults.savings.wasteReduction.toFixed(1)}%`,
        });
      }, 3000);
      
    } catch (err) {
      setError('Failed to optimize panel layout. Please try again.');
      toast({
        title: 'Optimization Failed',
        description: 'Could not complete the panel layout optimization. Please check your connection and try again.',
        variant: 'destructive',
      });
      setIsOptimizing(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Zap className="h-5 w-5 mr-2 text-amber-500" />
            <span>Panel Layout Optimizer</span>
          </div>
          {optimizationResults && (
            <div className="flex items-center text-xs space-x-1 text-green-600 bg-green-50 px-2 py-1 rounded">
              <Check className="h-3 w-3" />
              <span>Optimization Complete</span>
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Automatically optimize your panel layout to reduce waste and lower material costs
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {!optimizationResults && (
          <div>
            <div className="bg-blue-50 p-4 rounded-md mb-6 border border-blue-100">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Current Layout Metrics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-blue-600">Current Waste</div>
                  <div className="text-lg font-semibold">{currentWastePercentage}%</div>
                </div>
                <div>
                  <div className="text-xs text-blue-600">Optimization Potential</div>
                  <div className="text-lg font-semibold text-amber-500">High</div>
                </div>
              </div>
            </div>
            
            <div className="text-sm mb-5">
              The optimizer will analyze your current panel layout and recommend adjustments to:
              <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
                <li>Reduce material waste</li>
                <li>Optimize panel dimensions</li>
                <li>Improve panel placement and alignment</li>
                <li>Lower overall material costs</li>
              </ul>
            </div>
            
            <Button 
              onClick={runOptimization} 
              disabled={isOptimizing}
              className="w-full"
            >
              {isOptimizing ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> 
                  Optimizing Layout...
                </>
              ) : (
                <>
                  Run Automatic Optimization
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
        
        {optimizationResults && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 p-3 rounded-md border border-green-100 col-span-3 md:col-span-1">
                <div className="text-sm text-green-600 font-medium">Waste Reduction</div>
                <div className="text-xl font-bold">{optimizationResults.savings.wasteReduction.toFixed(1)}%</div>
                <div className="text-xs text-green-500 mt-1">Material savings</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-md border border-blue-100 col-span-3 md:col-span-1">
                <div className="text-sm text-blue-600 font-medium">Panel Count</div>
                <div className="text-xl font-bold">{optimizationResults.after.totalPanels} 
                  <span className="text-sm text-blue-400 ml-1">
                    (-{optimizationResults.before.totalPanels - optimizationResults.after.totalPanels})
                  </span>
                </div>
                <div className="text-xs text-blue-500 mt-1">Simplified layout</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-md border border-amber-100 col-span-3 md:col-span-1">
                <div className="text-sm text-amber-600 font-medium">Cost Savings</div>
                <div className="text-xl font-bold">${optimizationResults.savings.costSaved}</div>
                <div className="text-xs text-amber-500 mt-1">{optimizationResults.savings.percentageSaved}% reduction</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-md border">
                <h3 className="text-sm font-semibold mb-2 flex items-center">
                  <PanelLeftClose className="h-4 w-4 mr-1" />
                  Before Optimization
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Waste Percentage:</span>
                    <span className="font-medium">{optimizationResults.before.wastePercentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Material Area:</span>
                    <span className="font-medium">{optimizationResults.before.totalMaterialArea} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Area Used:</span>
                    <span className="font-medium">{optimizationResults.before.totalAreaUsed} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Cost:</span>
                    <span className="font-medium">${optimizationResults.before.estimatedCost}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-green-50 rounded-md border border-green-100">
                <h3 className="text-sm font-semibold mb-2 flex items-center text-green-700">
                  <PanelRightClose className="h-4 w-4 mr-1" />
                  After Optimization
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-600">Waste Percentage:</span>
                    <span className="font-medium">{optimizationResults.after.wastePercentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Total Material Area:</span>
                    <span className="font-medium">{optimizationResults.after.totalMaterialArea} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Total Area Used:</span>
                    <span className="font-medium">{optimizationResults.after.totalAreaUsed} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Estimated Cost:</span>
                    <span className="font-medium">${optimizationResults.after.estimatedCost}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-2">Recommended Changes</h3>
              <ul className="space-y-1">
                {optimizationResults.changesSummary.map((change, idx) => (
                  <li key={idx} className="text-sm flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-1 mt-0.5 flex-shrink-0" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setOptimizationResults(null)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Again
              </Button>
              <Button>
                Apply Changes
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}