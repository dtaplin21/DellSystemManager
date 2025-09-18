import { authManager } from './authManager';

interface ApiError extends Error {
  status?: number;
  code?: string;
  isAuthError?: boolean;
  isRetryable?: boolean;
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: any;
  requireAuth?: boolean;
  retryCount?: number;
  timeout?: number;
}

class ApiClient {
  private baseUrl: string;
  private maxRetries = 2;
  private defaultTimeout = 10000; // 10 seconds

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      requireAuth = true,
      retryCount = 0,
      timeout = this.defaultTimeout
    } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add authentication if required
      if (requireAuth) {
        try {
          const token = await authManager.getValidToken();
          headers['Authorization'] = `Bearer ${token}`;
        } catch (authError) {
          const error = new Error('Authentication required. Please log in.') as ApiError;
          error.isAuthError = true;
          error.status = 401;
          throw error;
        }
      }

      console.log(`API Request: ${method} ${this.baseUrl}${endpoint}`);
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle response
      if (!response.ok) {
        await this.handleErrorResponse(response, endpoint, options, retryCount);
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        const text = await response.text();
        return (text || 'Success') as T;
      }

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle fetch errors (network issues, timeouts)
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout') as ApiError;
        timeoutError.isRetryable = true;
        throw timeoutError;
      }

      // Re-throw ApiError instances
      if ((error as ApiError).isAuthError || (error as ApiError).status) {
        throw error;
      }

      // Handle network errors
      const networkError = new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`) as ApiError;
      networkError.isRetryable = true;
      
      // Retry network errors
      if (retryCount < this.maxRetries) {
        console.log(`Retrying request ${retryCount + 1}/${this.maxRetries} after network error`);
        await this.delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
        return this.request(endpoint, { ...options, retryCount: retryCount + 1 });
      }

      throw networkError;
    }
  }

  private async handleErrorResponse(
    response: Response,
    endpoint: string,
    options: ApiRequestOptions,
    retryCount: number
  ): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode = 'HTTP_ERROR';
    
    try {
      const errorText = await response.text();
      if (errorText) {
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
          errorCode = errorJson.code || errorCode;
        } catch {
          errorMessage = errorText;
        }
      }
    } catch {
      // Ignore parsing errors
    }

    const error = new Error(errorMessage) as ApiError;
    error.status = response.status;
    error.code = errorCode;

    switch (response.status) {
      case 401:
        error.isAuthError = true;
        console.error('Authentication failed:', errorMessage);
        // Don't retry auth errors immediately
        throw error;
      
      case 403:
        error.isAuthError = true;
        throw error;
      
      case 429:
        // Rate limited - retry with exponential backoff
        if (retryCount < this.maxRetries) {
          const delay = Math.pow(2, retryCount + 1) * 1000;
          console.log(`Rate limited, retrying in ${delay}ms...`);
          await this.delay(delay);
          return this.request(endpoint, { ...options, retryCount: retryCount + 1 });
        }
        throw error;
      
      case 500:
      case 502:
      case 503:
        // Server errors - retry with backoff
        if (retryCount < this.maxRetries) {
          const delay = Math.pow(2, retryCount + 1) * 1000;
          console.log(`Server error, retrying in ${delay}ms...`);
          await this.delay(delay);
          return this.request(endpoint, { ...options, retryCount: retryCount + 1 });
        }
        error.isRetryable = true;
        throw error;
      
      default:
        throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/api/health', { requireAuth: false, timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// Export configured instance
export const apiClient = new ApiClient(
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003'
);
