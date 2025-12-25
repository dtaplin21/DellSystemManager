'use client';

import React from 'react';
import { Compass } from 'lucide-react';

interface CompassRoseProps {
  cardinalDirection?: 'north' | 'south' | 'east' | 'west';
  className?: string;
}

export function CompassRose({ cardinalDirection = 'north', className = '' }: CompassRoseProps) {
  // Calculate rotation based on cardinal direction
  // Default: north is up (0 degrees)
  // If project is oriented differently, rotate the compass
  const rotationMap = {
    north: 0,
    east: -90,  // Rotate 90 degrees counter-clockwise (east is right)
    south: 180, // Rotate 180 degrees (south is down)
    west: 90    // Rotate 90 degrees clockwise (west is left)
  };
  
  const rotation = rotationMap[cardinalDirection];
  
  return (
    <div 
      className={`absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 border border-gray-200 z-50 ${className}`}
      style={{ 
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center'
      }}
      title={`Cardinal Direction: ${cardinalDirection.toUpperCase()}`}
    >
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Compass Icon */}
        <Compass className="w-12 h-12 text-gray-700" />
        
        {/* Direction Labels */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* North */}
            <div 
              className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 text-xs font-bold text-red-600"
              style={{ transform: `translate(-50%, -100%) rotate(${-rotation}deg)` }}
            >
              N
            </div>
            {/* South */}
            <div 
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 text-xs font-bold text-blue-600"
              style={{ transform: `translate(-50%, 100%) rotate(${-rotation}deg)` }}
            >
              S
            </div>
            {/* East */}
            <div 
              className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 text-xs font-bold text-green-600"
              style={{ transform: `translate(100%, -50%) rotate(${-rotation}deg)` }}
            >
              E
            </div>
            {/* West */}
            <div 
              className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 text-xs font-bold text-orange-600"
              style={{ transform: `translate(-100%, -50%) rotate(${-rotation}deg)` }}
            >
              W
            </div>
          </div>
        </div>
      </div>
      
      {/* Direction indicator */}
      <div className="text-center mt-1">
        <div className="text-xs font-semibold text-gray-700">
          {cardinalDirection.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

