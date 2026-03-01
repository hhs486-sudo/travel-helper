'use client';

import type { TravelProduct } from '@/types';

const PRODUCT_ICONS: Record<string, string> = {
  PACKAGE: '🧳',
  AIRTEL: '🛫',
  FLIGHT: '✈️',
  HOTEL: '🏨',
};

const PRODUCT_LABELS: Record<string, string> = {
  PACKAGE: '패키지',
  AIRTEL: '에어텔',
  FLIGHT: '항공권',
  HOTEL: '호텔',
};

interface MatchedProductCardProps {
  product: TravelProduct;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function MatchedProductCard({ product }: MatchedProductCardProps) {
  const {
    product_type,
    destination,
    provider,
    price_per_person,
    duration_nights,
    departure_date_from,
    departure_date_to,
    deep_link_url,
  } = product;

  const icon = PRODUCT_ICONS[product_type] ?? '🗺️';
  const typeLabel = PRODUCT_LABELS[product_type] ?? product_type;
  const price = price_per_person.toLocaleString('ko-KR');

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      {/* 좌측: 정보 */}
      <div className="min-w-0 flex-1">
        {/* 공급자 + 유형 */}
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
            {provider}
          </span>
          <span className="text-sm">{icon}</span>
          <span className="text-xs text-slate-500">{typeLabel}</span>
        </div>

        {/* 목적지 + 기간 */}
        <p className="mt-1.5 truncate font-bold text-slate-800">
          {destination.name}
          <span className="ml-1.5 text-sm font-normal text-slate-500">
            {duration_nights}박
          </span>
        </p>

        {/* 출발 기간 */}
        {departure_date_from && (
          <p className="mt-0.5 text-xs text-slate-400">
            {formatDate(departure_date_from)}
            {departure_date_to && ` ~ ${formatDate(departure_date_to)}`}
          </p>
        )}
      </div>

      {/* 우측: 가격 + 예약 버튼 */}
      <div className="flex flex-col items-end gap-2">
        <div className="text-right">
          <p className="text-xs text-slate-400">1인</p>
          <p className="text-lg font-extrabold text-amber-600">
            {price}
            <span className="text-xs font-normal text-slate-500">원</span>
          </p>
        </div>
        <a
          href={deep_link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
        >
          예약하기 →
        </a>
      </div>
    </div>
  );
}
