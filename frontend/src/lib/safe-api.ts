import { AsbuiltRecord, AsbuiltSummary, AsbuiltImportResult, PanelAsbuiltSummary, AsbuiltDomain } from '@/types/asbuilt';
import { makeAuthenticatedRequest } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';

class SafeAPI {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      // Check if we're in development mode (running on localhost)
      const isDevelopment = process.env.NODE_ENV === 'development' || 
                           (typeof window !== 'undefined' && window.location.hostname === 'localhost');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };
      
      // Add development bypass header if in development mode
      if (isDevelopment) {
        headers['x-dev-bypass'] = 'true';
        console.log('🔧 [SAFE-API] Development mode - using bypass header for:', endpoint);
      } else {
        console.log('🔧 [SAFE-API] Production mode - no bypass header for:', endpoint);
      }
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers,
        credentials: 'include',
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // As-built API methods
  async getPanelRecords(projectId: string, panelId: string): Promise<AsbuiltRecord[]> {
    const response = await this.makeRequest<{ success: boolean; records: AsbuiltRecord[] }>(
      `/api/asbuilt/${projectId}/${panelId}`
    );
    return response.records || [];
  }

  async getProjectRecords(projectId: string, limit = 100, offset = 0, domain?: string): Promise<AsbuiltRecord[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      ...(domain && { domain }),
    });
    
    const response = await this.makeRequest<{ success: boolean; records: AsbuiltRecord[] }>(
      `/api/asbuilt/${projectId}?${params}`
    );
    return response.records || [];
  }

  async getProjectFileMetadata(projectId: string): Promise<any[]> {
    const response = await this.makeRequest<{ success: boolean; files: any[] }>(
      `/api/asbuilt/${projectId}/files`
    );
    return response.files || [];
  }

  async createRecord(projectId: string, panelId: string, recordData: Partial<AsbuiltRecord>): Promise<AsbuiltRecord> {
    const response = await this.makeRequest<{ success: boolean; record: AsbuiltRecord }>(
      `/api/asbuilt/${projectId}/${panelId}`,
      {
        method: 'POST',
        body: JSON.stringify(recordData),
      }
    );
    return response.record;
  }

  async updateRecord(recordId: string, updateData: Partial<AsbuiltRecord>): Promise<AsbuiltRecord> {
    const response = await this.makeRequest<{ success: boolean; record: AsbuiltRecord }>(
      `/api/asbuilt/${recordId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updateData),
      }
    );
    return response.record;
  }


  async getProjectSummary(projectId: string): Promise<AsbuiltSummary> {
    const response = await this.makeRequest<{ success: boolean; summary: AsbuiltSummary }>(
      `/api/asbuilt/${projectId}/summary`
    );
    return response.summary;
  }

  async importRecords(projectId: string, panelId: string, records: Partial<AsbuiltRecord>[]): Promise<AsbuiltImportResult> {
    const response = await this.makeRequest<AsbuiltImportResult>(
      `/api/asbuilt/import`,
      {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          panelId,
          records,
        }),
      }
    );
    return response;
  }

  // Delete record
  async deleteRecord(recordId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest<{ success: boolean; message: string }>(
      `/api/asbuilt/${recordId}`,
      {
        method: 'DELETE',
      }
    );
    return response;
  }

  // Delete file
  async deleteFile(fileId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest<{ success: boolean; message: string }>(
      `/api/asbuilt/files/${fileId}`,
      {
        method: 'DELETE',
      }
    );
    return response;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequest<{ status: string; timestamp: string }>('/api/health');
  }

  // Panel-specific as-built summary (combines panel records with project summary)
  async getAsbuiltSafe(projectId: string, panelId: string): Promise<PanelAsbuiltSummary> {
    try {
      // Get panel-specific records
      const panelRecords = await this.getPanelRecords(projectId, panelId);
      
      // Get project summary for additional context
      const projectSummary = await this.getProjectSummary(projectId);
      
      // Extract unique domains from panel records
      const uniqueDomains = new Set(panelRecords.map(record => record.domain));
      const domains = Array.from(uniqueDomains) as AsbuiltDomain[];
      
      // Calculate panel-specific metrics
      const totalRecords = panelRecords.length;
      const confidence = totalRecords > 0 
        ? panelRecords.reduce((sum, record) => sum + record.aiConfidence, 0) / totalRecords 
        : 0;
      
      return {
        panelId,
        panelNumber: panelId, // This could be enhanced to get actual panel number
        totalRecords,
        domains,
        lastUpdated: new Date().toISOString(),
        confidence
      };
    } catch (error) {
      console.error('Error in getAsbuiltSafe:', error);
      // Return empty summary on error
      return {
        panelId,
        panelNumber: panelId,
        totalRecords: 0,
        domains: [],
        lastUpdated: new Date().toISOString(),
        confidence: 0
      };
    }
  }
}

export const safeAPI = new SafeAPI();

// Export the getAsbuiltSafe function for direct import
export const getAsbuiltSafe = (projectId: string, panelId: string) => 
  safeAPI.getAsbuiltSafe(projectId, panelId);

/**
 * Get a single as-built record by ID
 */
export async function getAsbuiltRecordDetails(recordId: string): Promise<AsbuiltRecord> {
  try {
    console.log('🔍 [API] Fetching record details for:', recordId);
    
    const response = await makeAuthenticatedRequest(`/api/asbuilt/records/${recordId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch record: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch record');
    }
    
    // Transform snake_case to camelCase to match frontend types
    const record = data.record;
    return {
      id: record.id,
      projectId: record.project_id,
      panelId: record.panel_id,
      domain: record.domain,
      sourceDocId: record.source_doc_id,
      rawData: record.raw_data,
      mappedData: record.mapped_data,
      aiConfidence: parseFloat(record.ai_confidence),
      requiresReview: record.requires_review,
      createdBy: record.created_by,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  } catch (error) {
    console.error('❌ [API] Error fetching record details:', error);
    throw error;
  }
}

export default safeAPI;
