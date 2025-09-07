'use client';

import React, { useRef, useEffect } from 'react';

export default function GridTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawGrid = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to fill available space
    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width - 32; // Account for padding
      canvas.height = rect.height - 100; // Account for title and padding
    } else {
      canvas.width = window.innerWidth - 100;
      canvas.height = window.innerHeight - 200;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw a simple grid
    const gridSize = 20;
    const gridColor = '#e5e7eb';
    const majorGridColor = '#d1d5db';
    const majorGridInterval = 5;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.strokeStyle = x % (gridSize * majorGridInterval) === 0 ? majorGridColor : gridColor;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.strokeStyle = y % (gridSize * majorGridInterval) === 0 ? majorGridColor : gridColor;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw a test rectangle
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(100, 100, 50, 30);

    console.log('Grid test rendered');
  };

  useEffect(() => {
    drawGrid();

    // Add resize handler
    const handleResize = () => {
      drawGrid();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen w-full bg-gray-100 p-4 flex flex-col">
      <h1 className="text-2xl font-bold mb-4">Grid Test</h1>
      <div className="flex-1 w-full">
        <canvas
          ref={canvasRef}
          className="border border-gray-300 bg-white w-full h-full"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
      </div>
    </div>
  );
}
