export async function fetchProjectById(id: string): Promise<any> {
  try {
    const response = await fetch(`/api/projects/${id}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
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

export async function fetchPanelLayout(projectId: string): Promise<any> {
  try {
    const response = await fetch(`/api/panels/layout/${projectId}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`/panel-api/api/panel-layout/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch('/api/notifications', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch('/api/projects/stats', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch('/api/documents/analyze', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
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
  const response = await fetch(`/api/documents/${documentId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
}

export async function uploadDocument(projectId: string, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('document', file);

  const response = await fetch(`/api/documents/${projectId}/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload document');
  }

  return response.json();
}

export async function createProject(data: {
  name: string;
  description: string;
  client: string;
  location: string;
  startDate: string;
  endDate: string;
  area: string;
}): Promise<any> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to create project');
  }

  return response.json();
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
  formData.append('hasHeaderRow', String(options.hasHeaderRow));
  Object.entries(options).forEach(([key, value]) => {
    formData.append(key, String(value));
  });

  const response = await fetch(`/api/qc-data/${projectId}/import`, {
    method: 'POST',
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
  const response = await fetch(`/api/qc-data/${projectId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to add QC data');
  }

  return response.json();
}

export async function createCheckoutSession(plan: 'basic' | 'premium'): Promise<{ sessionId: string }> {
  const response = await fetch('/api/checkout/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ plan })
  });

  if (!response.ok) {
    throw new Error('Failed to create checkout session');
  }

  return response.json();
}