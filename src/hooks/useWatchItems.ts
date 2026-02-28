'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bkend } from '@/lib/bkend';
import type {
  WatchItem,
  WatchItemSummary,
  CreateWatchItemRequest,
  UpdateWatchItemRequest,
} from '@/types';

// -----------------------------------------------------------------------
// Query Keys
// -----------------------------------------------------------------------
export const watchItemKeys = {
  all: ['watch_items'] as const,
  lists: () => [...watchItemKeys.all, 'list'] as const,
  list: (params?: Record<string, string>) =>
    [...watchItemKeys.lists(), params] as const,
  details: () => [...watchItemKeys.all, 'detail'] as const,
  detail: (id: string) => [...watchItemKeys.details(), id] as const,
};

// -----------------------------------------------------------------------
// 목록 조회
// -----------------------------------------------------------------------
export function useWatchItems(params?: Record<string, string>) {
  return useQuery<WatchItemSummary[]>({
    queryKey: watchItemKeys.list(params),
    queryFn: () => bkend.data.list('watch_items', params),
    staleTime: 30_000,
  });
}

// -----------------------------------------------------------------------
// 단건 조회
// -----------------------------------------------------------------------
export function useWatchItem(id: string) {
  return useQuery<WatchItem>({
    queryKey: watchItemKeys.detail(id),
    queryFn: () => bkend.data.get('watch_items', id),
    enabled: !!id,
    staleTime: 15_000,
  });
}

// -----------------------------------------------------------------------
// 생성
// -----------------------------------------------------------------------
export function useCreateWatchItem() {
  const queryClient = useQueryClient();

  return useMutation<WatchItem, Error, CreateWatchItemRequest>({
    mutationFn: (payload) => bkend.data.create('watch_items', payload),
    onSuccess: () => {
      // 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: watchItemKeys.lists() });
    },
  });
}

// -----------------------------------------------------------------------
// 수정
// -----------------------------------------------------------------------
export function useUpdateWatchItem(id: string) {
  const queryClient = useQueryClient();

  return useMutation<WatchItem, Error, UpdateWatchItemRequest>({
    mutationFn: (payload) => bkend.data.update('watch_items', id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(watchItemKeys.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: watchItemKeys.lists() });
    },
  });
}

// -----------------------------------------------------------------------
// 삭제
// -----------------------------------------------------------------------
export function useDeleteWatchItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => bkend.data.delete('watch_items', id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: watchItemKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: watchItemKeys.lists() });
    },
  });
}
