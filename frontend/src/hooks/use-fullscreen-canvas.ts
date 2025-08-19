import { useState, useRef, useCallback, useEffect } from 'react'
import type { Panel } from '@/types/panel'

export interface CanvasState {
  scale: number
  offsetX: number
  offsetY: number
  showGrid: boolean
  showGuides: boolean
  snapToGrid: boolean
  gridSize: number
  worldWidth: number
  worldHeight: number
  worldScale: number
}

export interface WorldDimensions {
  worldWidth: number
  worldHeight: number
  worldScale: number
}

export interface UseFullscreenCanvasReturn {
  isFullscreen: boolean
  fullscreenCanvasRef: React.RefObject<HTMLCanvasElement>
  toggleFullscreen: () => void
  fullscreenCanvasWidth: number
  fullscreenCanvasHeight: number
}

export interface UseFullscreenCanvasOptions {
  panels: Panel[]
  canvasState: CanvasState
  worldDimensions: WorldDimensions
  canvasWidth: number
  canvasHeight: number
  onCanvasStateChange: (updates: Partial<CanvasState>) => void
  onCanvasDimensionsChange: (width: number, height: number) => void
  calculatePanelBounds: (panels: Panel[]) => { minX: number; minY: number; maxX: number; maxY: number } | null
  renderCanvas: () => void
  toast: (options: { title: string; description: string }) => void
}

