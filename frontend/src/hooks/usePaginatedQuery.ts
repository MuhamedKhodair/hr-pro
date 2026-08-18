'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PaginatedPayload<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Hook for endpoints that return { data: T[], pagination }.
 * Also transparently handles plain-array responses (no pagination).
 */
export function usePaginatedQuery<T>(
  key: (string | number)[],
  endpoint: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery<{ items: T[]; pagination?: PaginationMeta }>({
    queryKey: key,
    queryFn: async () => {
      if (!endpoint) throw new Error('No endpoint');
      const res = await api.get<PaginatedPayload<T> | T[]>(endpoint);
      if (!res.data) return { items: [] };
      if (Array.isArray(res.data)) return { items: res.data };
      return { items: res.data.data, pagination: res.data.pagination };
    },
    enabled: !!endpoint && (options?.enabled ?? true),
    staleTime: 30_000,
    gcTime: 300_000,
  });
}

export function useInvalidate() {
  const queryClient = useQueryClient();
  return (keys: (string | number)[][]) => keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
}
