'use client';

import { useDeleteWatchItem } from '@/hooks/useWatchItems';

const PRODUCT_LABELS: Record<string, string> = {
  FLIGHT: '항공',
  HOTEL: '호텔',
  AIRTEL: '에어텔',
  PACKAGE: '패키지',
};

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

interface WatchItemCardProps {
  item: {
    id: string;
    destination: { name: string; countryCode: string };
    travel_condition: {
      wishMonths: number[];
      durationRange: { min: number; max: number };
      pax: { adults: number; children: number; infants: number };
      budget: { maxPerPerson: number };
    };
    watched_product_types: string[];
    createdAt: string;
  };
}

export default function WatchItemCard({ item }: WatchItemCardProps) {
  const deleteMutation = useDeleteWatchItem();

  const { destination, travel_condition: tc, watched_product_types, createdAt } = item;
  const monthLabels = tc.wishMonths.map((m) => MONTH_LABELS[m - 1]).join(', ');
  const totalPax = tc.pax.adults + tc.pax.children + tc.pax.infants;
  const budget = tc.budget.maxPerPerson.toLocaleString('ko-KR');

  function handleDelete() {
    if (confirm(`"${destination.name}" 관심 여행지를 삭제할까요?`)) {
      deleteMutation.mutate(item.id);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {/* 상단: 목적지 + 삭제 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-400">{destination.countryCode}</p>
          <h3 className="text-lg font-extrabold text-slate-800">{destination.name}</h3>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          ✕
        </button>
      </div>

      {/* 상품 유형 뱃지 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {watched_product_types.map((type) => (
          <span
            key={type}
            className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700"
          >
            {PRODUCT_LABELS[type] ?? type}
          </span>
        ))}
      </div>

      {/* 여행 조건 */}
      <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm text-slate-600">
        {monthLabels && (
          <div className="col-span-2">
            <span className="text-slate-400">희망 월 </span>{monthLabels}
          </div>
        )}
        <div>
          <span className="text-slate-400">기간 </span>
          {tc.durationRange.min}~{tc.durationRange.max}박
        </div>
        <div>
          <span className="text-slate-400">인원 </span>{totalPax}명
        </div>
        <div className="col-span-2">
          <span className="text-slate-400">예산 </span>
          1인 {budget}원 이하
        </div>
      </div>

      {/* 등록일 */}
      <p className="mt-3 text-xs text-slate-400">
        {new Date(createdAt).toLocaleDateString('ko-KR')} 등록
      </p>
    </div>
  );
}
