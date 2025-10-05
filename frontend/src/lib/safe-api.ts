import { AsbuiltRecord, AsbuiltSummary, AsbuiltImportResult } from '@/types/asbuilt';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';

class SafeAPI {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
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

  async deleteRecord(recordId: string): Promise<void> {
    await this.makeRequest<{ success: boolean }>(
      `/api/asbuilt/${recordId}`,
      {
        method: 'DELETE',
      }
    );
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

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequest<{ status: string; timestamp: string }>('/api/health');
  }
}

export const safeAPI = new SafeAPI();
export default safeAPI;
