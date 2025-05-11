import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = '/api';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

// Generic fetch function
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for auth
    });

    const status = response.status;
    
    // Handle non-JSON responses (like file downloads)
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      if (!response.ok) {
        return {
          error: data.message || 'An error occurred',
          status,
        };
      }
      
      return {
        data: data as T,
        status,
      };
    }
    
    // For non-JSON responses (like file downloads)
    if (!response.ok) {
      return {
        error: 'Failed to fetch',
        status,
      };
    }
    
    return {
      data: await response.blob() as unknown as T,
      status,
    };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      error: 'Network error. Please check your connection.',
      status: 0,
    };
  }
}

// Authentication
export async function loginUser(email: string, password: string) {
  const response = await apiFetch<{ user: any; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function signupUser(name: string, email: string, password: string, company?: string) {
  const response = await apiFetch<{ user: any; token: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, company }),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function loginWithGoogle(idToken: string) {
  const response = await apiFetch<{ user: any; token: string }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function logout() {
  const response = await apiFetch('/auth/logout', {
    method: 'POST',
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return true;
}

export async function getCurrentUser() {
  const response = await apiFetch<{ user: any }>('/auth/me');
  
  if (response.error) {
    // Don't throw here, as this might be called on initial app load
    return null;
  }
  
  return response.data?.user;
}

export async function updateUserProfile(profileData: any) {
  const response = await apiFetch<{ user: any }>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data?.user;
}

// Projects
export async function fetchProjects() {
  const response = await apiFetch<any[]>('/projects');
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data || [];
}

export async function fetchProjectById(id: string) {
  const response = await apiFetch<any>(`/projects/${id}`);
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function createProject(projectData: any) {
  const response = await apiFetch<any>('/projects', {
    method: 'POST',
    body: JSON.stringify(projectData),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function updateProject(id: string, projectData: any) {
  const response = await apiFetch<any>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(projectData),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function deleteProject(id: string) {
  const response = await apiFetch(`/projects/${id}`, {
    method: 'DELETE',
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return true;
}

export async function fetchProjectStats() {
  const response = await apiFetch<any>('/projects/stats');
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

// Panel Layout
export async function fetchPanelLayout(projectId: string) {
  const response = await apiFetch<any>(`/panels/layout/${projectId}`);
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function updatePanelLayout(projectId: string, layoutData: any) {
  const response = await apiFetch<any>(`/panels/layout/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(layoutData),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function exportPanelLayoutToCAD(projectId: string, format: string) {
  const response = await apiFetch<Blob>(`/panels/export/${projectId}?format=${format}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/octet-stream',
    },
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

// Documents
export async function fetchDocuments(projectId: string) {
  const response = await apiFetch<any[]>(`/documents/${projectId}`);
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data || [];
}

export async function uploadDocument(projectId: string, formData: FormData) {
  // Use native fetch for file upload
  try {
    const response = await fetch(`${API_BASE_URL}/documents/${projectId}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to upload document');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Document upload failed:', error);
    throw error;
  }
}

export async function deleteDocument(documentId: string) {
  const response = await apiFetch(`/documents/${documentId}`, {
    method: 'DELETE',
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return true;
}

export async function analyzeDocuments(projectId: string, documentIds: string[], question?: string) {
  const response = await apiFetch<any>(`/documents/${projectId}/analyze`, {
    method: 'POST',
    body: JSON.stringify({
      documentIds,
      question,
    }),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

// QC Data
export async function fetchQCData(projectId: string) {
  const response = await apiFetch<any[]>(`/qc-data/${projectId}`);
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data || [];
}

export async function addQCData(projectId: string, qcData: any) {
  const response = await apiFetch<any>(`/qc-data/${projectId}`, {
    method: 'POST',
    body: JSON.stringify(qcData),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function importQCDataFromExcel(projectId: string, formData: FormData) {
  try {
    const response = await fetch(`${API_BASE_URL}/qc-data/${projectId}/import`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to import QC data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('QC data import failed:', error);
    throw error;
  }
}

// Notifications
export async function fetchNotifications() {
  const response = await apiFetch<any[]>('/notifications');
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data || [];
}

// Subscriptions
export async function createCheckoutSession(planId: string) {
  const response = await apiFetch<{ sessionId: string }>('/payments/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function getSubscription() {
  const response = await apiFetch<any>('/payments/subscription');
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function updateSubscription(subscriptionId: string, planId: string) {
  const response = await apiFetch<any>('/payments/subscription', {
    method: 'PATCH',
    body: JSON.stringify({ subscriptionId, planId }),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}

export async function cancelSubscription(subscriptionId: string) {
  const response = await apiFetch<any>('/payments/subscription', {
    method: 'DELETE',
    body: JSON.stringify({ subscriptionId }),
  });
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  return response.data;
}
