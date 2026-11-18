/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Shared workspace package ships TypeScript source.
  transpilePackages: ['@rb-lab/shared'],
};

export default nextConfig;
