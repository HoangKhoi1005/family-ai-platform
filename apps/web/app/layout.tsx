import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@family/ui/tokens.css';
import './styles.css';
export const metadata: Metadata = {
  title: 'Nhà mình · Family AI',
  description: 'Biết nhau, kết nối nhau và lưu giữ những điều thân thương.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <a className="skip-link" href="#main">
          Đến nội dung chính
        </a>
        {children}
      </body>
    </html>
  );
}
