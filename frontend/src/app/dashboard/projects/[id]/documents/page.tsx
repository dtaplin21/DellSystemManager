'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DocumentUploader from '@/components/documents/document-uploader';
import DocumentList from '@/components/documents/document-list';
import AIAnalysis from '@/components/documents/ai-analysis';
import { useToast } from '@/hooks/use-toast';
import { fetchProjectById, fetchDocuments } from '@/lib/api';

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

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projectId, setProjectId] = useState<string>('');
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const loadParams = async () => {
      try {
        const resolvedParams = await params;
        setProjectId(resolvedParams.id);
      } catch (error) {
        console.error('Failed to resolve params:', error);
      }
    };
    
    loadParams();
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    
    const loadProjectAndDocuments = async () => {
      try {
        setIsLoading(true);
        
        // Load project details
        const projectData = await fetchProjectById(projectId);
        setProject(projectData);
        
        // Load documents
        const documentsData = await fetchDocuments(projectId);
        setDocuments(documentsData);
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
  }, [projectId, toast]);

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
          The project you&apos;re looking for does not exist or you don&apos;t have access to it.
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
        <Button variant="outline" onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
          Back to Project
        </Button>
      </div>

      <Tabs defaultValue="upload">
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
              <DocumentUploader 
                projectId={projectId} 
                onUploadComplete={handleDocumentUpload}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documents" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList 
                documents={documents} 
                onDelete={handleDocumentDelete}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analysis" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Document Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <AIAnalysis 
                projectId={projectId} 
                documents={documents} 
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
