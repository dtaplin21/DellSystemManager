import { useState, useRef, useCallback, useEffect } from 'react'

export interface UseFullscreenCanvasReturn {
  isFullscreen: boolean
  fullscreenCanvasRef: React.RefObject<HTMLCanvasElement>
  toggleFullscreen: () => void
  fullscreenCanvasWidth: number
  fullscreenCanvasHeight: number
  // NEW: Panel interaction in fullscreen mode
  selectedPanel: any | null
  sidebarOpen: boolean
  handlePanelClick: (panel: any) => void
  closeSidebar: () => void
}

export interface UseFullscreenCanvasOptions {
  canvasWidth: number
  canvasHeight: number
  toast: (options: { title?: string; description?: string; variant?: 'default' | 'destructive' | 'success' }) => void
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
  
  // NEW: Panel interaction state for fullscreen mode
  const [selectedPanel, setSelectedPanel] = useState<any | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null)

  // NEW: Panel interaction functions for fullscreen mode
  const handlePanelClick = useCallback((panel: any) => {
    console.log('🚀 [useFullscreenCanvas] Panel clicked in fullscreen:', panel);
    setSelectedPanel(panel);
    setSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    console.log('🚀 [useFullscreenCanvas] Closing sidebar');
    setSidebarOpen(false);
    setSelectedPanel(null);
  }, []);

  // Initialize fullscreen canvas dimensions when component mounts
  useEffect(() => {
    if (canvasWidth > 0 && canvasHeight > 0) {
      // Always keep fullscreen dimensions ready
      setFullscreenCanvasWidth(window.innerWidth || canvasWidth);
      // Account for toolbar height (approximately 64px) in fullscreen mode
      setFullscreenCanvasHeight((window.innerHeight - 64) || canvasHeight);
    }
  }, [canvasWidth, canvasHeight]);

  // Simple fullscreen toggle function - SIMPLIFIED FOR TESTING
  const toggleFullscreen = useCallback(() => {
    console.log('🚀 [useFullscreenCanvas] toggleFullscreen function called');
    
    // Use functional update to avoid circular dependency
    setIsFullscreen(prevIsFullscreen => {
      console.log('🚀 [useFullscreenCanvas] Current isFullscreen state:', prevIsFullscreen);
      
      if (!prevIsFullscreen) {
        console.log('🚀 [useFullscreenCanvas] ENTERING fullscreen mode');
        
        // Set fullscreen dimensions FIRST, before state change
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        console.log('🚀 [useFullscreenCanvas] Screen dimensions:', { screenWidth, screenHeight });
        
        // Use React's batch update for better performance
        Promise.resolve().then(() => {
          setFullscreenCanvasWidth(screenWidth);
          // Account for toolbar height (approximately 64px) in fullscreen mode
          setFullscreenCanvasHeight(screenHeight - 64);
        });
        
        // Hide body overflow BEFORE state change
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        
        // Return new state (toast will be handled in useEffect)
        return true;
        
      } else {
        console.log('🚀 [useFullscreenCanvas] EXITING fullscreen mode');
        
        // Restore body overflow
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        
        // Restore normal dimensions LAST
        Promise.resolve().then(() => {
          setFullscreenCanvasWidth(canvasWidth);
          setFullscreenCanvasHeight(canvasHeight);
        });
        
        // Return new state (toast will be handled in useEffect)
        return false;
      }
    });
  }, [canvasWidth, canvasHeight]); // Removed toast dependency

    // Store toast function in ref to prevent infinite loops
  const toastRef = useRef(toast);
  
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Handle toast messages after state changes to avoid render cycle issues
  useEffect(() => {
    // Only show toast once per state change, not on every render
    if (isFullscreen) {
      // Show success message after entering fullscreen
      if (toastRef.current) {
        try {
          // Use setTimeout to ensure this runs after the render cycle
          setTimeout(() => {
            if (toastRef.current) {
              toastRef.current({
                title: "Entered Fullscreen Mode",
                description: "Grid now takes up entire screen for better navigation",
                variant: 'success'
              });
            }
          }, 0);
        } catch (error) {
          console.error('🚀 [useFullscreenCanvas] Toast error:', error);
        }
      }
    } else {
      // Show exit message after exiting fullscreen
      if (toastRef.current) {
        try {
          // Use setTimeout to ensure this runs after the render cycle
          setTimeout(() => {
            if (toastRef.current) {
              toastRef.current({
                title: "Exited Fullscreen Mode",
                description: "Grid returned to normal size",
                variant: 'default'
              });
            }
          }, 0);
        } catch (error) {
          console.error('🚀 [useFullscreenCanvas] Toast error:', error);
        }
      }
    }
  }, [isFullscreen]); // Only depend on isFullscreen, not toast

  // Cleanup fullscreen mode on unmount and when exiting fullscreen
  useEffect(() => {
    return () => {
      if (isFullscreen) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    };
  }, [isFullscreen]);

  // Reset panel state when exiting fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      console.log('🚀 [useFullscreenCanvas] Exiting fullscreen, resetting panel state');
      setSelectedPanel(null);
      setSidebarOpen(false);
    }
  }, [isFullscreen]);

  // Handle window resize in fullscreen mode
  useEffect(() => {
    const handleResize = () => {
      if (isFullscreen) {
        console.log('🚀 [useFullscreenCanvas] Window resized in fullscreen mode');
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        setFullscreenCanvasWidth(screenWidth);
        // Account for toolbar height (approximately 64px) in fullscreen mode
        setFullscreenCanvasHeight(screenHeight - 64);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        console.log('🚀 [useFullscreenCanvas] ESC key pressed, exiting fullscreen');
        e.preventDefault();
        // Use functional update to avoid dependency issues
        setIsFullscreen(false);
        // Restore body overflow
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        // Restore normal dimensions
        setFullscreenCanvasWidth(canvasWidth);
        setFullscreenCanvasHeight(canvasHeight);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, canvasWidth, canvasHeight]); // Depend on values, not functions

  // Debug logging for state changes (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 [useFullscreenCanvas] State changed:', { 
        isFullscreen, 
        fullscreenCanvasWidth, 
        fullscreenCanvasHeight,
        selectedPanel: selectedPanel?.id || null,
        sidebarOpen
      });
    }
  }, [isFullscreen, fullscreenCanvasWidth, fullscreenCanvasHeight, selectedPanel, sidebarOpen]);

  return {
    isFullscreen,
    fullscreenCanvasRef,
    toggleFullscreen,
    fullscreenCanvasWidth,
    fullscreenCanvasHeight,
    // NEW: Panel interaction properties
    selectedPanel,
    sidebarOpen,
    handlePanelClick,
    closeSidebar
  }
}
