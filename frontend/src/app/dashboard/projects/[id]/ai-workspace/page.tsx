import UnifiedAIPanelWorkspace from '@/components/panels/UnifiedAIPanelWorkspace'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectAIWorkspacePage({ params }: PageProps) {
  const { id } = await params

  return (
    <div className="container mx-auto px-4 py-8">
      <UnifiedAIPanelWorkspace projectId={id} />
    </div>
  )
}
