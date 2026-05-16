'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { CustomerAuthProvider } from '@/contexts/CustomerAuthContext';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 1000 * 60 * 5, retry: 1 },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#1e2130', color: '#e2e8f0', border: '1px solid #2d3452' },
            success: { iconTheme: { primary: '#22c55e', secondary: '#1e2130' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#1e2130' } },
          }}
        />
      </CustomerAuthProvider>
    </QueryClientProvider>
  );
}
