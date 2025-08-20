import { useState, useRef, useCallback, useEffect } from 'react'

export interface UseFullscreenCanvasReturn {
  isFullscreen: boolean
  fullscreenCanvasRef: React.RefObject<HTMLCanvasElement>
  toggleFullscreen: () => void
  fullscreenCanvasWidth: number
  fullscreenCanvasHeight: number
}

export interface UseFullscreenCanvasOptions {
  canvasWidth: number
  canvasHeight: number
  toast: (options: { title: string; description: string }) => void
}

export const useFullscreenCanvas = (options: UseFullscreenCanvasOptions): UseFullscreenCanvasReturn => {
  const {
    canvasWidth,
    canvasHeight,
    toast
  } = options

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenCanvasWidth, setFullscreenCanvasWidth] = useState(0)
  const [fullscreenCanvasHeight, setFullscreenCanvasHeight] = useState(0)
  
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null)

  // Initialize fullscreen canvas dimensions when component mounts
  useEffect(() => {
    if (canvasWidth > 0 && canvasHeight > 0 && fullscreenCanvasWidth === 0) {
      console.log('[useFullscreenCanvas] Initializing fullscreen canvas dimensions:', { canvasWidth, canvasHeight });
      setFullscreenCanvasWidth(canvasWidth);
      setFullscreenCanvasHeight(canvasHeight);
    }
  }, [canvasWidth, canvasHeight, fullscreenCanvasWidth]);

  // Simple fullscreen toggle function
  const toggleFullscreen = useCallback(() => {
    console.log('🚀 [useFullscreenCanvas] toggleFullscreen function called');
    
    if (!isFullscreen) {
      console.log('🚀 [useFullscreenCanvas] Entering fullscreen mode');
      
      // Set fullscreen dimensions
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      setFullscreenCanvasWidth(screenWidth);
      setFullscreenCanvasHeight(screenHeight);
      
      // Set fullscreen state
      setIsFullscreen(true);
      
      // Hide body overflow
      document.body.style.overflow = 'hidden';
      
      // Show success message
      toast({
        title: "Entered Fullscreen Mode",
        description: "Grid now takes up entire screen for better navigation"
      });
      
    } else {
      console.log('🚀 [useFullscreenCanvas] Exiting fullscreen mode');
      
      // Restore normal dimensions
      setFullscreenCanvasWidth(canvasWidth);
      setFullscreenCanvasHeight(canvasHeight);
      
      // Exit fullscreen state
      setIsFullscreen(false);
      
      // Restore body overflow
      document.body.style.overflow = '';
      
      // Show exit message
      toast({
        title: "Exited Fullscreen Mode",
        description: "Grid returned to normal size"
      });
    }
  }, [isFullscreen, canvasWidth, canvasHeight, toast]);

  // Cleanup fullscreen mode on unmount
  useEffect(() => {
    return () => {
      if (isFullscreen) {
        document.body.style.overflow = '';
      }
    };
  }, [isFullscreen]);

  return {
    isFullscreen,
    fullscreenCanvasRef,
    toggleFullscreen,
    fullscreenCanvasWidth,
    fullscreenCanvasHeight
  }
}
