import { beforeEach, describe, expect, it } from 'vitest';

describe('Next same-origin API proxy', () => {
  beforeEach(() => {
    process.env.API_INTERNAL_URL = 'http://127.0.0.1:4010';
  });

  it('rewrites browser /api requests to the server-only API origin', async () => {
    const module = await import('./next.config.js');
    const rewrites = await module.default.rewrites?.();
    expect(rewrites).toEqual([
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:4010/api/:path*',
      },
    ]);
  });

  it('serves the service worker with no-store and script-only security headers', async () => {
    const module = await import('./next.config.js');
    const headers = await module.default.headers?.();

    expect(headers).toContainEqual({
      source: '/sw.js',
      headers: [
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self'",
        },
      ],
    });
  });
});
