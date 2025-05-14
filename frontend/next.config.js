/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'bcrypt'],
  // Resolve the 'canvas' module that react-konva depends on
  webpack: (config, { isServer }) => {
    // This tells webpack to ignore 'canvas' module in browser environment
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
  // Allow Replit domains for development
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws: wss: http://localhost:8000; frame-src 'self';"
          }
        ],
      },
    ];
  },
  // For Replit web preview
  output: 'standalone',
  // Important for Replit
  experimental: {
    allowedDevOrigins: ['.replit.dev', '.picard.replit.dev', '.csb.app']
  },
  // Handle cross-origin issues on Replit
  crossOrigin: 'anonymous',
};

module.exports = nextConfig;
