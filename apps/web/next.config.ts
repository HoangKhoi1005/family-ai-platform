import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@family/ui'],
  poweredByHeader: false,
  async rewrites() {
    const value = process.env.API_INTERNAL_URL;
    if (!value) throw new Error('API_INTERNAL_URL is required for the same-origin API proxy');
    let apiOrigin: URL;
    try {
      apiOrigin = new URL(value);
    } catch {
      throw new Error('API_INTERNAL_URL must be a valid HTTP URL');
    }
    if (
      !['http:', 'https:'].includes(apiOrigin.protocol) ||
      apiOrigin.username ||
      apiOrigin.password
    ) {
      throw new Error('API_INTERNAL_URL must be a credential-free HTTP URL');
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin.origin}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
