'use client';

import { useState } from 'react';
import { useStreamingSearch } from '@/hooks/useRealtimeSearch';
import type { ScraperProduct } from '@/lib/scraperApi';

const TABS = [
  { key: 'PACKAGE', label: '패키지', icon: '🧳' },
  { key: 'AIRTEL',  label: '에어텔', icon: '🛫' },
] as const;

type TabKey = typeof TABS[number]['key'];

interface WatchCondition {
  destination: { name: string };
  origin?: { cityCode: string };
  travel_condition: {
    wishMonths?: number[];
    durationRange?: { min: number; max: number };
    budget?: { maxPerPerson: number };
  };
  watched_product_types?: string[];
}

function ProductCard({ product }: { product: ScraperProduct }) {
  const depFrom = product.departure_date_from?.slice(0, 10) ?? '';
  const depTo   = product.departure_date_to?.slice(0, 10) ?? '';

  return (
    <a
      href={product.deep_link_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-amber-200 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-600">
            {product.provider}
          </span>
          {product.duration_nights > 0 && (
            <span className="text-xs text-slate-400">{product.duration_nights}박</span>
          )}
        </div>
        <p className="mt-1.5 truncate text-sm font-bold text-slate-800">
          {product.product_name || product.destination.name}
        </p>
        {depFrom && (
          <p className="mt-0.5 text-xs text-slate-400">
            {depFrom}{depTo && depTo !== depFrom ? ` ~ ${depTo}` : ''} 출발
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="text-right">
          <p className="text-xs text-slate-400">1인</p>
          <p className="text-lg font-extrabold text-amber-600">
            {product.price_per_person.toLocaleString('ko-KR')}
            <span className="text-xs font-normal text-slate-500">원</span>
          </p>
        </div>
        <span className="whitespace-nowrap rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">
          예약하기 →
        </span>
      </div>
    </a>
  );
}

export default function RealtimeProductList({ watchItem }: { watchItem: WatchCondition }) {
  const [activeTab, setActiveTab] = useState<TabKey>('PACKAGE');
  const { status, currentLabel, providers, results } = useStreamingSearch(watchItem);

  const byType = (type: TabKey) =>
    results
      .filter(p => p.product_type === type)
      .sort((a, b) => a.price_per_person - b.price_per_person);

  const isSearching = status === 'searching';

  return (
    <div className="mt-4">
      {/* 여행사 진행 상태 */}
      {providers.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {providers.map(p => (
            <span
              key={p.key}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                p.status === 'done'
                  ? 'bg-green-50 text-green-600'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {p.status === 'done' ? '✓' : (
                <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
              )}
              {p.label} {p.status === 'done' ? `${p.count}건` : ''}
            </span>
          ))}
        </div>
      )}

      {/* 검색 중 배너 */}
      {isSearching && currentLabel && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm text-blue-600">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          <span><b>{currentLabel}</b>에서 검색 중...</span>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map(tab => {
          const count = byType(tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {(count > 0 || isSearching) && (
                <span className={`rounded-full px-1.5 text-[10px] text-white ${
                  isSearching && count === 0 ? 'bg-slate-300' : 'bg-amber-500'
                }`}>
                  {isSearching && count === 0 ? '···' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 완료 안내 */}
      {status === 'done' && (
        <p className="mt-2 text-xs text-slate-400">검색 완료 · 가격순 정렬</p>
      )}

      {/* 에러 */}
      {status === 'error' && (
        <p className="mt-6 text-center text-sm text-slate-400">
          검색 서버에 연결할 수 없습니다.
        </p>
      )}

      {/* 탭 결과 */}
      <div className="mt-3 space-y-3">
        {byType(activeTab).length > 0
          ? byType(activeTab).map((product, i) => (
              <ProductCard key={i} product={product} />
            ))
          : status === 'done' && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center">
                <p className="text-slate-400">
                  {TABS.find(t => t.key === activeTab)?.label} 상품이 없어요.
                </p>
              </div>
            )
        }

        {/* 초기 로딩 스켈레톤 */}
        {isSearching && byType(activeTab).length === 0 && (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
