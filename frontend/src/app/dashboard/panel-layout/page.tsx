'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import './panel-layout.css';

export default function PanelLayoutPage() {
  const [panels, setPanels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Layout</h1>
          <p className="text-gray-600">Design and optimize geosynthetic panel arrangements</p>
        </div>
        <Link href="/dashboard">
          <button className="btn-outline">
            Back to Dashboard
          </button>
        </Link>
      </div>

      {/* Panel Management Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Panel Management</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Auto Layout */}
            <div className="bg-navy-50 p-6 rounded-lg border border-navy-200">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-navy-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-navy-900">Auto Layout</h3>
              </div>
              <p className="text-navy-700 mb-4">Let AI optimize panel placement based on site conditions and constraints.</p>
              <Button className="w-full bg-navy-600 hover:bg-navy-700 text-white">
                Generate Auto Layout
              </Button>
            </div>

            {/* Manual Layout */}
            <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-orange-900">Manual Layout</h3>
              </div>
              <p className="text-orange-700 mb-4">Create custom panel arrangements with drag-and-drop interface.</p>
              <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                Start Manual Design
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Layout Viewer */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Layout Preview</h2>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-navy-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <p className="text-gray-500">No panel layout created yet</p>
                <p className="text-sm text-gray-400">Start with auto layout or manual design</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-navy-900">0</div>
          <div className="text-sm text-gray-600">Total Panels</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-orange-600">0 ft²</div>
          <div className="text-sm text-gray-600">Coverage Area</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-green-600">0%</div>
          <div className="text-sm text-gray-600">Efficiency</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-purple-600">$0</div>
          <div className="text-sm text-gray-600">Est. Cost</div>
        </div>
      </div>
    </div>
  );
}