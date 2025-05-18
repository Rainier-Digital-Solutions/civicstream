/** @type {import('next').NextConfig} */
module.exports = {
  // output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Enable SWC and disable Babel
  swcMinify: true,
  experimental: {
    forceSwcTransforms: true,
  },
  webpack: (config, { isServer }) => {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    // Add resolve fallbacks for node modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // Configure WebAssembly loading
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Fix for @dqbd/tiktoken
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@dqbd/tiktoken': '@dqbd/tiktoken/tiktoken.js',
      };
    }

    return config;
  },
  // Allow cross-origin requests in development
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },
    ];
  },
  // Configure allowed development origins
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};