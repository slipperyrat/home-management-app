'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create a stable query client instance
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          // Stale time: How long data is considered fresh
          staleTime: 5 * 60 * 1000, // 5 minutes
          // Cache time: How long data stays in cache after component unmounts
          gcTime: 10 * 60 * 1000, // 10 minutes
          // Retry failed requests
          retry: (failureCount, error: any) => {
            // Don't retry on 401/403 errors
            if (error?.status === 401 || error?.status === 403) {
              return false;
            }
            // Retry up to 3 times for other errors
            return failureCount < 3;
          },
          // Refetch on window focus for critical data
          refetchOnWindowFocus: false, // Disable for now to reduce API calls
          // Don't refetch on reconnect to reduce load
          refetchOnReconnect: false,
        },
        mutations: {
          // Don't retry mutations by default
          retry: false,
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
