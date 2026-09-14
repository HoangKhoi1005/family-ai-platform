import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nhà mình · Không gian riêng của gia đình',
    short_name: 'Nhà mình',
    description: 'Biết nhau, kết nối nhau và lưu giữ những điều thân thương.',
    lang: 'vi',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#F5F0E7',
    theme_color: '#315D47',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
