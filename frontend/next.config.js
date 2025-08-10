/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove deprecated experimental.appDir option
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8003/api/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        'canvas-prebuilt': false,
        fs: false,
        path: false,
        'utf-8-validate': false,
        'bufferutil': false
      };
    }
    
    // Add node-loader for .node files
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    // Add alias for konva
    config.resolve.alias = {
      ...config.resolve.alias,
      'konva/lib/index-node': 'konva/lib/index',
      'canvas': false,
    };

    // Exclude canvas from client bundle
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push('canvas');
    }

    // Ignore harmless Webpack warnings from Supabase
    config.ignoreWarnings = [
      {
        module: /@supabase\/realtime-js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      }
    ];

    return config;
  },
}

module.exports = nextConfig;
