'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, File, AlertCircle, Download, Search } from 'lucide-react';

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sample document data
  const documents = [
    {
      id: 1,
      name: 'Project Specifications',
      type: 'PDF',
      size: '2.4 MB',
      uploadedAt: '2025-05-01',
      project: 'Highway 101 Expansion',
    },
    {
      id: 2,
      name: 'QC Test Results',
      type: 'Excel',
      size: '1.8 MB',
      uploadedAt: '2025-05-03',
      project: 'Highway 101 Expansion',
    },
    {
      id: 3,
      name: 'Installation Guidelines',
      type: 'PDF',
      size: '3.2 MB',
      uploadedAt: '2025-04-28',
      project: 'Riverside Containment',
    },
    {
      id: 4,
      name: 'Material Certifications',
      type: 'PDF',
      size: '5.1 MB',
      uploadedAt: '2025-05-07',
      project: 'Airport Runway Expansion',
    },
    {
      id: 5,
      name: 'Panel Layout',
      type: 'CAD',
      size: '8.6 MB',
      uploadedAt: '2025-05-02',
      project: 'City Reservoir Project',
    },
  ];
  
  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const getDocumentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-6 w-6 text-red-500" />;
      case 'excel':
        return <FileText className="h-6 w-6 text-green-600" />;
      case 'cad':
        return <FileText className="h-6 w-6 text-blue-500" />;
      default:
        return <File className="h-6 w-6 text-gray-500" />;
    }
  };
  
  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>
      
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search documents by name, project, or type..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDocuments.length > 0 ? (
          filteredDocuments.map((doc) => (
            <Card key={doc.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="mr-4">{getDocumentIcon(doc.type)}</div>
                  <CardTitle className="text-lg">{doc.name}</CardTitle>
                </div>
                <CardDescription>{doc.project}</CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Type: {doc.type}</span>
                  <span>Size: {doc.size}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Uploaded: {doc.uploadedAt}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button variant="outline" size="sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Details
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No documents found</h3>
            <p className="text-gray-500">
              {searchQuery
                ? `No documents matching "${searchQuery}"`
                : "Upload documents to get started."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}