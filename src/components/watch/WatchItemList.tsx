'use client';

import Link from 'next/link';
import { useWatchItems } from '@/hooks/useWatchItems';
import WatchItemCard from '@/components/watch/WatchItemCard';
import Button from '@/components/ui/Button';

export default function WatchItemList() {
  const { data, isLoading, isError } = useWatchItems();
  const items = (data as { items?: unknown[] } | null)?.items ?? (Array.isArray(data) ? data : []);

  if (isLoading) {
    return (
      <div className="mt-6 grid gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="mt-6 text-center text-sm text-red-400">목록을 불러오지 못했습니다.</p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
        <p className="text-slate-400">아직 등록된 관심 여행지가 없어요.</p>
        <Link href="/watch/new" className="mt-4 inline-block">
          <Button size="md">+ 첫 여행지 등록하기</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4">
      {(items as Parameters<typeof WatchItemCard>[0]['item'][]).map((item) => (
        <WatchItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
