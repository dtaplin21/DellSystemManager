import { supabase, getCurrentSession } from './supabase';

const BACKEND_URL = 'http://localhost:8003';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Health check function to test backend connectivity
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    console.log('🔍 [DEBUG] Checking backend connectivity...');
    const response = await fetch(`${BACKEND_URL}/api/projects`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    // Even if we get a 401 (no token), it means the backend is reachable
    if (response.status === 401) {
      console.log('✅ Backend is reachable (authentication required)');
      return true;
    } else if (response.ok) {
      console.log('✅ Backend is healthy and responding');
      return true;
    } else {
      console.warn('⚠️ Backend responded but with error:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Backend connectivity check failed:', error);
    return false;
  }
};

// Development mode authentication helper
export const createDevelopmentSession = async (): Promise<string | null> => {
  if (!IS_DEVELOPMENT) return null;
  
  try {
    console.log('🔧 [DEBUG] Attempting development mode authentication...');
    
    // Try to create a development session
    const response = await fetch(`${BACKEND_URL}/api/auth/dev-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Development-Mode': 'true',
      },
      body: JSON.stringify({
        mode: 'development',
        timestamp: Date.now(),
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Development session created:', data);
      return data.token || null;
    } else {
      console.warn('⚠️ Development auth endpoint not available:', response.status);
      return null;
    }
  } catch (error) {
    console.warn('⚠️ Development authentication failed:', error);
    return null;
  }
};

// Helper function to get auth headers using Supabase's native token management
export const getAuthHeaders = async () => {
  try {
    console.log('🔍 getAuthHeaders: Getting auth headers...');
    
    // Try to get current session with retry logic
    let session = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries && !session) {
      try {
        session = await getCurrentSession();
        if (session) break;
      } catch (sessionError) {
        console.warn(`⚠️ Session attempt ${retryCount + 1} failed:`, sessionError);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
    }
    
    console.log('🔍 getAuthHeaders: Session data:', session ? { 
      hasAccessToken: !!session.access_token,
      expiresAt: session.expires_at,
      userId: session.user?.id,
      tokenPreview: session.access_token ? session.access_token.substring(0, 20) + '...' : 'none'
    } : 'No session');
    
    // If no session, try to get from localStorage as fallback
    if (!session && typeof window !== 'undefined') {
      try {
        const storedSession = localStorage.getItem('supabase.auth.token');
        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          if (parsed && parsed.access_token) {
            console.log('🔄 Using stored session token as fallback');
            session = { access_token: parsed.access_token };
          }
        }
      } catch (localStorageError) {
        console.warn('⚠️ Failed to read localStorage session:', localStorageError);
      }
    }
    
    // If still no session and in development mode, try development authentication
    if (!session && IS_DEVELOPMENT) {
      try {
        const devToken = await createDevelopmentSession();
        if (devToken) {
          console.log('🔧 Using development mode token');
          session = { access_token: devToken };
        }
      } catch (devAuthError) {
        console.warn('⚠️ Development authentication failed:', devAuthError);
      }
    }
    
    const headers = {
      'Content-Type': 'application/json',
      ...(session?.access_token && {
        'Authorization': `Bearer ${session.access_token}`
      })
    };
    
    console.log('✅ getAuthHeaders: Generated headers:', {
      hasAuthorization: !!headers.Authorization,
      authorizationPreview: headers.Authorization ? headers.Authorization.substring(0, 30) + '...' : 'none'
    });
    
    return headers;
  } catch (error) {
    console.error('❌ getAuthHeaders: Error getting auth headers:', error);
    return {
      'Content-Type': 'application/json'
    };
  }
};

// Helper function to make authenticated API calls with automatic retry
const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}, retryCount = 0) => {
  try {
    console.log(`🔍 makeAuthenticatedRequest: Making request to ${url} (attempt ${retryCount + 1})`);
    
    const headers = await getAuthHeaders();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
          const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
        // Add development mode header in development environment
        ...(IS_DEVELOPMENT && { 'X-Development-Mode': 'true' }),
      },
      credentials: 'include',
      cache: options.cache || 'default',
      signal: controller.signal,
    });
      
      clearTimeout(timeoutId);
      
      if (response.status === 401 && retryCount < 1) {
        console.log('🔄 Received 401, attempting token refresh...');
        
        try {
          // Try to refresh the session using Supabase's native refresh
          const { data: refreshed, error } = await supabase.auth.refreshSession();
          
          if (!error && refreshed.session) {
            console.log('✅ Token refreshed successfully, retrying request...');
            return makeAuthenticatedRequest(url, options, retryCount + 1);
          } else {
            console.error('❌ Token refresh failed:', error);
            // Clear session and redirect to login
            await supabase.auth.signOut();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            throw new Error('Session expired. Please log in again.');
          }
        } catch (refreshError) {
          console.error('❌ Network error during token refresh:', refreshError);
          
          // Check if it's a network connectivity issue
          if (refreshError instanceof Error && (refreshError.message.includes('fetch') || 
              refreshError.message.includes('network') ||
              refreshError.message.includes('ERR_INTERNET_DISCONNECTED'))) {
            throw new Error('Network connection lost. Please check your internet connection and try again.');
          }
          
          // For other errors, clear session and redirect
          await supabase.auth.signOut();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          throw new Error('Authentication failed. Please log in again.');
        }
      }
      
      return response;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Handle fetch-specific errors
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout. Please try again.');
        }
        if (fetchError.message.includes('fetch') || fetchError.message.includes('network')) {
          throw new Error('Network error. Please check your connection and try again.');
        }
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('❌ makeAuthenticatedRequest error:', error);
    
    // Handle network connectivity errors
    if (error instanceof Error && (error.message.includes('fetch') || 
        error.message.includes('network') ||
        error.message.includes('ERR_INTERNET_DISCONNECTED'))) {
      throw new Error('Network connection lost. Please check your internet connection and try again.');
    }
    
    throw error;
  }
};

export async function fetchProjectById(id: string): Promise<any> {
  try {
    console.log('🔍 [DEBUG] fetchProjectById called with ID:', id);
    
    // First attempt: with authentication
    try {
      const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/projects/${id}`);
      
      console.log('🔍 [DEBUG] fetchProjectById response status:', response.status);
      console.log('🔍 [DEBUG] fetchProjectById response ok:', response.ok);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in.');
        }
        if (response.status === 404) {
          throw new Error('Project not found.');
        }
        throw new Error(`Failed to fetch project: ${response.statusText}`);
      }
      
      const projectData = await response.json();
      console.log('🔍 [DEBUG] fetchProjectById raw response data:', projectData);
      console.log('🔍 [DEBUG] fetchProjectById project name:', projectData?.name);
      console.log('🔍 [DEBUG] fetchProjectById project keys:', projectData ? Object.keys(projectData) : 'No data');
      
      return projectData;
    } catch (authError) {
      console.warn('⚠️ Authenticated request failed, trying without auth:', authError);
      
      // Fallback: try without authentication
      const fallbackResponse = await fetch(`${BACKEND_URL}/api/projects/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(IS_DEVELOPMENT && { 'X-Development-Mode': 'true' }),
        },
      });
      
      if (fallbackResponse.ok) {
        const projectData = await fallbackResponse.json();
        console.log('🔄 [DEBUG] fetchProjectById fallback successful:', projectData);
        return projectData;
      } else {
        throw new Error(`Fallback request failed: ${fallbackResponse.statusText}`);
      }
    }
  } catch (error) {
    console.error('🔍 [DEBUG] fetchProjectById error:', error);
    
    // Final fallback: return mock data for development
    if (IS_DEVELOPMENT) {
      console.log('🔧 [DEBUG] Returning mock project data for development');
      return {
        id: id,
        name: 'Development Project',
        description: 'Mock project for development testing',
        status: 'active',
        client: 'Development Client',
        location: 'Development Location',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        area: 1000,
        progress: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        scale: 1.0,
        layoutWidth: 4000,
        layoutHeight: 4000,
        panels: []
      };
    }
    
    throw error;
  }
}

export async function fetchProjects(): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/projects`);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in.');
      }
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Fetch projects error:', error);
    throw error;
  }
}

