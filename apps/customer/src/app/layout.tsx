import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Providers from './providers';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'My Account – TechMo', template: '%s | TechMo Customer Portal' },
  description: 'Manage your repairs, track loyalty points, view order history and warranty status.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.techmo.lk'),
  openGraph: {
    type: 'website',
    siteName: 'TechMo',
    title: 'TechMo Customer Portal',
    description: 'Your personal TechMo account — repairs, points, history & more.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TechMo Customer Portal' }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#5b8dee',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background text-slate-200 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
