'use client';

import React, { useState, useEffect, useRef } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function Tooltip({ 
  content, 
  children, 
  position = 'top', 
  delay = 500,
  className = '' 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updateTooltipPosition = () => {
    if (!tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const offset = 8;

    let x = mousePosition.x;
    let y = mousePosition.y;

    // Adjust position based on tooltip size and viewport
    switch (position) {
      case 'top':
        x -= rect.width / 2;
        y -= rect.height + offset;
        break;
      case 'bottom':
        x -= rect.width / 2;
        y += offset;
        break;
      case 'left':
        x -= rect.width + offset;
        y -= rect.height / 2;
        break;
      case 'right':
        x += offset;
        y -= rect.height / 2;
        break;
    }

    // Keep tooltip within viewport
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height;

    setTooltipPosition({ x, y });
  };

  useEffect(() => {
    if (isVisible) {
      updateTooltipPosition();
    }
  }, [isVisible, mousePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onMouseMove={(e) => setMousePosition({ x: e.clientX, y: e.clientY })}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`fixed z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg pointer-events-none transition-opacity duration-200 ${className}`}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}

// Hook for creating tooltips programmatically
export function useTooltip() {
  const [tooltip, setTooltip] = useState<{
    content: string;
    x: number;
    y: number;
    visible: boolean;
  }>({
    content: '',
    x: 0,
    y: 0,
    visible: false,
  });

  const showTooltip = (content: string, x: number, y: number) => {
    setTooltip({ content, x, y, visible: true });
  };

  const hideTooltip = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const TooltipComponent = () => {
    if (!tooltip.visible) return null;

    return (
      <div
        className="fixed z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg pointer-events-none"
        style={{
          left: tooltip.x + 10,
          top: tooltip.y - 30,
        }}
      >
        {tooltip.content}
      </div>
    );
  };

  return { showTooltip, hideTooltip, TooltipComponent };
} 