export async function fetchPanelLayout(projectId: string): Promise<any> {
  try {
    console.log('🔍 [DEBUG] fetchPanelLayout called with projectId:', projectId);
    
    // First attempt: with authentication
    try {
      const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panels/layout/${projectId}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in.');
        }
        if (response.status === 404) {
          throw new Error('Panel layout not found.');
        }
        throw new Error(`Failed to fetch panel layout: ${response.statusText}`);
      }
      
      const layoutData = await response.json();
      console.log('🔍 [DEBUG] fetchPanelLayout successful:', layoutData);
      return layoutData;
    } catch (authError) {
      console.warn('⚠️ Authenticated panel layout request failed, trying without auth:', authError);
      
      // Fallback: try without authentication
      const fallbackResponse = await fetch(`${BACKEND_URL}/api/panels/layout/${projectId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(IS_DEVELOPMENT && { 'X-Development-Mode': 'true' }),
        },
        cache: 'no-store'
      });
      
      if (fallbackResponse.ok) {
        const layoutData = await fallbackResponse.json();
        console.log('🔄 [DEBUG] fetchPanelLayout fallback successful:', layoutData);
        return layoutData;
      } else {
        throw new Error(`Fallback panel layout request failed: ${fallbackResponse.statusText}`);
      }
    }
  } catch (error) {
    console.error('🔍 [DEBUG] fetchPanelLayout error:', error);
    
    // Final fallback: return mock data for development
    if (IS_DEVELOPMENT) {
      console.log('🔧 [DEBUG] Returning mock panel layout data for development');
      return {
        id: `layout-${projectId}`,
        projectId: projectId,
        panels: [
          {
            id: 'dev-panel-1',
            shape: 'rectangle',
            x: 1000,
            y: 1000,
            width: 200,
            height: 150,
            length: 150,
            rotation: 0,
            fill: '#3b82f6',
            color: '#3b82f6',
            rollNumber: 'DEV-001',
            panelNumber: '1',
            date: new Date().toISOString(),
            location: 'Development',
            meta: {
              repairs: [],
              location: { x: 1000, y: 1000, gridCell: { row: 0, col: 0 } }
            }
          }
        ],
        width: 4000,
        height: 4000,
        scale: 1.0,
        lastUpdated: new Date().toISOString()
      };
    }
    
    throw error;
  }
}

export async function exportPanelLayoutToCAD(projectId: string, format: string): Promise<Blob | null> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panel-layout/export`, {
      method: 'POST',
      body: JSON.stringify({ projectId, format })
    });
    
    if (response.ok) {
      return await response.blob();
    }
    return null;
  } catch (error) {
    console.error('Export error:', error);
    return null;
  }
}

