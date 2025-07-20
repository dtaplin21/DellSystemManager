import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, FileText, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface MissingParameter {
  panelSpecifications: string[];
  siteConstraints: string[];
  materialRequirements: string[];
  rollInformation: string[];
  installationNotes: string[];
}

interface Guidance {
  title: string;
  message: string;
  requiredDocuments: string[];
  recommendedActions: string[];
  confidence?: number;
}

interface Warning {
  type: 'warning' | 'low_confidence' | 'incomplete_panels';
  message: string;
  details: string | string[];
}

interface AIGuidanceDisplayProps {
  status: 'insufficient_information' | 'success' | 'partial' | 'error' | 'fallback';
  guidance?: Guidance;
  missingParameters?: MissingParameter;
  warnings?: Warning[];
  analysis?: any;
  onUploadDocuments?: () => void;
  onViewTemplates?: () => void;
}

export function AIGuidanceDisplay({
  status,
  guidance,
  missingParameters,
  warnings,
  analysis,
  onUploadDocuments,
  onViewTemplates
}: AIGuidanceDisplayProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'insufficient_information':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'partial':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'fallback':
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'insufficient_information':
        return 'border-red-200 bg-red-50';
      case 'partial':
        return 'border-yellow-200 bg-yellow-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'fallback':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'success':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Complete</span>;
      case 'insufficient_information':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Insufficient</span>;
      case 'partial':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Partial</span>;
      case 'error':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Error</span>;
      case 'fallback':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Fallback</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>;
    }
  };

  if (!guidance) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Main Status Alert */}
      <Alert className={getStatusColor()}>
        <div className="flex items-start space-x-3">
          {getStatusIcon()}
          <div className="flex-1">
            <AlertTitle className="flex items-center justify-between">
              {guidance.title}
              {getStatusBadge()}
            </AlertTitle>
            <AlertDescription className="mt-2">
              {guidance.message}
            </AlertDescription>
          </div>
        </div>
      </Alert>

      {/* Analysis Confidence */}
      {analysis?.confidence !== undefined && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Analysis Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    analysis.confidence >= 0.7 ? 'bg-green-500' :
                    analysis.confidence >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${analysis.confidence * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">
                {(analysis.confidence * 100).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Parameters */}
      {missingParameters && Object.values(missingParameters).some(arr => arr.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Missing Information</CardTitle>
            <CardDescription>
              The following information is required for accurate panel generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(missingParameters).map(([category, issues]) => {
              if (issues.length === 0) return null;
              
              const categoryLabels: Record<string, string> = {
                panelSpecifications: 'Panel Specifications',
                siteConstraints: 'Site Constraints',
                materialRequirements: 'Material Requirements',
                rollInformation: 'Roll Information',
                installationNotes: 'Installation Notes'
              };

              return (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-700">
                    {categoryLabels[category] || category}
                  </h4>
                  <ul className="space-y-1">
                    {issues.map((issue: string, index: number) => (
                      <li key={index} className="text-sm text-red-600 flex items-start space-x-2">
                        <span className="text-red-500 mt-1">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Required Documents */}
      {guidance.requiredDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              Required Documents
            </CardTitle>
            <CardDescription>
              Upload these document types to improve panel generation accuracy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {guidance.requiredDocuments.map((doc, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm">
                  <span className="text-red-500">•</span>
                  <span>{doc}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex space-x-2">
              {onUploadDocuments && (
                <Button onClick={onUploadDocuments} size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Documents
                </Button>
              )}
              {onViewTemplates && (
                <Button onClick={onViewTemplates} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  View Templates
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Actions */}
      {guidance.recommendedActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recommended Actions</CardTitle>
            <CardDescription>
              Follow these steps to improve your panel layout generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {guidance.recommendedActions.map((action, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {warnings.map((warning, index) => (
                <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="font-medium text-sm text-yellow-800 mb-1">
                    {warning.message}
                  </div>
                  {typeof warning.details === 'string' ? (
                    <div className="text-sm text-yellow-700">{warning.details}</div>
                  ) : (
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {warning.details.map((detail, detailIndex) => (
                        <li key={detailIndex}>• {detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 