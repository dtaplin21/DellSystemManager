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
  toggleSidebar: () => void
  openSidebar: () => void
  closeSidebar: () => void
  // NEW: Mini-sidebar state and controls
  miniSidebarVisible: boolean
  miniSidebarExpanded: boolean
  toggleMiniSidebar: () => void
  expandMiniSidebar: () => void
  collapseMiniSidebar: () => void
  hideMiniSidebar: () => void
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
  
  // NEW: Mini-sidebar state management
  const [miniSidebarVisible, setMiniSidebarVisible] = useState(false)
  const [miniSidebarExpanded, setMiniSidebarExpanded] = useState(false)
  
  // Debug effect to track state changes
  useEffect(() => {
    console.log('🚀 [useFullscreenCanvas] State changed:', {
      miniSidebarVisible,
      miniSidebarExpanded,
      selectedPanel: selectedPanel?.id
    });
  }, [miniSidebarVisible, miniSidebarExpanded, selectedPanel]);
  
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null)

  // NEW: Panel interaction functions for fullscreen mode
  const handlePanelClick = useCallback((panel: any) => {
    console.log('🚀 [useFullscreenCanvas] Panel clicked in fullscreen:', panel);
    console.log('🚀 [useFullscreenCanvas] Current selectedPanel:', selectedPanel?.id);
    console.log('🚀 [useFullscreenCanvas] Current miniSidebarExpanded:', miniSidebarExpanded);
    
    // If clicking the same panel, toggle mini-sidebar expansion
    if (selectedPanel?.id === panel.id) {
      console.log('🚀 [useFullscreenCanvas] Same panel clicked, toggling mini-sidebar expansion');
      setMiniSidebarExpanded(prev => {
        const newState = !prev;
        console.log('🚀 [useFullscreenCanvas] Toggling miniSidebarExpanded from', prev, 'to', newState);
        return newState;
      });
    } else {
      // If clicking a different panel, select it and show mini-sidebar
      console.log('🚀 [useFullscreenCanvas] New panel selected, showing mini-sidebar');
      setSelectedPanel(panel);
      setMiniSidebarVisible(true);
      setMiniSidebarExpanded(false);
      console.log('🚀 [useFullscreenCanvas] Set selectedPanel to:', panel.id);
      console.log('🚀 [useFullscreenCanvas] Set miniSidebarVisible to: true');
      console.log('🚀 [useFullscreenCanvas] Set miniSidebarExpanded to: false');
    }
  }, [selectedPanel, miniSidebarExpanded]);

  const toggleSidebar = useCallback(() => {
    console.log('🚀 [useFullscreenCanvas] Toggling sidebar manually');
    setSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    console.log('🚀 [useFullscreenCanvas] Closing sidebar');
    setSidebarOpen(false);
    // Don't clear selectedPanel - keep it for when sidebar reopens
  }, []);

  const openSidebar = useCallback(() => {
    if (selectedPanel) {
      console.log('🚀 [useFullscreenCanvas] Opening sidebar for selected panel');
      setSidebarOpen(true);
    } else {
      console.log('🚀 [useFullscreenCanvas] No panel selected, cannot open sidebar');
    }
  }, [selectedPanel]);
  
  // NEW: Mini-sidebar control functions
  const toggleMiniSidebar = useCallback(() => {
    console.log('🚀 [useFullscreenCanvas] Toggling mini-sidebar expansion');
    console.log('🚀 [useFullscreenCanvas] Current miniSidebarExpanded state:', miniSidebarExpanded);
    setMiniSidebarExpanded(prev => {
      const newState = !prev;
      console.log('🚀 [useFullscreenCanvas] Setting miniSidebarExpanded to:', newState);
      return newState;
    });
  }, [miniSidebarExpanded]);
  
  const expandMiniSidebar = useCallback(() => {
    console.log('🚀 [useFullscreenCanvas] Expanding mini-sidebar');
    console.log('🚀 [useFullscreenCanvas] Setting miniSidebarExpanded to true');
    setMiniSidebarExpanded(true);
  }, []);
  
  const collapseMiniSidebar = useCallback(() => {
    console.log('🚀 [useFullscreenCanvas] Collapsing mini-sidebar');
    console.log('🚀 [useFullscreenCanvas] Setting miniSidebarExpanded to false');
    setMiniSidebarExpanded(false);
  }, []);
  
  const hideMiniSidebar = useCallback(() => {
    console.log('🚀 [useFullscreenCanvas] Hiding mini-sidebar');
    setMiniSidebarVisible(false);
    setMiniSidebarExpanded(false);
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
      setMiniSidebarVisible(false);
      setMiniSidebarExpanded(false);
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

  // Handle ESC key to exit fullscreen or close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        
        // If mini-sidebar is expanded, collapse it first
        if (miniSidebarExpanded) {
          console.log('🚀 [useFullscreenCanvas] ESC key pressed, collapsing mini-sidebar');
          setMiniSidebarExpanded(false);
        } else if (miniSidebarVisible) {
          // If mini-sidebar is visible but not expanded, hide it
          console.log('🚀 [useFullscreenCanvas] ESC key pressed, hiding mini-sidebar');
          hideMiniSidebar();
        } else {
          // If sidebar is closed, exit fullscreen
          console.log('🚀 [useFullscreenCanvas] ESC key pressed, exiting fullscreen');
          setIsFullscreen(false);
          // Restore body overflow
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
          // Restore normal dimensions
          setFullscreenCanvasWidth(canvasWidth);
          setFullscreenCanvasHeight(canvasHeight);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, sidebarOpen, canvasWidth, canvasHeight]); // Depend on values, not functions

  // Debug logging for state changes (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 [useFullscreenCanvas] State changed:', { 
        isFullscreen, 
        fullscreenCanvasWidth, 
        fullscreenCanvasHeight,
        selectedPanel: selectedPanel?.id || null,
        sidebarOpen,
        miniSidebarVisible,
        miniSidebarExpanded
      });
    }
  }, [isFullscreen, fullscreenCanvasWidth, fullscreenCanvasHeight, selectedPanel, sidebarOpen, miniSidebarVisible, miniSidebarExpanded]);

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
    toggleSidebar,
    openSidebar,
    closeSidebar,
    // NEW: Mini-sidebar state and controls
    miniSidebarVisible,
    miniSidebarExpanded,
    toggleMiniSidebar,
    expandMiniSidebar,
    collapseMiniSidebar,
    hideMiniSidebar
  }
}
