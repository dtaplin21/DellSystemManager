/**
 * Safe API fetch functions for SSR that handle errors gracefully
 * and return fallback data to prevent page crashes
 */

import config from './config';

const BACKEND_BASE = config.backend.baseUrl;

/**
 * Safe fetch wrapper that handles errors and returns fallback data
 */
async function safeFetch<T>(
  url: string, 
  fallbackData: T,
  options?: RequestInit
): Promise<T> {
  try {
    console.log('🔍 [Safe-API] Fetching:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for SSR
    
    const res = await fetch(url, { 
      cache: 'no-store', // SSR
      signal: controller.signal,
      ...options 
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`🚨 [Safe-API] API fetch failed: ${res.status} ${res.statusText}`, {
        url,
        status: res.status,
        statusText: res.statusText,
        responseText: text
      });
      
      // Return fallback data instead of crashing
      return fallbackData;
    }
    
    const data = await res.json();
    console.log('🔍 [Safe-API] Fetch successful for:', url);
    return data;
  } catch (err: any) {
    console.error('🚨 [Safe-API] API fetch threw error:', {
      url,
      error: err?.message || err,
      stack: err?.stack
    });
    
    // Return fallback data instead of crashing
    return fallbackData;
  }
}

/**
 * Safe authenticated fetch wrapper that includes Supabase auth headers
 */
async function safeAuthenticatedFetch<T>(
  url: string, 
  fallbackData: T,
  options?: RequestInit
): Promise<T> {
  try {
    console.log('🔍 [Safe-API] Authenticated fetch:', url);
    
    // Dynamically import to avoid SSR issues
    const { getSupabaseClient } = await import('./supabase');
    
    // Get the current session
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    
    if (!session?.access_token) {
      console.warn('⚠️ [Safe-API] No auth token, returning fallback data');
      return fallbackData;
    }
    
    console.log('🔍 [Safe-API] Auth token found, making authenticated request');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, { 
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        ...options?.headers
      },
      ...options 
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`🚨 [Safe-API] Authenticated API fetch failed: ${res.status} ${res.statusText}`, {
        url,
        status: res.status,
        statusText: res.statusText,
        responseText: text
      });
      
      return fallbackData;
    }
    
    const data = await res.json();
    console.log('🔍 [Safe-API] Authenticated fetch successful for:', url);
    return data;
  } catch (err: any) {
    console.error('🚨 [Safe-API] Authenticated API fetch threw error:', {
      url,
      error: err?.message || err,
      stack: err?.stack
    });
    
    return fallbackData;
  }
}

/**
 * Safe asbuilt data fetch with fallback (authenticated)
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
    rightNeighborPeek: undefined
  };
  
  // Use authenticated fetch since asbuilt endpoint requires auth
  return safeAuthenticatedFetch(url, fallbackData);
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
  // The response might be the layout directly or wrapped in a success object
  if (response && typeof response === 'object') {
    if ('success' in response && response.success && 'layout' in response && response.layout) {
      return response.layout;
    }
    // If response is the layout directly (no wrapper)
    if ('panels' in response && 'width' in response && 'height' in response) {
      return response;
    }
  }
  
  return fallbackData;
}

/**
 * Safe document list fetch with fallback (authenticated)
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
  
  // Use authenticated fetch since documents endpoint requires auth
  return safeAuthenticatedFetch(url, fallbackData);
}

/**
 * Health check for backend connectivity
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    console.log('🔍 [Safe-API] Checking backend health at:', `${BACKEND_BASE}/health`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for SSR
    
    const res = await fetch(`${BACKEND_BASE}/health`, { 
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log('🔍 [Safe-API] Backend health response:', res.status, res.statusText);
    return res.ok;
  } catch (err) {
    console.error('🚨 [Safe-API] Backend health check failed:', err);
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
