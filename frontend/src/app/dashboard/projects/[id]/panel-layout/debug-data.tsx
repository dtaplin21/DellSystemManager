'use client';

import React from 'react';

export default function DebugData() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">🔍 Debug Panel Data</h1>
      <div className="bg-blue-100 p-4 rounded mb-4">
        <p className="text-blue-800">
          <strong>Status:</strong> Debug component is rendering successfully!
        </p>
        <p className="text-blue-800 mt-2">
          <strong>Project ID:</strong> 69fc302b-166d-4543-9990-89c4b1e0ed59
        </p>
      </div>
      
      <div className="bg-green-100 p-4 rounded mb-4">
        <h2 className="font-semibold text-green-800 mb-2">Backend API Test:</h2>
        <p className="text-green-700">
          ✅ Backend is running and returning 3 real database panels
        </p>
        <p className="text-green-700">
          ✅ API endpoint: /api/panel-layout/ssr-layout/69fc302b-166d-4543-9990-89c4b1e0ed59
        </p>
      </div>

      <div className="bg-yellow-100 p-4 rounded">
        <h2 className="font-semibold text-yellow-800 mb-2">Next Steps:</h2>
        <p className="text-yellow-700">
          The issue is that the main PanelLayoutRefactored component is not transitioning from loading to loaded state.
        </p>
        <p className="text-yellow-700 mt-2">
          This suggests there&apos;s an issue in the usePanelData hook or the data mapping process.
        </p>
      </div>
    </div>
  );
}
