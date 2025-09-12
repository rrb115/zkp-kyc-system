/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle BigInt serialization
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
  transpilePackages: ['snarkjs', 'circomlibjs'],
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
