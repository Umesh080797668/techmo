'use client';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { parseApiError } from '@/lib/api';

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only toast if the query has no individual error handler
        if (query.options.meta?.suppressGlobalError) return;
        const { status, message } = parseApiError(error);
        toast.error(message, { id: `qerr-${status}-${message.slice(0, 40)}` });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _v, _ctx, mutation) => {
        // Only fire global toast if the mutation has no onError callback
        if (mutation.options.onError) return;
        const { status, message } = parseApiError(error);
        toast.error(message, { id: `merr-${status}-${message.slice(0, 40)}` });
      },
    }),
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 10_000,
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
        refetchIntervalInBackground: false,
        // Prevent unhandled query errors from propagating to React error
        // boundaries — the QueryCache.onError toast handles them instead.
        throwOnError: false,
      },
      mutations: {
        // Same: MutationCache.onError toasts — don't throw to boundaries.
        throwOnError: false,
      },
    },
  });
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'text-sm font-medium',
            duration: 3500,
            style: { borderRadius: '12px', padding: '12px 16px' },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
