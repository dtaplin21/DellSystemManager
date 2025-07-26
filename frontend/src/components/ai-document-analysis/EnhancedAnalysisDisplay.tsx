import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  TrendingUp, 
  Shield,
  Lightbulb,
  Target
} from 'lucide-react';

interface EnhancedAnalysisDisplayProps {
  analysisResult: any;
  className?: string;
}

export function EnhancedAnalysisDisplay({ analysisResult, className = '' }: EnhancedAnalysisDisplayProps) {
  if (!analysisResult || !analysisResult.enhancedFeatures) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No enhanced analysis results available
          </div>
        </CardContent>
      </Card>
    );
  }

  const { validation, confidence, suggestions, riskAssessment } = analysisResult.enhancedFeatures;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'very_low': return 'text-green-600 bg-green-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'very_low': return <CheckCircle className="w-4 h-4" />;
      case 'low': return <Info className="w-4 h-4" />;
      case 'medium': return <AlertTriangle className="w-4 h-4" />;
      case 'high': return <XCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Phase 2 Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Phase 2 Enhanced Analysis
            </CardTitle>
            <Badge variant="outline" className="text-sm">
              Enhanced AI
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Overall Confidence Score */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Overall Confidence Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-2">
                <span>Confidence Level</span>
                <span className="font-semibold">{confidence.overall}%</span>
              </div>
              <Progress value={confidence.overall} className="h-3" />
            </div>
          </div>
          
          {confidence.factors && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {Object.entries(confidence.factors).map(([factor, data]: [string, any]) => (
                <div key={factor} className="flex justify-between">
                  <span className="capitalize">{factor.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="font-medium">{data.score}%</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-orange-600" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {getRiskIcon(riskAssessment.level)}
            <Badge className={getRiskColor(riskAssessment.level)}>
              {riskAssessment.level?.replace('_', ' ').toUpperCase() || 'UNKNOWN'} RISK
            </Badge>
          </div>
          
          {riskAssessment.reasons && riskAssessment.reasons.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Risk Factors:</h4>
              <ul className="text-sm space-y-1">
                {riskAssessment.reasons.map((reason: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {riskAssessment.mitigation && riskAssessment.mitigation.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Mitigation Steps:</h4>
              <ul className="text-sm space-y-1">
                {riskAssessment.mitigation.map((step: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validation && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Data Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={validation.isValid ? "default" : "destructive"}>
                {validation.isValid ? "VALID" : "INVALID"}
              </Badge>
              <span className="text-sm text-gray-600">
                {validation.issues?.length || 0} issues, {validation.warnings?.length || 0} warnings
              </span>
            </div>
            
            {validation.issues && validation.issues.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <h4 className="font-medium">Critical Issues:</h4>
                    <ul className="text-sm space-y-1">
                      {validation.issues.slice(0, 3).map((issue: string, index: number) => (
                        <li key={index}>• {issue}</li>
                      ))}
                      {validation.issues.length > 3 && (
                        <li className="text-gray-500">... and {validation.issues.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {validation.warnings && validation.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <h4 className="font-medium">Warnings:</h4>
                    <ul className="text-sm space-y-1">
                      {validation.warnings.slice(0, 3).map((warning: string, index: number) => (
                        <li key={index}>• {warning}</li>
                      ))}
                      {validation.warnings.length > 3 && (
                        <li className="text-gray-500">... and {validation.warnings.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Intelligent Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              Intelligent Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((suggestion: any, index: number) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {suggestion.priority || suggestion.type || 'info'}
                    </Badge>
                    {suggestion.factor && (
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.factor}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{suggestion.message || suggestion.action}</p>
                  {suggestion.currentScore && (
                    <p className="text-xs text-gray-600 mt-1">
                      Current score: {suggestion.currentScore}%
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Detailed Breakdown */}
      {confidence.details && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Detailed Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(confidence.details).map(([category, data]: [string, any]) => (
              <div key={category} className="border-b pb-3 last:border-b-0">
                <h4 className="font-medium capitalize mb-2">
                  {category.replace(/([A-Z])/g, ' $1').trim()}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(data).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-medium">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 