import { describe, expect, it } from 'vitest';

describe('PWA manifest', () => {
  it('describes the Vietnamese standalone app and starts inside the connected app', async () => {
    const modulePath = './manifest';
    const manifestModule = await import(modulePath).catch(() => null);

    expect(manifestModule).not.toBeNull();
    const manifest = manifestModule?.default();
    expect(manifest).toMatchObject({
      name: 'Nhà mình · Không gian riêng của gia đình',
      short_name: 'Nhà mình',
      lang: 'vi',
      start_url: '/app',
      scope: '/',
      display: 'standalone',
    });
  });

  it('publishes regular and maskable launcher icons', async () => {
    const modulePath = './manifest';
    const manifestModule = await import(modulePath).catch(() => null);
    const manifest = manifestModule?.default();

    expect(manifest?.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192' }),
        expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512' }),
        expect.objectContaining({
          src: '/icons/icon-maskable-512.png',
          sizes: '512x512',
          purpose: 'maskable',
        }),
      ]),
    );
  });
});
