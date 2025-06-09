/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'bcrypt'],
  // Resolve the 'canvas' module that react-konva depends on and handle native deps
  webpack: (config, { isServer }) => {
    // This tells webpack to ignore problematic modules in browser environment
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
        os: false,
      };
    }
    
    // Resolve native module issues and Konva conflicts
    config.resolve.alias = {
      ...config.resolve.alias,
      'lightningcss': false,
      'konva/lib/index-node': 'konva/lib/index',
    };
    
    // Exclude problematic modules from bundling
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push('canvas');
    }
    
    return config;
  },
  // Configure API proxy
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8003/api/:path*',
      },
      // Fix static asset routing
      {
        source: '/static/:path*',
        destination: '/_next/static/:path*',
      }
    ];
  },
  // Ensure security headers allow proper asset loading
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws: wss: http://localhost:8003 http://localhost:8000; frame-src 'self';"
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          }
        ],
      },
    ];
  },
  // For Replit web preview - important for dashboard display
  distDir: '.next',
  // Turn off compression for easier debugging
  compress: false,
  // Important for Replit
  experimental: {
    allowedDevOrigins: ['.replit.dev', '.picard.replit.dev', '.csb.app', '*'], 
    externalDir: true
  },
  // Ensure assets are served from correct path
  assetPrefix: '',
  // Handle cross-origin issues on Replit
  crossOrigin: 'anonymous',
  // Properly generate assets
  generateEtags: false,
  poweredByHeader: false,
};

module.exports = nextConfig;
