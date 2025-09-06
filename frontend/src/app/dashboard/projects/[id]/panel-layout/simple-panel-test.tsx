'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function SimplePanelTest() {
  const params = useParams();
  const projectId = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🔍 [SimplePanelTest] Fetching data for project:', projectId);
        const response = await fetch(`http://localhost:8003/api/panel-layout/ssr-layout/${projectId}`);
        console.log('🔍 [SimplePanelTest] Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('🔍 [SimplePanelTest] Raw data:', result);
        setData(result);
        setLoading(false);
      } catch (err) {
        console.error('🔍 [SimplePanelTest] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">🔄 Loading Panel Data...</h1>
        <div className="bg-blue-100 p-4 rounded">
          <p className="text-blue-800">Fetching data from backend...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">❌ Error Loading Data</h1>
        <div className="bg-red-100 p-4 rounded">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">✅ Panel Data Loaded Successfully!</h1>
      
      <div className="bg-green-100 p-4 rounded mb-4">
        <p className="text-green-800">
          <strong>Status:</strong> Data fetched successfully from backend
        </p>
        <p className="text-green-800">
          <strong>Project ID:</strong> {projectId}
        </p>
        <p className="text-green-800">
          <strong>Panels Count:</strong> {data?.layout?.panels?.length || 0}
        </p>
      </div>

      {data?.layout?.panels && data.layout.panels.length > 0 && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Panel Details:</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.layout.panels.map((panel: any, index: number) => (
              <div key={index} className="bg-white p-3 rounded border">
                <h3 className="font-semibold">Panel {index + 1}</h3>
                <p><strong>Type:</strong> {panel.type}</p>
                <p><strong>Size:</strong> {panel.width_feet}ft × {panel.height_feet}ft</p>
                <p><strong>Position:</strong> ({panel.x}, {panel.y})</p>
                <p><strong>Color:</strong> {panel.color}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <button 
          onClick={() => window.location.reload()} 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}
