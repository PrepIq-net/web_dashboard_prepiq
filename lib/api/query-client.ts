import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000, // 5 minutes - data stays fresh longer
        gcTime: 10 * 60_000, // 10 minutes - keep in cache longer
        refetchOnWindowFocus: false, // Don't refetch on window focus
        refetchOnMount: false, // Don't refetch on component mount if data exists
        refetchOnReconnect: false, // Don't refetch on reconnect
        retry: 1, // Only retry once on failure
      },
      mutations: {
        retry: 0, // Don't retry mutations
      },
    },
  });
}
