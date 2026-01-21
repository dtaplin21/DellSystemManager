import { Page } from '@playwright/test';
import { BACKEND_BASE_URL } from './service-urls';
import { getAuthToken } from './project-helpers';

export interface HealthCheckResult {
  endpoint: string;
  status: 'healthy' | 'unhealthy' | 'timeout' | 'error';
  statusCode?: number;
  responseTime?: number;
  message?: string;
  details?: any;
}

/**
 * Backend health check helper functions
 */
export class BackendHealth {
  /**
   * Check backend health endpoint
   */
  static async checkHealth(page: Page): Promise<HealthCheckResult> {
    const endpoint = `${BACKEND_BASE_URL}/health`;
    const startTime = Date.now();
    
    try {
      const response = await page.request.get(endpoint, {
        timeout: 90000 // Increased from 10000 to 90000 for cold starts (60s cold start + 30s buffer)
      });
      
      const responseTime = Date.now() - startTime;
      const statusCode = response.status();
      const body = await response.json().catch(() => ({}));
      
      return {
        endpoint,
        status: statusCode === 200 ? 'healthy' : 'unhealthy',
        statusCode,
        responseTime,
        message: body.status || `HTTP ${statusCode}`,
        details: body
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error.message?.includes('timeout')) {
        return {
          endpoint,
          status: 'timeout',
          responseTime,
          message: 'Request timed out'
        };
      }
      
      return {
        endpoint,
        status: 'error',
        responseTime,
        message: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Check API health endpoint
   */
  static async checkApiHealth(page: Page): Promise<HealthCheckResult> {
    const endpoint = `${BACKEND_BASE_URL}/api/health`;
    const startTime = Date.now();
    
    try {
      const response = await page.request.get(endpoint, {
        timeout: 90000 // Increased from 10000 to 90000 for cold starts (60s cold start + 30s buffer)
      });
      
      const responseTime = Date.now() - startTime;
      const statusCode = response.status();
      const body = await response.json().catch(() => ({}));
      
      return {
        endpoint,
        status: statusCode === 200 ? 'healthy' : 'unhealthy',
        statusCode,
        responseTime,
        message: body.status || `HTTP ${statusCode}`,
        details: body
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error.message?.includes('timeout')) {
        return {
          endpoint,
          status: 'timeout',
          responseTime,
          message: 'Request timed out'
        };
      }
      
      return {
        endpoint,
        status: 'error',
        responseTime,
        message: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Check projects API endpoint (requires auth)
   */
  static async checkProjectsApi(page: Page): Promise<HealthCheckResult> {
    const endpoint = `${BACKEND_BASE_URL}/api/projects`;
    const startTime = Date.now();
    
    try {
      const authToken = await getAuthToken(page);
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await page.request.get(endpoint, {
        timeout: 90000, // Increased from 30000 to 90000 for cold starts (60s cold start + 30s buffer)
        headers
      });
      
      const responseTime = Date.now() - startTime;
      const statusCode = response.status();
      const body = await response.json().catch(() => ({}));
      
      return {
        endpoint,
        status: statusCode === 200 ? 'healthy' : 'unhealthy',
        statusCode,
        responseTime,
        message: statusCode === 200 
          ? `Successfully fetched ${Array.isArray(body) ? body.length : 0} projects`
          : `HTTP ${statusCode}: ${(body as any)?.message || 'Unknown error'}`,
        details: {
          hasAuth: !!authToken,
          projectCount: Array.isArray(body) ? body.length : undefined,
          error: statusCode !== 200 ? body : undefined
        }
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error.message?.includes('timeout')) {
        return {
          endpoint,
          status: 'timeout',
          responseTime,
          message: 'Request timed out (backend may be slow or unreachable)',
          details: {
            hasAuth: false
          }
        };
      }
      
      return {
        endpoint,
        status: 'error',
        responseTime,
        message: error.message || 'Unknown error',
        details: {
          hasAuth: false
        }
      };
    }
  }

  /**
   * Run all health checks
   */
  static async runAllHealthChecks(page: Page): Promise<{
    health: HealthCheckResult;
    apiHealth: HealthCheckResult;
    projectsApi: HealthCheckResult;
  }> {
    console.log('🏥 [BackendHealth] Running health checks...');
    
    const [health, apiHealth, projectsApi] = await Promise.all([
      this.checkHealth(page),
      this.checkApiHealth(page),
      this.checkProjectsApi(page)
    ]);
    
    console.log('🏥 [BackendHealth] Health check results:');
    console.log(`  - /health: ${health.status} (${health.responseTime}ms)`);
    console.log(`  - /api/health: ${apiHealth.status} (${apiHealth.responseTime}ms)`);
    console.log(`  - /api/projects: ${projectsApi.status} (${projectsApi.responseTime}ms)`);
    
    return { health, apiHealth, projectsApi };
  }
}