export async function fetchNotifications(): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/notifications`);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in.');
      }
      throw new Error(`Failed to fetch notifications: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Fetch notifications error:', error);
    throw error;
  }
}

export async function fetchProjectStats(): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/projects/stats`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch project stats');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching project stats:', error);
    throw error;
  }
}

export async function analyzeDocuments(projectId: string, documentIds: string[], question: string): Promise<any> {
  try {
    console.log('🔍 analyzeDocuments called with:', { projectId, documentIds, question });
    
    // Get the full document data for the selected documents
    const documents = await fetchDocuments(projectId);
    console.log('📄 Fetched documents:', documents.length);
    
    const selectedDocs = documents.filter((doc: any) => documentIds.includes(doc.id));
    console.log('📄 Selected documents:', selectedDocs.length);
    
    // Log document details for debugging
    selectedDocs.forEach((doc: any, index: number) => {
      console.log(`📄 Document ${index + 1}:`, {
        id: doc.id,
        name: doc.name,
        hasTextContent: !!doc.textContent,
        hasTextContentAlt: !!doc.text_content,
        hasContent: !!doc.content,
        textLength: doc.textContent ? doc.textContent.length : 0
      });
    });
    
    const requestBody = {
      projectId, 
      question,
      documents: selectedDocs.map((doc: any) => ({
        id: doc.id,
        filename: doc.name,
        text: doc.textContent || doc.text_content || doc.content || ''
      }))
    };
    
    console.log('📤 Sending request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/ai/query`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Response error text:', errorText);
      throw new Error('Failed to analyze documents');
    }
    
    const result = await response.json();
    console.log('✅ Analysis result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error analyzing documents:', error);
    throw error;
  }
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/documents/${documentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
}