export const useFullscreenCanvas = (options: UseFullscreenCanvasOptions): UseFullscreenCanvasReturn => {
  const {
    panels,
    canvasState,
    worldDimensions,
    canvasWidth,
    canvasHeight,
    onCanvasStateChange,
    onCanvasDimensionsChange,
    calculatePanelBounds,
    renderCanvas,
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

  // Fullscreen toggle function
  const toggleFullscreen = useCallback(() => {
    console.log('🚀 [useFullscreenCanvas] toggleFullscreen function called');
    console.log('🚀 [useFullscreenCanvas] Current state:', {
      isFullscreen,
      canvasWidth,
      canvasHeight,
      fullscreenCanvasWidth,
      fullscreenCanvasHeight,
      windowDimensions: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      }
    });
    
    if (!isFullscreen) {
      console.log('🚀 [useFullscreenCanvas] Attempting to ENTER fullscreen mode');
      
      // Enter fullscreen mode
      const currentCanvas = fullscreenCanvasRef.current;
      const container = currentCanvas?.parentElement;
      console.log('🚀 [useFullscreenCanvas] Container element:', container);
      
      if (container) {
        console.log('🚀 [useFullscreenCanvas] Container found, proceeding with fullscreen');
        
        // Store current canvas dimensions
        console.log('🚀 [useFullscreenCanvas] Storing current canvas dimensions:', {
          width: canvasWidth,
          height: canvasHeight
        });
        setFullscreenCanvasWidth(canvasWidth);
        setFullscreenCanvasHeight(canvasHeight);
        
        // Set canvas to full screen dimensions
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        console.log('🚀 [useFullscreenCanvas] Screen dimensions:', {
          screenWidth,
          screenHeight,
          currentCanvas: { width: canvasWidth, height: canvasHeight }
        });
        
        console.log('🚀 [useFullscreenCanvas] Setting canvas dimensions to screen size');
        
        // Update canvas dimensions first
        onCanvasDimensionsChange(screenWidth, screenHeight);
        
        // Set fullscreen state immediately
        setIsFullscreen(true);
        
        // Add fullscreen styles to body
        console.log('🚀 [useFullscreenCanvas] Setting body overflow to hidden');
        document.body.style.overflow = 'hidden';
        
        // Force immediate fullscreen canvas render
        console.log('🚀 [useFullscreenCanvas] Forcing immediate fullscreen canvas render');
        setTimeout(() => {
          if (fullscreenCanvasRef.current) {
            console.log('🚀 [useFullscreenCanvas] Fullscreen canvas ref found, forcing render');
            // Force the fullscreen canvas to render
            renderCanvas();
          } else {
            console.log('🚀 [useFullscreenCanvas] Fullscreen canvas ref not found');
          }
        }, 50);
        
        // Reset viewport to fit all panels
        const bounds = calculatePanelBounds(panels);
        console.log('🚀 [useFullscreenCanvas] Panel bounds calculated:', bounds);
        
        if (bounds) {
          const { minX, minY, maxX, maxY } = bounds;
          const worldScale = canvasState.worldScale;
          const panelWidth = (maxX - minX) * worldScale;
          const panelHeight = (maxY - minY) * worldScale;
          
          console.log('🚀 [useFullscreenCanvas] Panel dimensions:', {
            minX, minY, maxX, maxY,
            worldScale,
            panelWidth,
            panelHeight
          });
          
          // Calculate scale to fit all panels with minimal padding
          const padding = 50; // Smaller padding for fullscreen
          const scaleX = (screenWidth - padding) / panelWidth;
          const scaleY = (screenHeight - padding) / panelHeight;
          const newScale = Math.min(scaleX, scaleY, 3.0); // Allow higher zoom in fullscreen
          
          console.log('🚀 [useFullscreenCanvas] Scale calculations:', {
            padding,
            scaleX,
            scaleY,
            newScale
          });
          
          // Center panels
          const offsetX = (screenWidth - panelWidth * newScale) / 2 - minX * worldScale * newScale;
          const offsetY = (screenHeight - panelHeight * newScale) / 2 - minY * worldScale * newScale;
          
          console.log('🚀 [useFullscreenCanvas] Offset calculations:', {
            offsetX,
            offsetY
          });
          
          console.log('🚀 [useFullscreenCanvas] Fullscreen viewport calculated:', {
            panelWidth,
            panelHeight,
            newScale,
            offsetX,
            offsetY
          });
          
          console.log('🚀 [useFullscreenCanvas] Updating canvas state with new scale and offset');
          onCanvasStateChange({
            scale: newScale,
            offsetX,
            offsetY
          });
        } else {
          // No panels - set default viewport for fullscreen
          console.log('🚀 [useFullscreenCanvas] No panels found - setting default fullscreen viewport');
          const defaultScale = 1.0;
          const defaultOffsetX = (screenWidth - (worldDimensions.worldWidth * worldDimensions.worldScale)) / 2;
          const defaultOffsetY = (screenHeight - (worldDimensions.worldHeight * worldDimensions.worldScale)) / 2;
          
          console.log('🚀 [useFullscreenCanvas] Default viewport:', {
            scale: defaultScale,
            offsetX: defaultOffsetX,
            offsetY: defaultOffsetY
          });
          
          onCanvasStateChange({
            scale: defaultScale,
            offsetX: defaultOffsetX,
            offsetY: defaultOffsetY
          });
        }
        
        // Force a re-render of the canvas
        console.log('🚀 [useFullscreenCanvas] Scheduling canvas re-render');
        setTimeout(() => {
          console.log('🚀 [useFullscreenCanvas] Executing delayed canvas re-render');
          const currentCanvas = fullscreenCanvasRef.current;
          if (currentCanvas) {
            console.log('🚀 [useFullscreenCanvas] Canvas ref found, triggering re-render');
            
            // Force canvas to use new dimensions
            const canvas = currentCanvas;
            canvas.width = screenWidth;
            canvas.height = screenHeight;
            
            // Trigger a re-render by updating canvas state
            onCanvasStateChange({});
            
            // Force immediate re-render
            console.log('🚀 [useFullscreenCanvas] Forcing immediate canvas re-render');
            renderCanvas();
          } else {
            console.log('🚀 [useFullscreenCanvas] Canvas ref not found during re-render');
          }
        }, 100);
        
        console.log('🚀 [useFullscreenCanvas] Showing success toast');
        toast({
          title: "Entered Fullscreen Mode",
          description: "Grid now takes up entire screen for better navigation"
        });
        
        console.log('🚀 [useFullscreenCanvas] Fullscreen entry sequence completed');
      } else {
        console.log('🚀 [useFullscreenCanvas] ERROR: Container element not found');
      }
    } else {
      console.log('🚀 [useFullscreenCanvas] Attempting to EXIT fullscreen mode');
      
      // Exit fullscreen mode
      console.log('🚀 [useFullscreenCanvas] Exiting fullscreen mode, restoring dimensions:', {
        originalWidth: fullscreenCanvasWidth,
        originalHeight: fullscreenCanvasHeight
      });
      
      // Restore original canvas dimensions
      console.log('🚀 [useFullscreenCanvas] Restoring original canvas dimensions');
      onCanvasDimensionsChange(fullscreenCanvasWidth, fullscreenCanvasHeight);
      
      // Reset viewport to fit all panels in normal mode
      const bounds = calculatePanelBounds(panels);
      console.log('🚀 [useFullscreenCanvas] Panel bounds for normal mode:', bounds);
      
      if (bounds) {
        const { minX, minY, maxX, maxY } = bounds;
        const worldScale = canvasState.worldScale;
        const panelWidth = (maxX - minX) * worldScale;
        const panelHeight = (maxY - minY) * worldScale;
        
        console.log('🚀 [useFullscreenCanvas] Normal mode panel dimensions:', {
          panelWidth,
          panelHeight,
          worldScale
        });
        
        const padding = 100;
        const scaleX = (fullscreenCanvasWidth - padding) / panelWidth;
        const scaleY = (fullscreenCanvasHeight - padding) / panelHeight;
        const newScale = Math.min(scaleX, scaleY, 2.0);
        
        console.log('🚀 [useFullscreenCanvas] Normal mode scale calculations:', {
          padding,
          scaleX,
          scaleY,
          newScale
        });
        
        const offsetX = (fullscreenCanvasWidth - panelWidth * newScale) / 2 - minX * worldScale * newScale;
        const offsetY = (fullscreenCanvasHeight - panelHeight * newScale) / 2 - minY * worldScale * newScale;
        
        console.log('🚀 [useFullscreenCanvas] Normal mode offset calculations:', {
          offsetX,
          offsetY
        });
        
        console.log('🚀 [useFullscreenCanvas] Updating canvas state for normal mode');
        onCanvasStateChange({
          scale: newScale,
          offsetX,
          offsetY
        });
      }
      
      console.log('🚀 [useFullscreenCanvas] Setting isFullscreen to false');
      setIsFullscreen(false);
      
      // Remove fullscreen styles from body
      console.log('🚀 [useFullscreenCanvas] Restoring body overflow');
      document.body.style.overflow = '';
      
      // Force a re-render of the canvas
      console.log('🚀 [useFullscreenCanvas] Scheduling normal mode canvas re-render');
      setTimeout(() => {
        console.log('🚀 [useFullscreenCanvas] Executing delayed normal mode canvas re-render');
        const currentCanvas = fullscreenCanvasRef.current;
        if (currentCanvas) {
          console.log('🚀 [useFullscreenCanvas] Canvas ref found for normal mode re-render');
          // Trigger a re-render by updating canvas state
          onCanvasStateChange({});
        } else {
          console.log('🚀 [useFullscreenCanvas] Canvas ref not found during normal mode re-render');
        }
      }, 100);
      
      console.log('🚀 [useFullscreenCanvas] Showing exit toast');
      toast({
        title: "Exited Fullscreen Mode",
        description: "Grid returned to normal size"
      });
      
      console.log('🚀 [useFullscreenCanvas] Fullscreen exit sequence completed');
    }
  }, [isFullscreen, canvasWidth, canvasHeight, fullscreenCanvasWidth, fullscreenCanvasHeight, panels, canvasState.worldScale, canvasState, worldDimensions, onCanvasStateChange, onCanvasDimensionsChange, calculatePanelBounds, renderCanvas, toast]);

  // Cleanup fullscreen mode on unmount
  useEffect(() => {
    return () => {
      if (isFullscreen) {
        document.body.style.overflow = '';
      }
    };
  }, [isFullscreen]);

  // Monitor fullscreen state changes
  useEffect(() => {
    console.log('🚀 [useFullscreenCanvas] isFullscreen state changed to:', isFullscreen);
    console.log('🚀 [useFullscreenCanvas] Current canvas dimensions:', { canvasWidth, canvasHeight });
    
    const currentCanvas = fullscreenCanvasRef.current;
    console.log('🚀 [useFullscreenCanvas] Canvas ref exists:', !!currentCanvas);
    
    if (isFullscreen) {
      console.log('🚀 [useFullscreenCanvas] Fullscreen mode activated - checking canvas wrapper');
      const canvasWrapper = document.querySelector('.canvas-wrapper');
      console.log('🚀 [useFullscreenCanvas] Canvas wrapper element:', canvasWrapper);
      if (canvasWrapper) {
        console.log('🚀 [useFullscreenCanvas] Canvas wrapper styles:', {
          position: getComputedStyle(canvasWrapper).position,
          width: getComputedStyle(canvasWrapper).width,
          height: getComputedStyle(canvasWrapper).height,
          zIndex: getComputedStyle(canvasWrapper).zIndex
        });
      }
      
      // Also check canvas element
      if (currentCanvas) {
        console.log('🚀 [useFullscreenCanvas] Canvas element in fullscreen mode:', {
          width: currentCanvas.width,
          height: currentCanvas.height,
          styleWidth: currentCanvas.style.width,
          styleHeight: currentCanvas.style.height
        });
        
        // Force apply fullscreen styles to canvas element
        const canvas = currentCanvas;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Set canvas dimensions directly
        canvas.width = screenWidth;
        canvas.height = screenHeight;
        
        // Force apply fullscreen styles
        canvas.style.setProperty('width', '100vw', 'important');
        canvas.style.setProperty('height', '100vh', 'important');
        canvas.style.setProperty('position', 'absolute', 'important');
        canvas.style.setProperty('top', '0', 'important');
        canvas.style.setProperty('left', '0', 'important');
        canvas.style.setProperty('z-index', '1', 'important');
        
        console.log('🚀 [useFullscreenCanvas] Forced fullscreen styles applied to canvas element:', {
          width: canvas.width,
          height: canvas.height,
          styleWidth: canvas.style.width,
          styleHeight: canvas.style.height
        });
      }
    } else {
      // Exit fullscreen - restore canvas to normal dimensions
      if (currentCanvas) {
        const canvas = currentCanvas;
        
        // Restore original dimensions
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Restore normal styles
        canvas.style.removeProperty('width');
        canvas.style.removeProperty('height');
        canvas.style.removeProperty('position');
        canvas.style.removeProperty('top');
        canvas.style.removeProperty('left');
        canvas.style.removeProperty('z-index');
        
        console.log('🚀 [useFullscreenCanvas] Canvas restored to normal mode:', {
          width: canvas.width,
          height: canvas.height
        });
      }
    }
  }, [isFullscreen, canvasWidth, canvasHeight]);

  return {
    isFullscreen,
    fullscreenCanvasRef,
    toggleFullscreen,
    fullscreenCanvasWidth,
    fullscreenCanvasHeight
  }
}
