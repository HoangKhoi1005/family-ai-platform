import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PwaRegistration } from './pwa-registration';
import '@xyflow/react/dist/style.css';
import '@family/ui/tokens.css';
import './styles.css';
export const metadata: Metadata = {
  title: 'Nhà mình · Family AI',
  description: 'Biết nhau, kết nối nhau và lưu giữ những điều thân thương.',
  robots: { index: false, follow: false },
  icons: { apple: '/apple-touch-icon.png' },
};
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#315D47' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <a className="skip-link" href="#main">
          Đến nội dung chính
        </a>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
