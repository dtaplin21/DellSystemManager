'use client';

import React from 'react';

export default function MinimalTest() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">✅ Minimal Test Component</h1>
      <div className="bg-green-100 p-4 rounded">
        <p className="text-green-800">
          <strong>Status:</strong> Component is rendering successfully!
        </p>
        <p className="text-green-800">
          <strong>Time:</strong> {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