export async function uploadDocument(projectId: string, file: File): Promise<any> {
  console.log('🔍 uploadDocument called with:', { projectId, fileName: file.name, fileSize: file.size });
  
  const formData = new FormData();
  formData.append('documents', file); // Changed from 'document' to 'documents' to match backend expectation

  const headers = await getAuthHeaders();
  // Remove Content-Type for FormData
  const { 'Content-Type': _, ...formHeaders } = headers;

  console.log('📤 Making upload request to:', `${BACKEND_URL}/api/documents/${projectId}/upload`);
  console.log('📤 Headers:', formHeaders);
  console.log('📤 FormData entries:', Array.from(formData.entries()));

  const response = await fetch(`${BACKEND_URL}/api/documents/${projectId}/upload`, {
    method: 'POST',
    headers: formHeaders,
    body: formData
  });

  console.log('📥 Response status:', response.status);
  console.log('📥 Response ok:', response.ok);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Upload failed:', errorText);
    throw new Error(`Failed to upload document: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('✅ Upload successful:', result);
  return result;
}

export async function createProject(data: {
  name: string;
  description?: string;
  client?: string;
  location?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  area?: string;
}): Promise<any> {
  const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/projects`, {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create project' }));
    throw new Error(error.message || 'Failed to create project');
  }

  return response.json();
}

export async function deleteProject(projectId: string): Promise<void> {
  const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/projects/${projectId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete project' }));
    throw new Error(error.message || 'Failed to delete project');
  }
}

export async function updateProject(projectId: string, data: {
  name?: string;
  description?: string;
  location?: string;
  status?: string;
  scale?: number;
  layoutWidth?: number;
  layoutHeight?: number;
  panels?: any[];
}): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in.');
      }
      if (response.status === 404) {
        throw new Error('Project not found.');
      }
      throw new Error(`Failed to update project: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Update project error:', error);
    throw error;
  }
}

export async function updatePanelLayout(projectId: string, data: {
  panels?: any[];
  width?: number;
  height?: number;
  scale?: number;
}): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panels/layout/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in.');
      }
      if (response.status === 404) {
        throw new Error('Panel layout not found.');
      }
      throw new Error(`Failed to update panel layout: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Update panel layout error:', error);
    throw error;
  }
}

export async function importQCDataFromExcel(projectId: string, file: File, options: {
  hasHeaderRow: boolean;
  typeColumn: string;
  panelIdColumn: string;
  dateColumn: string;
  resultColumn: string;
  technicianColumn: string;
}): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('options', JSON.stringify(options));

  const headers = await getAuthHeaders();
  // Remove Content-Type for FormData
  const { 'Content-Type': _, ...formHeaders } = headers;

  const response = await fetch(`${BACKEND_URL}/api/qc-data/${projectId}/import`, {
    method: 'POST',
    headers: formHeaders,
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to import QC data');
  }

  return response.json();
}

export async function addQCData(projectId: string, data: {
  type: string;
  panelId: string;
  date: string;
  result: string;
  technician: string;
  temperature?: number;
  pressure?: number;
  speed?: number;
  notes?: string;
}): Promise<any> {
  const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/qc-data/${projectId}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to add QC data');
  }

  return response.json();
}

export async function createCheckoutSession(plan: 'basic' | 'premium'): Promise<{ sessionId: string }> {
  const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/subscription/create-checkout-session`, {
    method: 'POST',
    body: JSON.stringify({ plan })
  });

  if (!response.ok) {
    throw new Error('Failed to create checkout session');
  }

  return response.json();
}

export async function fetchDocuments(projectId: string): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/documents/${projectId}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in.');
      }
      throw new Error(`Failed to fetch documents: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch documents error:', error);
    throw error;
  }
}

export async function fetchQCData(projectId: string): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/qc-data/${projectId}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in.');
      }
      throw new Error(`Failed to fetch QC data: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Fetch QC data error:', error);
    throw error;
  }
}

export async function scanHandwriting(file: File, projectId: string): Promise<any> {
  try {
    const formData = new FormData();
    formData.append('qcForm', file);
    formData.append('projectId', projectId);

    const authHeaders = await getAuthHeaders();
    const { 'Content-Type': _, ...headers } = authHeaders; // Remove Content-Type for FormData

    const response = await fetch(`${BACKEND_URL}/api/handwriting/scan`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to scan handwriting');
    }

    return await response.json();
  } catch (error) {
    console.error('Scan handwriting error:', error);
    throw error;
  }
}

export async function automateLayout(projectId: string, panels: any[], documents: any[]): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/ai/automate-layout`, {
      method: 'POST',
      body: JSON.stringify({ projectId, panels, documents }),
    });

    if (!response.ok) {
      throw new Error('Failed to automate layout');
    }

    const result = await response.json();
    
    // If layout generation was successful and returned actions, execute them
    if (result.success && result.actions && result.actions.length > 0) {
      console.log('🎯 Executing AI layout actions:', result.actions.length, 'actions');
      
      const executeResponse = await makeAuthenticatedRequest(`${BACKEND_URL}/api/ai/execute-ai-layout`, {
        method: 'POST',
        body: JSON.stringify({ projectId, actions: result.actions }),
      });

      if (executeResponse.ok) {
        const executeResult = await executeResponse.json();
        console.log('✅ AI actions executed successfully:', executeResult);
        
        // Return the combined result
        return {
          ...result,
          executedActions: executeResult
        };
      } else {
        console.error('❌ Failed to execute AI actions');
        throw new Error('Failed to execute AI layout actions');
      }
    }

    return result;
  } catch (error) {
    console.error('Automate layout error:', error);
    throw error;
  }
}

