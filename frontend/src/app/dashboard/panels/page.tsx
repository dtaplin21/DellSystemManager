'use client'

import { useState } from 'react'
import PanelLayout from '@/components/panels/PanelLayout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function PanelsPage() {
  const [activeTab, setActiveTab] = useState<string>('manual')
  const [projectInfo, setProjectInfo] = useState({
    projectName: 'Landfill Cell 4 Expansion',
    location: 'Boulder, CO',
    description: 'Eastern slope liner system',
    manager: 'John Smith',
    material: '60 mil HDPE Textured'
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-navy-600">Panel Layout</h1>
        <div className="flex space-x-2">
          <Button variant="outline">Import Excel</Button>
          <Button variant="outline">Export CAD</Button>
          <Button>Save Layout</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h2 className="text-xl font-semibold mb-2">Project Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <span className="font-medium">Project Name:</span> {projectInfo.projectName}
          </div>
          <div>
            <span className="font-medium">Location:</span> {projectInfo.location}
          </div>
          <div>
            <span className="font-medium">Manager:</span> {projectInfo.manager}
          </div>
          <div>
            <span className="font-medium">Description:</span> {projectInfo.description}
          </div>
          <div>
            <span className="font-medium">Material:</span> {projectInfo.material}
          </div>
        </div>
      </div>

      <Tabs defaultValue="manual" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Manual Layout</TabsTrigger>
          <TabsTrigger value="auto">Auto Layout</TabsTrigger>
        </TabsList>
        <TabsContent value="manual">
          <PanelLayout 
            mode="manual" 
            projectInfo={projectInfo}
          />
        </TabsContent>
        <TabsContent value="auto">
          <PanelLayout 
            mode="auto" 
            projectInfo={projectInfo}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}