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

      // CRITICAL: Handle error responses BEFORE trying to parse success responses
      if (!response.ok) {
        await this.handleErrorResponse(response, endpoint, options, retryCount);
        // This line never executes because handleErrorResponse always throws
        throw new Error('Unexpected: handleErrorResponse should have thrown');
      }

      // Parse successful response
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const jsonData = await response.json();
          return jsonData;
        } else {
          const textData = await response.text();
          return (textData || 'Success') as T;
        }
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error('Invalid response format from server');
      }

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle fetch errors (network issues, timeouts)
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout') as ApiError;
        timeoutError.isRetryable = true;
        throw timeoutError;
      }

      // Re-throw ApiError instances (from handleErrorResponse or auth)
      if ((error as ApiError).isAuthError || (error as ApiError).status) {
        throw error;
      }

      // Handle network errors
      const networkError = new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`) as ApiError;
      networkError.isRetryable = true;
      
      // Retry network errors
      if (retryCount < this.maxRetries) {
        console.log(`Retrying request ${retryCount + 1}/${this.maxRetries} after network error`);
        await this.delay(Math.pow(2, retryCount) * 1000);
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
    
    // CRITICAL FIX: Clone the response before reading the body
    // This prevents "body already read" errors
    const responseClone = response.clone();
    
    try {
      const errorText = await responseClone.text();
      if (errorText) {
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
          errorCode = errorJson.code || errorCode;
        } catch (parseError) {
          // JSON parsing failed, use the text as-is
          errorMessage = errorText.substring(0, 200); // Limit length
        }
      }
    } catch (readError) {
      console.warn('Could not read error response body:', readError);
      // Continue with default error message
    }

    const error = new Error(errorMessage) as ApiError;
    error.status = response.status;
    error.code = errorCode;

    // Log the full error details for debugging
    console.error(`API Error ${response.status} for ${endpoint}:`, {
      status: response.status,
      statusText: response.statusText,
      message: errorMessage,
      code: errorCode,
      url: response.url
    });

    switch (response.status) {
      case 401:
        error.isAuthError = true;
        console.error('Authentication failed:', errorMessage);
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

  // DEBUGGING HELPER: Add this method to help diagnose backend issues
  async debugRequest(endpoint: string, options: ApiRequestOptions = {}): Promise<void> {
    try {
      console.group(`🔍 Debug API Request: ${options.method || 'GET'} ${endpoint}`);
      
      // Test without auth first
      console.log('Testing without auth...');
      try {
        await this.request(endpoint, { ...options, requireAuth: false });
        console.log('✅ Request works without auth');
      } catch (error) {
        console.log('❌ Request fails without auth:', error);
      }
      
      // Test with auth
      console.log('Testing with auth...');
      try {
        const result = await this.request(endpoint, options);
        console.log('✅ Request works with auth:', result);
      } catch (error) {
        console.log('❌ Request fails with auth:', error);
      }
      
    } finally {
      console.groupEnd();
    }
  }
}

// Export configured instance
export const apiClient = new ApiClient(
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003'
);