export async function downloadDocument(documentId: string): Promise<Blob> {
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${BACKEND_URL}/api/documents/download/${documentId}`, {
      method: 'GET',
      headers: authHeaders,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to download document');
    }

    return await response.blob();
  } catch (error) {
    console.error('Download document error:', error);
    throw error;
  }
}

// Panel Requirements API functions
export async function getPanelRequirements(projectId: string): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panel-requirements/${projectId}`, {
      method: 'GET',
    });
    return response.json();
  } catch (error) {
    console.error('Get panel requirements error:', error);
    throw error;
  }
}

export async function savePanelRequirements(projectId: string, requirements: any): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panel-requirements/${projectId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requirements),
    });
    return response.json();
  } catch (error) {
    console.error('Save panel requirements error:', error);
    throw error;
  }
}

export async function updatePanelRequirements(projectId: string, requirements: any): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panel-requirements/${projectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requirements),
    });
    return response.json();
  } catch (error) {
    console.error('Update panel requirements error:', error);
    throw error;
  }
}

export async function getPanelRequirementsAnalysis(projectId: string): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panel-requirements/${projectId}/analysis`, {
      method: 'GET',
    });
    return response.json();
  } catch (error) {
    console.error('Get panel requirements analysis error:', error);
    throw error;
  }
}

// AI-powered document analysis for panel requirements
export async function analyzeDocumentsForPanelRequirements(projectId: string, documents: any[]): Promise<any> {
  try {
    console.log('🔍 Phase 2: Analyzing documents for panel requirements:', documents.length, 'documents');
    
    // Extract only document IDs to reduce payload size
    const documentIds = documents.map(doc => doc.id);
    
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/ai/analyze-panel-requirements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        documentIds
      }),
    });
    
    const result = await response.json();
    console.log('✅ Phase 2: Document analysis result:', result);
    
    // Phase 2: Enhanced response handling with detailed breakdown
    if (result.success) {
      // Enhanced response includes detailed validation and confidence breakdown
      const enhancedResult = {
        ...result,
        phase: '2',
        enhancedFeatures: {
          validation: result.validationResults || {},
          confidence: result.confidenceResults || {},
          suggestions: result.suggestions || [],
          riskAssessment: result.riskAssessment || {}
        }
      };
      
      console.log('🎯 Phase 2: Enhanced analysis features:', {
        validationIssues: enhancedResult.enhancedFeatures.validation.issues?.length || 0,
        confidenceScore: enhancedResult.enhancedFeatures.confidence.overall || 0,
        suggestions: enhancedResult.enhancedFeatures.suggestions.length,
        riskLevel: enhancedResult.enhancedFeatures.riskAssessment.level || 'unknown'
      });
      
      return enhancedResult;
    } else {
      console.error('❌ Phase 2: Document analysis failed:', result.error);
      throw new Error(result.error || 'Document analysis failed');
    }
  } catch (error) {
    console.error('❌ Phase 2: Document analysis error:', error);
    throw error;
  }
}

export async function generateAdvancedLayout(projectId: string, options: any = {}): Promise<any> {
  try {
    console.log('🚀 Phase 3: Generating advanced layout for project:', projectId, 'with options:', options);
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/ai/generate-advanced-layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, options }),
    });
    const result = await response.json();
    console.log('✅ Phase 3: Advanced layout generation result:', result);
    if (result.success) {
      console.log('🎯 Phase 3: Advanced layout features:', {
        panelCount: result.layout?.length || 0,
        optimizationStrategy: result.optimization?.strategy || 'unknown',
        algorithm: result.optimization?.algorithm || 'unknown',
        confidence: result.confidence || 0
      });
      return result;
    } else {
      console.error('❌ Phase 3: Advanced layout generation failed:', result.error);
      throw new Error(result.error || 'Advanced layout generation failed');
    }
  } catch (error) {
    console.error('❌ Phase 3: Advanced layout generation error:', error);
    throw error;
  }
}