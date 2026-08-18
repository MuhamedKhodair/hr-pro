import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useApiGet<T>(key: string[], endpoint: string | null, options?: { enabled?: boolean; staleTime?: number }) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      if (!endpoint) throw new Error('No endpoint');
      const res = await api.get<T>(endpoint);
      if (!res.data) throw new Error('No data');
      return res.data;
    },
    enabled: !!endpoint && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 30_000,
    gcTime: 300_000,
  });
}

export function useApiPost<TResponse>(invalidateKeys?: (string | number)[][]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ endpoint, data }: { endpoint: string; data: unknown }) => {
      const res = await api.post<TResponse>(endpoint, data);
      return res.data;
    },
    onSuccess: () => invalidateKeys?.forEach((key) => queryClient.invalidateQueries({ queryKey: key })),
  });
}

export function useApiPut<TResponse>(invalidateKeys?: (string | number)[][]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ endpoint, data }: { endpoint: string; data: unknown }) => {
      const res = await api.put<TResponse>(endpoint, data);
      return res.data;
    },
    onSuccess: () => invalidateKeys?.forEach((key) => queryClient.invalidateQueries({ queryKey: key })),
  });
}

export function useApiPatch<TResponse>(invalidateKeys?: (string | number)[][]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ endpoint, data }: { endpoint: string; data: unknown }) => {
      const res = await api.patch<TResponse>(endpoint, data);
      return res.data;
    },
    onSuccess: () => invalidateKeys?.forEach((key) => queryClient.invalidateQueries({ queryKey: key })),
  });
}

export function useApiDelete(invalidateKeys?: (string | number)[][]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (endpoint: string) => {
      await api.delete(endpoint);
    },
    onSuccess: () => invalidateKeys?.forEach((key) => queryClient.invalidateQueries({ queryKey: key })),
  });
}
