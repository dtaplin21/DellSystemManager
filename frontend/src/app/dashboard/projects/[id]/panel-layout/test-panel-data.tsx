'use client';

import { useState, useEffect } from 'react';

export default function TestPanelData() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🔍 [TestPanelData] Starting fetch...');
        const response = await fetch('http://localhost:8003/api/panel-layout/ssr-layout/69fc302b-166d-4543-9990-89c4b1e0ed59');
        console.log('🔍 [TestPanelData] Response:', response);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('🔍 [TestPanelData] Data received:', result);
        setData(result);
      } catch (err) {
        console.error('🔍 [TestPanelData] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading test data...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-4">
      <h2>Test Panel Data</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
