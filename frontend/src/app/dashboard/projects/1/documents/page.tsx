'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export default function DocumentsPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const loadProjectAndDocuments = async () => {
      try {
        setIsLoading(true);
        
        // Load sample project details
        setProject({
          id: '1',
          name: 'Lakeview Containment Facility'
        });
        
        // Load sample documents
        setDocuments([
          {
            id: 'doc1',
            name: 'Site Survey.pdf',
            type: 'PDF',
            size: 2500000,
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'John Doe'
          },
          {
            id: 'doc2',
            name: 'Material Specifications.pdf',
            type: 'PDF',
            size: 1800000,
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'Jane Smith'
          },
          {
            id: 'doc3',
            name: 'QC Test Results.xlsx',
            type: 'Excel',
            size: 950000,
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'John Doe'
          }
        ]);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load documents. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProjectAndDocuments();
  }, [toast]);

  const handleDocumentUpload = (newDocuments: Document[]) => {
    setDocuments((prev) => [...newDocuments, ...prev]);
    toast({
      title: 'Documents Uploaded',
      description: `${newDocuments.length} document(s) uploaded successfully.`,
    });
  };

  const handleDocumentDelete = (documentId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    toast({
      title: 'Document Deleted',
      description: 'Document has been deleted successfully.',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
        <p className="text-gray-500 mb-4">
          The project you're looking for does not exist or you don't have access to it.
        </p>
        <Button onClick={() => router.push('/dashboard/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Documents: {project.name}</h1>
          <p className="text-gray-500">Upload, manage, and analyze project documents</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/dashboard/projects/${project.id}`)}>
          Back to Project
        </Button>
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="w-full border-b">
          <TabsTrigger value="upload">Upload Documents</TabsTrigger>
          <TabsTrigger value="documents">All Documents</TabsTrigger>
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h3 className="text-lg font-medium mb-2">Drop files to upload</h3>
                <p className="text-sm text-gray-500 mb-4">or click to browse</p>
                <Button>Select Files</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documents" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Name</th>
                      <th className="text-left py-3 px-2">Type</th>
                      <th className="text-left py-3 px-2">Size</th>
                      <th className="text-left py-3 px-2">Uploaded</th>
                      <th className="text-left py-3 px-2">By</th>
                      <th className="text-right py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2 font-medium">{doc.name}</td>
                        <td className="py-3 px-2">{doc.type}</td>
                        <td className="py-3 px-2">{(doc.size / 1000000).toFixed(1)} MB</td>
                        <td className="py-3 px-2">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                        <td className="py-3 px-2">{doc.uploadedBy}</td>
                        <td className="py-3 px-2 text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                            </svg>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            onClick={() => handleDocumentDelete(doc.id)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analysis" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Document Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ask a question about your documents</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="e.g., What are the key specifications in the material documents?" 
                      className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
                    />
                    <Button>Ask</Button>
                  </div>
                </div>

                <div className="border rounded-md p-4 bg-gray-50">
                  <h3 className="font-medium mb-2">What documents should I analyze?</h3>
                  <p className="text-sm text-gray-600">
                    Select one or more documents from the Documents tab and then ask your questions here. 
                    Our AI will analyze the content and provide intelligent insights based on your specific query.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}