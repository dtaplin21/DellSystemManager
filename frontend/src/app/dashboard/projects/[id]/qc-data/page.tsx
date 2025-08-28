'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QCForm from '@/components/qc-data/qc-form';
import ExcelImporter from '@/components/qc-data/excel-importer';
import DataVisualizer from '@/components/qc-data/data-visualizer';
import { useToast } from '@/hooks/use-toast';
import { fetchProjectById, fetchQCData } from '@/lib/api';

interface Project {
  id: string;
  name: string;
}

interface QCData {
  id: string;
  type: string;
  panelId: string;
  date: string;
  result: string;
  technician: string;
  notes: string;
}

export default function QCDataPage({ params }: { params: Promise<{ id: string }> }) {
  const [project, setProject] = useState<Project | null>(null);
  const [qcData, setQCData] = useState<QCData[]>([]);
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
    
    const loadProjectAndQCData = async () => {
      try {
        setIsLoading(true);
        
        // Load project details
        const projectData = await fetchProjectById(projectId);
        setProject(projectData);
        
        // Load QC data
        const qcDataResult = await fetchQCData(projectId);
        setQCData(qcDataResult);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load QC data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProjectAndQCData();
  }, [projectId, toast]);

  const handleQCDataAdded = (newData: QCData | QCData[]) => {
    if (Array.isArray(newData)) {
      setQCData((prev) => [...newData, ...prev]);
      toast({
        title: 'QC Data Imported',
        description: `${newData.length} QC records imported successfully.`,
      });
    } else {
      setQCData((prev) => [newData, ...prev]);
      toast({
        title: 'QC Data Added',
        description: 'QC record added successfully.',
      });
    }
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
          <h1 className="text-2xl font-bold">QC Data: {project.name}</h1>
          <p className="text-gray-500">Manage quality control data for this project</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
          Back to Project
        </Button>
      </div>

      <Tabs defaultValue="form">
        <TabsList className="w-full border-b">
          <TabsTrigger value="form">Manual Entry</TabsTrigger>
          <TabsTrigger value="import">Excel Import</TabsTrigger>
          <TabsTrigger value="visualize">Visualize Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="form" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Manual QC Data Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <QCForm projectId={projectId} onSubmit={handleQCDataAdded} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="import" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Import QC Data from Excel</CardTitle>
            </CardHeader>
            <CardContent>
              <ExcelImporter projectId={projectId} onImportComplete={handleQCDataAdded} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="visualize" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>QC Data Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <DataVisualizer projectId={projectId} qcData={qcData} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
