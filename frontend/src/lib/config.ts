// Centralized configuration for the application
export const config = {
  // Backend configuration
  backend: {
    baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003',
    apiVersion: 'v1',
    timeout: 10000, // 10 seconds
  },
  
  // Frontend configuration
  frontend: {
    baseUrl: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
  },
  
  // Feature flags
  features: {
    enableAI: process.env.NEXT_PUBLIC_ENABLE_AI === 'true',
    enableWebSocket: process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === 'true',
    enableDebug: process.env.NODE_ENV === 'development',
  },
  
  // API endpoints
  endpoints: {
    projects: (projectId: string) => 
      `${config.backend.baseUrl}/api/projects/${projectId}`,
    panelLayout: (projectId: string) => 
      `${config.backend.baseUrl}/api/panel-layout/${projectId}`,
    documents: (projectId: string) => 
      `${config.backend.baseUrl}/api/documents/${projectId}`,
    health: () => 
      `${config.backend.baseUrl}/health`,
  }
};

export default config;
