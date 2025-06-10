import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  FileSpreadsheet, 
  ArrowRight, 
  Check, 
  Table, 
  AlertTriangle,
  FileQuestion,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface DocumentExtractorProps {
  projectId: string;
  documentId?: string;
  onExtractionComplete?: (results: any) => void;
}

interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
}

interface ExtractedTable {
  name: string;
  headers: string[];
  rows: string[][];
}

interface ExtractionResult {
  documentType: string;
  confidence: number;
  metadata: {
    date?: string;
    source?: string;
    pageCount?: number;
    documentId?: string;
  };
  fields: ExtractedField[];
  tables: ExtractedTable[];
}

export default function DocumentAutoExtractor({ 
  projectId, 
  documentId,
  onExtractionComplete 
}: DocumentExtractorProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResults, setExtractionResults] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<number | null>(null);
  const { toast } = useToast();

  // Mock data for demonstration purposes
  const mockExtractionResults: ExtractionResult = {
    documentType: "QC Test Report",
    confidence: 0.92,
    metadata: {
      date: "2023-08-15",
      source: "GeoLab Inc.",
      pageCount: 4,
      documentId: documentId || "DOC-12345"
    },
    fields: [
      {
        name: "Project Name",
        value: "Eastern Landfill Expansion",
        confidence: 0.98
      },
      {
        name: "Material Type",
        value: "HDPE Geomembrane",
        confidence: 0.95
      },
      {
        name: "Manufacturer",
        value: "GeoSolutions Inc.",
        confidence: 0.93
      },
      {
        name: "Testing Date",
        value: "2023-08-10",
        confidence: 0.97
      },
      {
        name: "Inspector",
        value: "J. Martinez",
        confidence: 0.91
      }
    ],
    tables: [
      {
        name: "Physical Properties Test Results",
        headers: ["Property", "Test Method", "Required Value", "Test Result", "Status"],
        rows: [
          ["Thickness (mm)", "ASTM D5199", "1.5 min", "1.52", "PASS"],
          ["Density (g/cm³)", "ASTM D1505", "0.94 min", "0.95", "PASS"],
          ["Tensile Strength (kN/m)", "ASTM D6693", "27 min", "29.4", "PASS"],
          ["Tear Resistance (N)", "ASTM D1004", "125 min", "142", "PASS"],
          ["Puncture Resistance (N)", "ASTM D4833", "320 min", "356", "PASS"]
        ]
      },
      {
        name: "Chemical Resistance Test Results",
        headers: ["Chemical", "Concentration", "Exposure Time", "Change in Properties", "Status"],
        rows: [
          ["Leachate", "100%", "56 days", "< 5%", "PASS"],
          ["Diesel Fuel", "100%", "56 days", "< 8%", "PASS"],
          ["Acid Solution (pH 3)", "100%", "56 days", "< 3%", "PASS"]
        ]
      }
    ]
  };

  const runExtraction = async () => {
    setIsExtracting(true);
    setError(null);

    try {
      // In a real implementation, this would be an API call
      // const response = await axios.post(`/api/projects/${projectId}/documents/${documentId}/extract`);
      // setExtractionResults(response.data);
      
      // For demonstration, use mock data with a delay
      setTimeout(() => {
        setExtractionResults(mockExtractionResults);
        
        if (onExtractionComplete) {
          onExtractionComplete(mockExtractionResults);
        }
        
        setIsExtracting(false);
        
        toast({
          title: "Extraction Complete",
          description: `Document analyzed and data extracted with ${mockExtractionResults.confidence * 100}% confidence.`,
        });
      }, 2500);
      
    } catch (err) {
      setError('Failed to extract data from document. Please try again.');
      toast({
        title: 'Extraction Failed',
        description: 'Could not analyze the document. Please check your connection and try again.',
        variant: 'destructive',
      });
      setIsExtracting(false);
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-amber-600';
    return 'text-red-600';
  };

  const toggleTable = (index: number) => {
    if (expandedTable === index) {
      setExpandedTable(null);
    } else {
      setExpandedTable(index);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-500" />
              <span>Document Data Extractor</span>
            </div>
            {extractionResults && (
              <div className="flex items-center text-xs space-x-1 text-green-600 bg-green-50 px-2 py-1 rounded">
                <Check className="h-3 w-3" />
                <span>Extraction Complete</span>
              </div>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          Automatically extract structured data from documents to save manual data entry time
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
        
        {!extractionResults && (
          <div className="text-center py-6">
            <FileQuestion className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-muted-foreground mb-6">
              Let AI analyze your document to extract structured data such as test results, 
              material properties, and project details without manual data entry.
            </p>
            
            <Button 
              onClick={runExtraction} 
              disabled={isExtracting}
              className="w-full max-w-xs"
            >
              {isExtracting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> 
                  Analyzing Document...
                </>
              ) : (
                <>
                  Extract Data
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
        
        {extractionResults && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-blue-800">Document Analysis</h3>
                <div className={`text-xs font-medium ${getConfidenceColor(extractionResults.confidence)}`}>
                  {Math.round(extractionResults.confidence * 100)}% Confidence
                </div>
              </div>
              
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-blue-600 text-xs">Document Type</span>
                  <div>{extractionResults.documentType}</div>
                </div>
                <div>
                  <span className="text-blue-600 text-xs">Date</span>
                  <div>{extractionResults.metadata.date}</div>
                </div>
                <div>
                  <span className="text-blue-600 text-xs">Source</span>
                  <div>{extractionResults.metadata.source}</div>
                </div>
                <div>
                  <span className="text-blue-600 text-xs">Pages</span>
                  <div>{extractionResults.metadata.pageCount}</div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Extracted Fields</h3>
              <div className="space-y-2">
                {extractionResults.fields.map((field, idx) => (
                  <div 
                    key={idx} 
                    className="p-2 rounded-md border flex justify-between items-center"
                  >
                    <div>
                      <span className="text-xs text-gray-500">{field.name}</span>
                      <div className="font-medium">{field.value}</div>
                    </div>
                    <div className={`text-xs ${getConfidenceColor(field.confidence)}`}>
                      {Math.round(field.confidence * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Extracted Tables</h3>
              <div className="space-y-3">
                {extractionResults.tables.map((table, idx) => (
                  <div key={idx} className="border rounded-md overflow-hidden">
                    <div 
                      className="bg-gray-50 p-3 flex justify-between items-center cursor-pointer"
                      onClick={() => toggleTable(idx)}
                    >
                      <div className="font-medium text-sm flex items-center">
                        <Table className="h-4 w-4 mr-2 text-blue-500" />
                        {table.name}
                      </div>
                      <div>
                        {expandedTable === idx ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                    </div>
                    
                    {expandedTable === idx && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              {table.headers.map((header, headerIdx) => (
                                <th 
                                  key={headerIdx} 
                                  scope="col" 
                                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {table.rows.map((row, rowIdx) => (
                              <tr key={rowIdx}>
                                {row.map((cell, cellIdx) => (
                                  <td key={cellIdx} className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setExtractionResults(null)}>
                Extract Again
              </Button>
              <Button>
                Save Extracted Data
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}