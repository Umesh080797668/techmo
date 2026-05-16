'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Layout/Sidebar';
import TopBar from '@/components/Layout/TopBar';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    } else if (!isLoading && user?.mustChangePassword && pathname !== '/force-change-password') {
      router.replace('/force-change-password');
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f8fafc' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TopBar onMenuToggle={() => setSidebarOpen(o => !o)} />
        <main
          className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth"
          style={{
            background:
              'radial-gradient(ellipse 90% 55% at 80% -5%, rgba(219,234,254,0.42) 0%, transparent 55%),' +
              'radial-gradient(ellipse 65% 45% at 5%  105%, rgba(237,233,254,0.22) 0%, transparent 50%),' +
              '#f8fafc',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
