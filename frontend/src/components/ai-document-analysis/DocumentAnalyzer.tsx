'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useToast } from '../../hooks/use-toast';
import { FileUp, FileText, FileSearch, FilePlus2, AlertTriangle, Loader2 } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  analyzed: boolean;
}

interface QCDataEntry {
  id: number;
  location: string;
  parameter: string;
  value: string;
  status: string;
}

interface Material {
  name: string;
  thickness?: string;
  weight?: string;
  manufacturer: string;
  quantity: string;
}

interface DocumentSection {
  heading: string;
  contentSummary: string;
}

export default function DocumentAnalyzer() {
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: '1',
      name: 'Project-Specifications.pdf',
      type: 'PDF',
      size: '2.3 MB',
      uploadDate: '2025-05-01',
      analyzed: true
    },
    {
      id: '2',
      name: 'QC-Data-April.xlsx',
      type: 'Excel',
      size: '1.8 MB',
      uploadDate: '2025-05-02',
      analyzed: false
    },
    {
      id: '3',
      name: 'Site-Survey-Report.pdf',
      type: 'PDF',
      size: '4.1 MB',
      uploadDate: '2025-05-03',
      analyzed: false
    }
  ]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisQuestion, setAnalysisQuestion] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [extractionType, setExtractionType] = useState('auto');
  interface QCDataExtraction {
    type: 'QC Data';
    entries: QCDataEntry[];
  }
  
  interface MaterialExtraction {
    type: 'Material Specifications';
    materials: Material[];
  }
  
  interface DocumentContentExtraction {
    type: 'Document Content';
    title: string;
    sections: DocumentSection[];
  }
  
  type ExtractedData = QCDataExtraction | MaterialExtraction | DocumentContentExtraction;
  
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDocumentSelect = (id: string) => {
    if (selectedDocuments.includes(id)) {
      setSelectedDocuments(selectedDocuments.filter(docId => docId !== id));
    } else {
      setSelectedDocuments([...selectedDocuments, id]);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    // Simulate file upload
    setTimeout(() => {
      const newDocuments = Array.from(files).map((file, index) => ({
        id: Date.now() + index.toString(),
        name: file.name,
        type: file.name.endsWith('.pdf') ? 'PDF' : file.name.endsWith('.xlsx') ? 'Excel' : 'Document',
        size: formatFileSize(file.size),
        uploadDate: new Date().toISOString().split('T')[0],
        analyzed: false
      }));
      
      setDocuments([...documents, ...newDocuments]);
      setIsUploading(false);
      
      toast({
        title: 'Documents Uploaded',
        description: `Successfully uploaded ${files.length} document(s)`,
      });
      
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 1500);
  };

  const analyzeDocuments = () => {
    if (selectedDocuments.length === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select at least one document to analyze',
        variant: 'destructive',
      });
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    // Simulate API call to analyze documents
    setTimeout(() => {
      const selectedDocs = documents.filter(doc => selectedDocuments.includes(doc.id));
      const docNames = selectedDocs.map(doc => doc.name).join(', ');
      
      // Generate a simulated analysis result
      let result = `# Analysis Results\n\n`;
      
      if (analysisQuestion) {
        result += `## Response to Your Question\n\n${analysisQuestion}\n\n`;
        
        if (analysisQuestion.toLowerCase().includes('specifications') || analysisQuestion.toLowerCase().includes('requirements')) {
          result += `Based on the analyzed documents, the project specifications include:\n\n`;
          result += `- Geomembrane thickness: 60 mil HDPE\n`;
          result += `- Seam testing requirements: 100% destructive testing at 500ft intervals\n`;
          result += `- Quality control: Daily monitoring of installation\n`;
          result += `- Material certifications: Required for all materials prior to installation\n\n`;
        } else if (analysisQuestion.toLowerCase().includes('qc') || analysisQuestion.toLowerCase().includes('quality')) {
          result += `The QC data shows:\n\n`;
          result += `- All seam strength tests passed minimum requirements\n`;
          result += `- 3 locations flagged for potential issues in the northeast corner\n`;
          result += `- Material thickness consistently meets specifications\n`;
          result += `- No critical deviations detected in the analyzed data\n\n`;
        } else {
          result += `The documents indicate this is a standard geosynthetic installation project with typical quality control requirements. Key points:\n\n`;
          result += `- Project timeline: 45 days for complete installation\n`;
          result += `- Approximately 12 acres of total coverage area\n`;
          result += `- Standard testing protocols are being followed\n`;
          result += `- All materials appear to meet industry specifications\n\n`;
        }
      } else {
        result += `## Document Overview\n\n`;
        result += `Analyzed ${selectedDocs.length} document(s): ${docNames}\n\n`;
        result += `Key findings:\n\n`;
        result += `- Project uses standard 60 mil HDPE geomembrane material\n`;
        result += `- Installation area covers approximately 12 acres\n`;
        result += `- QC testing requirements follow industry standards\n`;
        result += `- Several potential areas of concern identified in the northwest section\n`;
        result += `- Material delivery schedule indicates potential delays in weeks 3-4\n\n`;
      }
      
      result += `## Recommendations\n\n`;
      result += `- Review seam testing protocols in the northwest section\n`;
      result += `- Verify material certifications for recent deliveries\n`;
      result += `- Consider additional QC testing in areas with potential concerns\n`;
      result += `- Update project timeline to account for potential material delays\n`;
      
      setAnalysisResult(result);
      setIsAnalyzing(false);
      
      // Mark documents as analyzed
      setDocuments(documents.map(doc => 
        selectedDocuments.includes(doc.id) ? { ...doc, analyzed: true } : doc
      ));
      
      toast({
        title: 'Analysis Complete',
        description: 'Document analysis has been completed successfully',
      });
    }, 3000);
  };

  const extractDataFromDocument = (document: Document) => {
    setIsAnalyzing(true);
    setExtractedData(null);
    
    // Simulate API call to extract data
    setTimeout(() => {
      // Generate simulated extracted data based on extraction type
      let data: ExtractedData;
      
      if (document.type === 'Excel' && (extractionType === 'auto' || extractionType === 'qc_data')) {
        data = {
          type: 'QC Data',
          entries: [
            { id: 1, location: 'A1', parameter: 'Thickness', value: '60 mil', status: 'Pass' },
            { id: 2, location: 'B3', parameter: 'Tensile Strength', value: '145 psi', status: 'Pass' },
            { id: 3, location: 'C2', parameter: 'Puncture Resistance', value: '62 lbs', status: 'Warning' },
            { id: 4, location: 'A4', parameter: 'Seam Strength', value: '98 ppi', status: 'Pass' },
            { id: 5, location: 'D3', parameter: 'Tear Resistance', value: '43 lbs', status: 'Pass' },
          ]
        };
      } else if (document.type === 'PDF' && (extractionType === 'auto' || extractionType === 'materials')) {
        data = {
          type: 'Material Specifications',
          materials: [
            { name: 'HDPE Geomembrane', thickness: '60 mil', manufacturer: 'GeoSolutions Inc.', quantity: '520,000 sq ft' },
            { name: 'Geocomposite', thickness: '200 mil', manufacturer: 'EarthTech', quantity: '150,000 sq ft' },
            { name: 'Geotextile', weight: '8 oz', manufacturer: 'GeoFabrics', quantity: '350,000 sq ft' },
          ]
        };
      } else {
        data = {
          type: 'Document Content',
          title: document.name.replace(/\.[^/.]+$/, ""),
          sections: [
            { heading: 'Introduction', contentSummary: 'Project overview and scope description' },
            { heading: 'Material Specifications', contentSummary: 'Detailed specifications for geosynthetic materials' },
            { heading: 'Installation Requirements', contentSummary: 'Procedures and quality control for installation' },
            { heading: 'Testing Protocols', contentSummary: 'Required tests and acceptance criteria' },
          ]
        };
      }
      
      setExtractedData(data);
      setIsAnalyzing(false);
      
      toast({
        title: 'Data Extraction Complete',
        description: `Successfully extracted ${data.type} from ${document.name}`,
      });
    }, 2500);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">AI Document Analysis</h2>
        <Button onClick={handleFileUpload}>
          <FileUp className="h-4 w-4 mr-2" />
          Upload Documents
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
          style={{ display: 'none' }}
          multiple
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Document Library</CardTitle>
              <CardDescription>Select documents to analyze</CardDescription>
            </CardHeader>
            <CardContent>
              {isUploading ? (
                <div className="flex justify-center py-8">
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-sm text-gray-500">Uploading documents...</p>
                  </div>
                </div>
              ) : documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-3 border rounded-md flex items-center cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedDocuments.includes(doc.id) ? 'bg-blue-50 border-blue-300' : ''
                      }`}
                      onClick={() => handleDocumentSelect(doc.id)}
                    >
                      <div className="flex-shrink-0 mr-3">
                        {doc.type === 'PDF' ? (
                          <FileText className="h-6 w-6 text-red-500" />
                        ) : doc.type === 'Excel' ? (
                          <FileText className="h-6 w-6 text-green-500" />
                        ) : (
                          <FileText className="h-6 w-6 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-grow">
                        <div className="font-medium text-sm">{doc.name}</div>
                        <div className="text-xs text-gray-500 flex space-x-2">
                          <span>{doc.size}</span>
                          <span>•</span>
                          <span>{doc.uploadDate}</span>
                        </div>
                      </div>
                      {doc.analyzed && (
                        <div className="ml-2 flex-shrink-0">
                          <div className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                            Analyzed
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FilePlus2 className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <p>No documents available.</p>
                  <p className="text-sm">Upload documents to get started.</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={analyzeDocuments} 
                disabled={selectedDocuments.length === 0 || isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FileSearch className="h-4 w-4 mr-2" />
                    Analyze Selected
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>
                {analysisResult ? "Analysis Results" : "Document Analysis"}
              </CardTitle>
              <CardDescription>
                {analysisResult 
                  ? `Analyzed ${selectedDocuments.length} document(s)`
                  : "Ask questions about your documents"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysisResult ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <pre className="whitespace-pre-wrap text-sm">{analysisResult}</pre>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button 
                      variant="outline" 
                      onClick={() => setAnalysisResult(null)}
                    >
                      New Analysis
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="analysis-question">What would you like to know about these documents?</Label>
                    <Textarea
                      id="analysis-question"
                      placeholder="E.g., What are the key specifications for the geomembrane installation? Or what quality control issues are mentioned?"
                      value={analysisQuestion}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnalysisQuestion(e.target.value)}
                      rows={3}
                    />
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-md flex items-start">
                    <AlertTriangle className="h-5 w-5 mr-2 text-blue-500 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p>AI document analysis can:</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Extract key information from project specifications</li>
                        <li>Identify potential issues in QC data reports</li>
                        <li>Summarize large technical documents</li>
                        <li>Compare specifications against test results</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Data Extraction</CardTitle>
          <CardDescription>Extract structured data from documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="mb-4">
                <Label htmlFor="extraction-type">Extraction Type</Label>
                <Select
                  value={extractionType}
                  onValueChange={setExtractionType}
                >
                  <SelectTrigger id="extraction-type">
                    <SelectValue placeholder="Select extraction type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-Detect</SelectItem>
                    <SelectItem value="qc_data">QC Data</SelectItem>
                    <SelectItem value="materials">Material Specifications</SelectItem>
                    <SelectItem value="tests">Test Results</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Select Document to Extract Data</Label>
                <div className="grid grid-cols-1 gap-2">
                  {documents.map((doc) => (
                    <Button
                      key={doc.id}
                      variant="outline"
                      className="justify-start h-auto py-2"
                      onClick={() => extractDataFromDocument(doc)}
                      disabled={isAnalyzing}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      <div className="text-left">
                        <div className="font-medium text-sm">{doc.name}</div>
                        <div className="text-xs text-gray-500">{doc.type} • {doc.size}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="border rounded-md p-4">
              <h3 className="text-sm font-medium mb-2">Extracted Data</h3>
              {isAnalyzing ? (
                <div className="flex justify-center py-8">
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-sm text-gray-500">Extracting data...</p>
                  </div>
                </div>
              ) : extractedData ? (
                <div className="space-y-4">
                  <div className="bg-green-50 p-2 rounded text-sm text-green-800 font-medium">
                    {extractedData.type}
                  </div>
                  
                  {extractedData.type === 'QC Data' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2 text-left">Location</th>
                            <th className="p-2 text-left">Parameter</th>
                            <th className="p-2 text-left">Value</th>
                            <th className="p-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extractedData.entries.map((entry: QCDataEntry) => (
                            <tr key={entry.id} className="border-t">
                              <td className="p-2">{entry.location}</td>
                              <td className="p-2">{entry.parameter}</td>
                              <td className="p-2">{entry.value}</td>
                              <td className="p-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  entry.status === 'Pass' 
                                    ? 'bg-green-100 text-green-800' 
                                    : entry.status === 'Warning'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {entry.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {extractedData.type === 'Material Specifications' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2 text-left">Material</th>
                            <th className="p-2 text-left">Properties</th>
                            <th className="p-2 text-left">Manufacturer</th>
                            <th className="p-2 text-left">Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extractedData.materials.map((material: Material, index: number) => (
                            <tr key={index} className="border-t">
                              <td className="p-2">{material.name}</td>
                              <td className="p-2">
                                {material.thickness ? `Thickness: ${material.thickness}` : ''}
                                {material.weight ? `Weight: ${material.weight}` : ''}
                              </td>
                              <td className="p-2">{material.manufacturer}</td>
                              <td className="p-2">{material.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {extractedData.type === 'Document Content' && (
                    <div className="space-y-2">
                      <h3 className="font-medium">{extractedData.title}</h3>
                      <div className="space-y-1">
                        {extractedData.sections.map((section: any, index: number) => (
                          <div key={index} className="border-t pt-2">
                            <div className="font-medium">{section.heading}</div>
                            <div className="text-gray-600">{section.contentSummary}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setExtractedData(null)}
                    >
                      Clear Results
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileSearch className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                  <p>No data extracted yet.</p>
                  <p className="text-sm">Select a document and extraction type to begin.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}