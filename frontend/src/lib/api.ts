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