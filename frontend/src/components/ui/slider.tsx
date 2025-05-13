"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  disabled?: boolean;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value = [0], min = 0, max = 100, step = 1, onValueChange, disabled = false, ...props }, ref) => {
    const trackRef = React.useRef<HTMLDivElement>(null);
    
    const currentValue = value[0] || 0;
    const percentage = Math.max(0, Math.min(100, ((currentValue - min) / (max - min)) * 100));
    
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !trackRef.current) return;
      
      const rect = trackRef.current.getBoundingClientRect();
      const clickPosition = e.clientX - rect.left;
      const percentage = clickPosition / rect.width;
      const newValue = min + Math.round(((max - min) * percentage) / step) * step;
      
      if (onValueChange) {
        onValueChange([Math.max(min, Math.min(max, newValue))]);
      }
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          disabled ? "opacity-50" : "",
          className
        )}
        {...props}
      >
        <div
          ref={trackRef}
          className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200 cursor-pointer"
          onClick={handleClick}
        >
          <div 
            className="absolute h-full bg-blue-600"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div 
          className={cn(
            "absolute block h-5 w-5 rounded-full border-2 border-blue-600 bg-white transition-all cursor-grab",
            disabled ? "cursor-not-allowed" : ""
          )}
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>
    )
  }
)

Slider.displayName = "Slider"

export { Slider }