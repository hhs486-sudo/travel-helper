'use client';

import { useState, useEffect, useRef } from 'react';
import type { ScraperProduct } from '@/lib/scraperApi';

// 출발 공항코드 → ybtour 출발도시 코드
const DEPART_CITY_MAP: Record<string, string> = {
  ICN: 'I', GMP: 'G', PUS: 'B', TAE: 'D', CJJ: 'C',
  SEL: 'I',   // 서울 도시코드 → 인천 출발
};

const BASE = process.env.NEXT_PUBLIC_SCRAPER_API_URL ?? 'http://localhost:8001';

export type SearchStatus = 'idle' | 'searching' | 'done' | 'error';

export interface ProviderStatus {
  key: string;
  label: string;
  status: 'searching' | 'done' | 'error';
  count: number;
}

export interface StreamingSearchState {
  status: SearchStatus;
  currentLabel: string;       // "노랑풍선 검색 중..."
  providers: ProviderStatus[];
  results: ScraperProduct[];
  total: number;
}

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

export function useStreamingSearch(item: WatchCondition | null): StreamingSearchState {
  const [state, setState] = useState<StreamingSearchState>({
    status: 'idle',
    currentLabel: '',
    providers: [],
    results: [],
    total: 0,
  });

  const esRef = useRef<EventSource | null>(null);
  const destination = item?.destination?.name ?? '';

  useEffect(() => {
    if (!destination) return;

    // 이전 연결 닫기
    esRef.current?.close();

    setState({ status: 'searching', currentLabel: '', providers: [], results: [], total: 0 });

    // 쿼리 파라미터 구성
    const q = new URLSearchParams({ destination });
    const budget = item?.travel_condition?.budget?.maxPerPerson;
    const dur = item?.travel_condition?.durationRange;
    const months = item?.travel_condition?.wishMonths;
    const types = item?.watched_product_types?.filter(t => t === 'PACKAGE' || t === 'AIRTEL');

    const originCity = item?.origin?.cityCode || undefined;  // null/''이면 undefined로

    if (budget)          q.set('budget', String(budget));
    if (dur?.min)        q.set('duration_min', String(dur.min));
    if (dur?.max)        q.set('duration_max', String(dur.max));
    if (months?.length)  q.set('wish_months', months.join(','));
    if (types?.length)   q.set('product_types', types.join(','));
    if (originCity)      q.set('origin', originCity);

    const es = new EventSource(`${BASE}/search/stream?${q}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === 'searching') {
        setState(prev => ({
          ...prev,
          currentLabel: event.label,
          providers: [...prev.providers, { key: event.provider, label: event.label, status: 'searching', count: 0 }],
        }));
      }

      if (event.type === 'results') {
        // 출발지 클라이언트 필터: depart_city가 있으면 origin과 대조
        const originCode = item?.origin?.cityCode || 'ICN';
        const targetCity = DEPART_CITY_MAP[originCode] || 'I';
        const filtered = (event.data as (ScraperProduct & { depart_city?: string })[])
          .filter(p => !p.depart_city || p.depart_city === targetCity);

        setState(prev => ({
          ...prev,
          results: [...prev.results, ...filtered],
          providers: prev.providers.map(p =>
            p.key === event.provider
              ? { ...p, status: 'done', count: event.count }
              : p
          ),
        }));
      }

      if (event.type === 'error') {
        setState(prev => ({
          ...prev,
          providers: prev.providers.map(p =>
            p.key === event.provider ? { ...p, status: 'error' } : p
          ),
        }));
      }

      if (event.type === 'done') {
        setState(prev => ({
          ...prev,
          status: 'done',
          currentLabel: '',
          total: event.total,
        }));
        es.close();
      }
    };

    es.onerror = () => {
      setState(prev => ({ ...prev, status: 'error', currentLabel: '' }));
      es.close();
    };

    return () => es.close();
  }, [destination]);

  return state;
}
