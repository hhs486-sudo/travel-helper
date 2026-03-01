'use client';

import Link from 'next/link';
import { useWatchItem } from '@/hooks/useWatchItems';
import RealtimeProductList from './RealtimeProductList';

const PRODUCT_LABELS: Record<string, string> = {
  FLIGHT: '항공',
  HOTEL: '호텔',
  AIRTEL: '에어텔',
  PACKAGE: '패키지',
};

const MONTH_LABELS = [
  '1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월',
];

interface WatchDetailViewProps {
  id: string;
}

export default function WatchDetailView({ id }: WatchDetailViewProps) {
  const { data, isLoading, isError } = useWatchItem(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-center">
        <p className="text-slate-400">여행지 정보를 불러오지 못했습니다.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-amber-500 underline">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  // API 응답 필드 처리 (bkend snake_case)
  const raw = data as unknown as Record<string, unknown>;
  const destination = (raw.destination as { name: string; countryCode: string }) ?? {};
  const tc = (raw.travel_condition as {
    wishMonths: number[];
    durationRange: { min: number; max: number };
    pax: { adults: number; children: number; infants: number };
    budget: { maxPerPerson: number };
  }) ?? {};
  const rawOrigin = raw.origin as { cityCode?: string | null } | null | undefined;
  const origin = { cityCode: rawOrigin?.cityCode || 'ICN' };
  const watchedProductTypes = (raw.watched_product_types as string[]) ?? [];
  const itemId = (raw.id as string) ?? id;

  const monthLabels = (tc.wishMonths ?? []).map((m) => MONTH_LABELS[m - 1]).join(', ');
  const budget = tc.budget?.maxPerPerson?.toLocaleString('ko-KR') ?? '';

  // MatchedProductList에 넘길 형태
  const watchItemForMatch = {
    id: itemId,
    destination,
    origin,
    travel_condition: tc,
    watched_product_types: watchedProductTypes,
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* 뒤로 가기 */}
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        ← 홈으로
      </Link>

      {/* 목적지 헤더 */}
      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium text-slate-400">{destination.countryCode}</p>
        <h1 className="text-2xl font-extrabold text-slate-800">{destination.name}</h1>

        {/* 상품 유형 뱃지 */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {watchedProductTypes.map((type) => (
            <span
              key={type}
              className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700"
            >
              {PRODUCT_LABELS[type] ?? type}
            </span>
          ))}
        </div>

        {/* 여행 조건 */}
        <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm text-slate-600">
          {monthLabels && (
            <div className="col-span-2">
              <span className="text-slate-400">희망 월 </span>{monthLabels}
            </div>
          )}
          <div>
            <span className="text-slate-400">기간 </span>
            {tc.durationRange?.min}~{tc.durationRange?.max}박
          </div>
          {tc.pax && (
            <div>
              <span className="text-slate-400">인원 </span>
              {tc.pax.adults + tc.pax.children + tc.pax.infants}명
            </div>
          )}
          {budget && (
            <div className="col-span-2">
              <span className="text-slate-400">예산 </span>1인 {budget}원 이하
            </div>
          )}
        </div>
      </div>

      {/* 실시간 특가 상품 */}
      <div className="mt-6">
        <h2 className="font-bold text-slate-700">실시간 특가 상품</h2>
        <RealtimeProductList
          watchItem={{
            destination,
            origin,
            travel_condition: tc,
            watched_product_types: watchedProductTypes,
          }}
        />
      </div>

    </div>
  );
}
