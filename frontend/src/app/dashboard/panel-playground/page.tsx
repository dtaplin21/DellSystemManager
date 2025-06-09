'use client';

import PanelLayout from '@/components/panels/PanelLayout';

export default function PanelPlaygroundPage() {
  // Playground mode - no project requirements, pure sandbox
  const playgroundProjectInfo = {
    projectName: 'Panel Layout Playground',
    location: 'Sandbox Environment',
    description: 'Sandbox for testing panel designs',
    manager: 'System',
    material: 'Standard HDPE'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel Layout Playground</h1>
            <p className="text-gray-600">Sandbox environment for testing panel designs</p>
          </div>
          <div className="text-sm text-gray-500">
            Draft mode - designs are not saved
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <PanelLayout 
          mode="auto" 
          projectInfo={playgroundProjectInfo}
        />
      </div>
    </div>
  );
}