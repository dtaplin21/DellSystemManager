import { getSupabaseClient, getCurrentSession } from './supabase';

const BACKEND_URL = 'http://localhost:8003';


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

export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    console.log('🔍 [AUTH] === makeAuthenticatedRequest START ===');
    console.log('🔍 [AUTH] Request URL:', url);
    console.log('🔍 [AUTH] Request method:', options.method || 'GET');
    console.log('🔍 [AUTH] Request options:', {
      headers: options.headers,
      body: options.body ? 'Present' : 'None',
      cache: options.cache
    });
    
    // Get the current session
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    console.log('🔍 [AUTH] Session status:', {
      hasSession: !!session,
      userId: session?.user?.id,
      accessToken: session?.access_token ? 'Present' : 'Missing'
    });
    
    if (!session?.access_token) {
      console.error('❌ [AUTH] No access token found in session');
      throw new Error('No authentication token found. Please log in.');
    }
    
    // Prepare headers
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${session.access_token}`);
    headers.set('Content-Type', 'application/json');
    
    console.log('🔍 [AUTH] Request headers prepared:', {
      authorization: 'Bearer [HIDDEN]',
      contentType: headers.get('content-type'),
      userAgent: headers.get('user-agent')
    });
    
    // Make the request
    console.log('🔍 [AUTH] Sending authenticated request...');
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    console.log('🔍 [AUTH] Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    console.log('🔍 [AUTH] === makeAuthenticatedRequest END ===');
    return response;
    
  } catch (error) {
    console.error('❌ [AUTH] makeAuthenticatedRequest error:', error);
    throw error;
  }
}

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
          console.warn('⚠️ [API] Authentication failed, returning fallback data');
          // Return fallback data instead of throwing
          return {
            id,
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        if (response.status === 404) {
          console.warn('⚠️ [API] Project not found, returning fallback data');
          return {
            id,
            name: 'Project Not Found',
            description: 'The requested project could not be found',
            status: 'not_found',
            client: 'Unknown',
            location: 'Unknown',
            startDate: null,
            endDate: null,
            area: null,
            progress: 0,
            scale: 1.0,
            layoutWidth: 15000,
            layoutHeight: 15000,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        console.warn('⚠️ [API] Backend error, returning fallback data:', response.status, response.statusText);
        return {
          id,
          name: 'Project Loading...',
          description: 'Unable to load project details due to backend error',
          status: 'error',
          client: 'Unknown',
          location: 'Unknown',
          startDate: null,
          endDate: null,
          area: null,
          progress: 0,
          scale: 1.0,
          layoutWidth: 15000,
          layoutHeight: 15000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      const projectData = await response.json();
      console.log('🔍 [DEBUG] fetchProjectById raw response data:', projectData);
      console.log('🔍 [DEBUG] fetchProjectById project name:', projectData?.name);
      console.log('🔍 [DEBUG] fetchProjectById project keys:', projectData ? Object.keys(projectData) : 'No data');
      
      return projectData;
    } catch (authError) {
      console.warn('⚠️ [API] Authenticated request failed, returning fallback data:', authError);
      return {
        id,
        name: 'Project Loading...',
        description: 'Unable to load project details due to authentication error',
        status: 'auth_error',
        client: 'Unknown',
        location: 'Unknown',
        startDate: null,
        endDate: null,
        area: null,
        progress: 0,
        scale: 1.0,
        layoutWidth: 15000,
        layoutHeight: 15000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('🔍 [DEBUG] fetchProjectById unexpected error:', error);
    // Return fallback data instead of throwing to prevent SSR crashes
    return {
      id,
      name: 'Project Loading...',
      description: 'Unable to load project details due to unexpected error',
      status: 'error',
      client: 'Unknown',
      location: 'Unknown',
      startDate: null,
      endDate: null,
      area: null,
      progress: 0,
      scale: 1.0,
      layoutWidth: 15000,
      layoutHeight: 15000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
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
    console.log('🔍 [API] === fetchPanelLayout START ===');
    console.log('🔍 [API] Input projectId:', projectId);
    
    // First attempt: with authentication
    try {
      console.log('🔍 [API] Making authenticated request to backend...');
      const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panels/layout/${projectId}`, {
        cache: 'no-store'
      });
      
      console.log('🔍 [API] Backend response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('⚠️ [API] Authentication failed, returning fallback layout');
          return {
            id: 'fallback-layout',
            projectId,
            panels: [],
            width: 15000,
            height: 15000,
            scale: 1.0,
            lastUpdated: new Date().toISOString()
          };
        }
        if (response.status === 404) {
          console.warn('⚠️ [API] Panel layout not found, returning fallback layout');
          return {
            id: 'fallback-layout',
            projectId,
            panels: [],
            width: 15000,
            height: 15000,
            scale: 1.0,
            lastUpdated: new Date().toISOString()
          };
        }
        console.warn('⚠️ [API] Backend error, returning fallback layout:', response.status, response.statusText);
        return {
          id: 'fallback-layout',
          projectId,
          panels: [],
          width: 15000,
          height: 15000,
          scale: 1.0,
          lastUpdated: new Date().toISOString()
        };
      }
      
      const layoutData = await response.json();
      console.log('✅ [API] Panel layout data parsed successfully:', {
        hasData: !!layoutData,
        dataType: typeof layoutData,
        hasPanels: !!layoutData?.panels,
        panelCount: layoutData?.panels?.length || 0,
        width: layoutData?.width,
        height: layoutData?.height,
        scale: layoutData?.scale
      });
      
      if (layoutData?.panels) {
        console.log('🔍 [API] First panel:', layoutData.panels[0]);
        console.log('🔍 [API] Last panel:', layoutData.panels[layoutData.panels.length - 1]);
      }
      
      console.log('🔍 [API] === fetchPanelLayout END ===');
      return layoutData;
    } catch (authError) {
      console.warn('⚠️ [API] Authenticated panel layout request failed, returning fallback layout:', authError);
      return {
        id: 'fallback-layout',
        projectId,
        panels: [],
        width: 15000,
        height: 15000,
        scale: 1.0,
        lastUpdated: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('❌ [API] fetchPanelLayout unexpected error:', error);
    // Return fallback data instead of throwing to prevent SSR crashes
    return {
      id: 'fallback-layout',
      projectId,
      panels: [],
      width: 15000,
      height: 15000,
      scale: 1.0,
      lastUpdated: new Date().toISOString()
    };
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
  panels: any[];
  width: number;
  height: number;
  scale: number;
}): Promise<any> {
  try {
    console.log('🔍 [API] === updatePanelLayout START ===');
    console.log('🔍 [API] Input parameters:', { projectId, data });
    console.log('🔍 [API] Panel count:', data.panels?.length || 0);
    console.log('🔍 [API] First panel:', data.panels?.[0]);
    console.log('🔍 [API] Last panel:', data.panels?.[data.panels?.length - 1]);
    console.log('🔍 [API] Full data object:', JSON.stringify(data, null, 2));
    
    // Safety check: ensure panels array exists and is not empty
    if (!data.panels || !Array.isArray(data.panels)) {
      console.error('❌ [API] Invalid panels data:', data.panels);
      throw new Error('Invalid panels data: panels must be an array');
    }
    
    if (data.panels.length === 0) {
      console.warn('⚠️ [API] Empty panels array being sent to backend');
    }
    
    const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panels/layout/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    
    console.log('🔍 [API] Backend response status:', response.status);
    console.log('🔍 [API] Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      let errorMessage = 'Failed to update panel layout';
      
      if (response.status === 401) {
        errorMessage = 'Authentication required. Please log in.';
        console.error('❌ [API] Authentication failed for panel update');
      } else if (response.status === 404) {
        errorMessage = 'Panel layout not found.';
        console.error('❌ [API] Panel layout not found for project:', projectId);
      } else if (response.status === 500) {
        errorMessage = 'Server error occurred while updating panel layout.';
        console.error('❌ [API] Server error for panel update:', response.statusText);
      }
      
      // Try to get error details from response
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        if (errorData.error) {
          console.error('❌ [API] Backend error code:', errorData.error);
        }
      } catch (parseError) {
        console.warn('⚠️ [API] Could not parse error response');
      }
      
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('✅ [API] Panel layout update successful:', {
      projectId,
      panelsCount: result.panels?.length || 0,
      width: result.width,
      height: result.height,
      scale: result.scale
    });
    console.log('🔍 [API] === updatePanelLayout END ===');
    
    return result;
  } catch (error) {
    console.error('❌ [API] Update panel layout error:', error);
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