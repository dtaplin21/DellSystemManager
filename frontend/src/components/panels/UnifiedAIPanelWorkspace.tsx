'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import PanelAIChat from '@/components/panels/PanelAIChat'
import PanelRequirementsForm from '@/components/panel-layout/PanelRequirementsForm'
import { fetchDocuments, fetchProjectById } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { AlertCircle, Brain, LayoutDashboard, RefreshCw } from 'lucide-react'

interface UnifiedAIPanelWorkspaceProps {
  projectId: string
}

interface ProjectInfo {
  id: string
  name: string
  location?: string
  description?: string
}

interface ProjectDocument {
  id: string
  name: string
  type: string
  size: number
  uploadedAt: string
  uploadedBy: string
}

export default function UnifiedAIPanelWorkspace({ projectId }: UnifiedAIPanelWorkspaceProps) {
  const { toast } = useToast()
  const { user } = useSupabaseAuth()
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [activeTab, setActiveTab] = useState<'documents' | 'chat'>('documents')
  const [loadingProject, setLoadingProject] = useState(false)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [layoutRefreshToken, setLayoutRefreshToken] = useState<number>(Date.now())
  const [lastGenerationStatus, setLastGenerationStatus] = useState<string>('')

  const panelLayoutUrl = useMemo(
    () => `/dashboard/projects/${projectId}/panel-layout?refresh=${layoutRefreshToken}`,
    [projectId, layoutRefreshToken]
  )

  const loadProject = useCallback(async () => {
    try {
      setLoadingProject(true)
      const data = await fetchProjectById(projectId)
      setProject({
        id: data.id,
        name: data.name,
        location: data.location,
        description: data.description
      })
    } catch (error) {
      console.error('Failed to load project details', error)
      toast({
        title: 'Unable to load project',
        description: 'Please confirm you have access to this project.',
        variant: 'destructive'
      })
    } finally {
      setLoadingProject(false)
    }
  }, [projectId, toast])

  const loadDocuments = useCallback(async () => {
    try {
      setLoadingDocuments(true)
      const docs = await fetchDocuments(projectId)
      setDocuments(docs || [])
    } catch (error) {
      console.error('Failed to load documents for workspace', error)
      toast({
        title: 'Unable to load documents',
        description: 'Try refreshing the page or uploading again.',
        variant: 'destructive'
      })
    } finally {
      setLoadingDocuments(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    loadProject()
    loadDocuments()
  }, [loadProject, loadDocuments])

  const handleRequirementsChange = useCallback((_requirements: any, confidence: number) => {
    setLastGenerationStatus(`Requirements synced • Confidence ${confidence}%`)
  }, [])

  const handleLayoutGenerated = useCallback(
    (result: any) => {
      if (result?.status) {
        setLastGenerationStatus(`Layout generation status: ${result.status}`)
      }
      setLayoutRefreshToken(Date.now())
      void loadDocuments()
    },
    [loadDocuments]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Unified AI Panel Workspace</h1>
          <p className="text-muted-foreground">
            Analyze project documents, generate layouts, and orchestrate AI agents from a single workspace.
          </p>
          {project && (
            <p className="text-sm text-muted-foreground mt-1">
              Connected project: <span className="font-medium text-foreground">{project.name}</span>
              {project.location ? ` • ${project.location}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <LayoutDashboard className="h-4 w-4" />
            <span>Panel layout auto-refresh</span>
          </Badge>
          <Button asChild variant="outline">
            <Link href={panelLayoutUrl}>View Panel Layout</Link>
          </Button>
        </div>
      </div>

      {lastGenerationStatus && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <span>{lastGenerationStatus}</span>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as 'documents' | 'chat')}>
        <TabsList>
          <TabsTrigger value="documents">Document Analysis &amp; Generation</TabsTrigger>
          <TabsTrigger value="chat">AI Chat &amp; Manipulation</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Document Analysis
              </CardTitle>
              <CardDescription>
                Upload documents, extract requirements, and generate panels that persist to the project layout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingProject && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading project…
                </div>
              )}
              <PanelRequirementsForm
                projectId={projectId}
                documents={documents}
                onRequirementsChange={handleRequirementsChange}
                onLayoutGenerated={handleLayoutGenerated}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>AI Chat &amp; Manipulation</CardTitle>
              <CardDescription>
                Direct AI agents to navigate the panel layout, capture screenshots, and update panels via API.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {project ? (
                <PanelAIChat
                  projectId={projectId}
                  projectInfo={{
                    projectName: project.name,
                    location: project.location,
                    description: project.description,
                    panelLayoutUrl
                  }}
                  userId={user?.id}
                  userTier={user?.subscription ?? 'free_user'}
                  panelLayoutUrl={panelLayoutUrl}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  Project details are loading. Please wait…
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {loadingDocuments && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Refreshing documents…
        </div>
      )}
    </div>
  )
}
