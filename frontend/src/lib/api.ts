import { supabase } from './supabase';

// Helper function to get auth headers
const getAuthHeaders = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Session data:', session ? { 
      hasAccessToken: !!session.access_token,
      expiresAt: session.expires_at,
      userId: session.user?.id 
    } : 'No session');
    
    const headers = {
      'Content-Type': 'application/json',
      ...(session?.access_token && {
        'Authorization': `Bearer ${session.access_token}`
      })
    };
    
    console.log('Generated headers:', headers);
    return headers;
  } catch (error) {
    console.error('Error getting auth headers:', error);
    return {
      'Content-Type': 'application/json'
    };
  }
};

export async function fetchProjectById(id: string): Promise<any> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/projects/${id}`, {
      credentials: 'include',
      headers,
    });
    
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
    const headers = await getAuthHeaders();
    const response = await fetch('/api/projects', {
      credentials: 'include',
      headers,
    });
    
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
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/panels/layout/${projectId}`, {
      credentials: 'include',
      headers,
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
    
    return await response.json();
  } catch (error) {
    console.error('Fetch panel layout error:', error);
    throw error;
  }
}

export async function exportPanelLayoutToCAD(projectId: string, format: string): Promise<Blob | null> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/panel-api/api/panel-layout/export`, {
      method: 'POST',
      headers,
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
    const headers = await getAuthHeaders();
    const response = await fetch('/api/notifications', {
      credentials: 'include',
      headers,
    });
    
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
    const headers = await getAuthHeaders();
    const response = await fetch('/api/projects/stats', {
      credentials: 'include',
      headers,
    });
    
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
    const headers = await getAuthHeaders();
    const response = await fetch('/api/documents/analyze', {
      method: 'POST',
      credentials: 'include',
      headers,
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
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/documents/${documentId}`, {
    method: 'DELETE',
    headers,
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

  const response = await fetch(`/api/documents/${projectId}/upload`, {
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
  const headers = await getAuthHeaders();
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create project' }));
    throw new Error(error.message || 'Failed to create project');
  }

  return response.json();
}

export async function deleteProject(projectId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/projects/${projectId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
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
    
    const headers = await getAuthHeaders();
    console.log('Auth headers:', headers);
    
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(data)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

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

  const response = await fetch(`/api/qc-data/${projectId}/import`, {
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
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/qc-data/${projectId}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to add QC data');
  }

  return response.json();
}

export async function createCheckoutSession(plan: 'basic' | 'premium'): Promise<{ sessionId: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/subscription/create-checkout-session', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ plan })
  });

  if (!response.ok) {
    throw new Error('Failed to create checkout session');
  }

  return response.json();
}

export async function fetchDocuments(projectId: string): Promise<any> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/documents/${projectId}`, {
      credentials: 'include',
      headers,
    });
    
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
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/qc-data/${projectId}`, {
      credentials: 'include',
      headers,
    });
    
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