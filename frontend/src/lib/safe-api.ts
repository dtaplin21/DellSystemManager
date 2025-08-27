/**
 * Safe API fetch functions for SSR that handle errors gracefully
 * and return fallback data to prevent page crashes
 */

const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';

/**
 * Safe fetch wrapper that handles errors and returns fallback data
 */
async function safeFetch<T>(
  url: string, 
  fallbackData: T,
  options?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(url, { 
      cache: 'no-store', // SSR
      ...options 
    });
    
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`🚨 API fetch failed: ${res.status} ${res.statusText}`, {
        url,
        status: res.status,
        statusText: res.statusText,
        responseText: text
      });
      
      // Return fallback data instead of crashing
      return fallbackData;
    }
    
    return await res.json();
  } catch (err: any) {
    console.error('🚨 API fetch threw error:', {
      url,
      error: err?.message || err,
      stack: err?.stack
    });
    
    // Return fallback data instead of crashing
    return fallbackData;
  }
}

/**
 * Safe asbuilt data fetch with fallback
 */
export async function getAsbuiltSafe(projectId: string, panelId: string) {
  const url = `${BACKEND_BASE}/api/asbuilt/${projectId}/${panelId}`;
  
  const fallbackData = {
    panelPlacement: [],
    panelSeaming: [],
    nonDestructive: [],
    trialWeld: [],
    repairs: [],
    destructive: [],
    rightNeighborPeek: null
  };
  
  return safeFetch(url, fallbackData);
}

/**
 * Safe project data fetch with fallback
 */
export async function getProjectSafe(projectId: string) {
  const url = `${BACKEND_BASE}/api/projects/ssr/${projectId}`;
  
  const fallbackData = {
    id: projectId,
    name: 'Project Loading...',
    description: 'Unable to load project details',
    status: 'unknown',
    client: 'Unknown',
    location: 'Unknown',
    startDate: null,
    endDate: null,
    area: null,
    progress: 0,
    scale: 1.0,
    layoutWidth: 15000,
    layoutHeight: 15000,
    createdAt: null,
    updatedAt: null
  };
  
  return safeFetch(url, fallbackData);
}

/**
 * Safe panel layout data fetch with fallback
 */
export async function getPanelLayoutSafe(projectId: string) {
  const url = `${BACKEND_BASE}/api/panel-layout/ssr-layout/${projectId}`;
  
  const fallbackData = {
    id: 'fallback-layout',
    projectId,
    panels: [],
    width: 4000,
    height: 4000,
    scale: 1.0,
    lastUpdated: new Date().toISOString()
  };
  
  const response = await safeFetch(url, fallbackData);
  
  // Extract layout data from the response structure
  if (response && response.success && response.layout) {
    return response.layout;
  }
  
  return fallbackData;
}

/**
 * Safe document list fetch with fallback
 */
export async function getDocumentsSafe(projectId: string) {
  const url = `${BACKEND_BASE}/api/documents/${projectId}`;
  
  const fallbackData = {
    documents: [],
    total: 0,
    categories: {
      plans: [],
      specifications: [],
      reports: [],
      other: []
    }
  };
  
  return safeFetch(url, fallbackData);
}

/**
 * Health check for backend connectivity
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_BASE}/health`, { 
      cache: 'no-store',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    return res.ok;
  } catch (err) {
    console.error('🚨 Backend health check failed:', err);
    return false;
  }
}

/**
 * Get backend status for debugging
 */
export function getBackendStatus() {
  return {
    baseUrl: BACKEND_BASE,
    hasBackendUrl: !!process.env.NEXT_PUBLIC_BACKEND_URL,
    hasBackendUrlServer: !!process.env.BACKEND_URL
  };
}
