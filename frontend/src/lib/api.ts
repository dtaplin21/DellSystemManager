import { supabase, getCurrentSession } from './supabase';

// Helper function to get auth headers using Supabase's native token management
const getAuthHeaders = async () => {
  try {
    console.log('🔍 getAuthHeaders: Getting auth headers...');
    
    // Get current session (Supabase handles refresh automatically)
    const session = await getCurrentSession();
    
    console.log('🔍 getAuthHeaders: Session data:', session ? { 
      hasAccessToken: !!session.access_token,
      expiresAt: session.expires_at,
      userId: session.user?.id,
      tokenPreview: session.access_token ? session.access_token.substring(0, 20) + '...' : 'none'
    } : 'No session');
    
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
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
      credentials: 'include',
    });

    if (response.status === 401 && retryCount < 1) {
      console.log('🔄 Received 401, attempting token refresh...');
      
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
    }

    return response;
  } catch (error) {
    console.error('❌ makeAuthenticatedRequest error:', error);
    throw error;
  }
};

export async function fetchProjectById(id: string): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`http://localhost:8003/api/projects/${id}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in.');
      }
      if (response.status === 404) {
        throw new Error('Project not found.');
      }
      throw new Error(`Failed to fetch project: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Fetch project error:', error);
    throw error;
  }
}

export async function fetchProjects(): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest('http://localhost:8003/api/projects');
    
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
    const response = await makeAuthenticatedRequest(`http://localhost:8003/api/panels/layout/${projectId}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in.');
      }
      if (response.status === 404) {
        throw new Error('Panel layout not found.');
      }
      throw new Error(`Failed to fetch panel layout: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Fetch panel layout error:', error);
    throw error;
  }
}

export async function exportPanelLayoutToCAD(projectId: string, format: string): Promise<Blob | null> {
  try {
    const response = await makeAuthenticatedRequest(`http://localhost:8003/api/panel-layout/export`, {
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
    const response = await makeAuthenticatedRequest('http://localhost:8003/api/notifications');
    
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
    const response = await makeAuthenticatedRequest('http://localhost:8003/api/projects/stats');
    
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
    const response = await makeAuthenticatedRequest('http://localhost:8003/api/documents/analyze', {
      method: 'POST',
      body: JSON.stringify({ projectId, documentIds, question }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to analyze documents');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error analyzing documents:', error);
    throw error;
  }
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await makeAuthenticatedRequest(`http://localhost:8003/api/documents/${documentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
}

export async function uploadDocument(projectId: string, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('document', file);

  const headers = await getAuthHeaders();
  // Remove Content-Type for FormData
  const { 'Content-Type': _, ...formHeaders } = headers;

  const response = await fetch(`http://localhost:8003/api/documents/${projectId}/upload`, {
    method: 'POST',
    headers: formHeaders,
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload document');
  }

  return response.json();
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
  const response = await makeAuthenticatedRequest('http://localhost:8003/api/projects', {
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
  const response = await makeAuthenticatedRequest(`http://localhost:8003/api/projects/${projectId}`, {
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
    console.log('updateProject called with:', { projectId, data });
    
    const response = await makeAuthenticatedRequest(`http://localhost:8003/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      const error = JSON.parse(errorText).catch(() => ({ message: 'Failed to update project' }));
      throw new Error(error.message || 'Failed to update project');
    }

    const result = await response.json();
    console.log('Update result:', result);
    return result;
  } catch (error) {
    console.error('updateProject error:', error);
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

  const response = await fetch(`http://localhost:8003/api/qc-data/${projectId}/import`, {
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
  const response = await makeAuthenticatedRequest(`http://localhost:8003/api/qc-data/${projectId}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to add QC data');
  }

  return response.json();
}

export async function createCheckoutSession(plan: 'basic' | 'premium'): Promise<{ sessionId: string }> {
  const response = await makeAuthenticatedRequest('http://localhost:8003/api/subscription/create-checkout-session', {
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
    const response = await makeAuthenticatedRequest(`http://localhost:8003/api/documents/${projectId}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in.');
      }
      throw new Error(`Failed to fetch documents: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Fetch documents error:', error);
    throw error;
  }
}

export async function fetchQCData(projectId: string): Promise<any> {
  try {
    const response = await makeAuthenticatedRequest(`http://localhost:8003/api/qc-data/${projectId}`);
    
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
    formData.append('file', file);
    formData.append('projectId', projectId);

    const authHeaders = await getAuthHeaders();
    const { 'Content-Type': _, ...headers } = authHeaders; // Remove Content-Type for FormData

    const response = await fetch('http://localhost:8003/api/handwriting/scan', {
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
    const response = await makeAuthenticatedRequest('http://localhost:8003/api/ai/automate-layout', {
      method: 'POST',
      body: JSON.stringify({ projectId, panels, documents }),
    });

    if (!response.ok) {
      throw new Error('Failed to automate layout');
    }

    return await response.json();
  } catch (error) {
    console.error('Automate layout error:', error);
    throw error;
  }
}