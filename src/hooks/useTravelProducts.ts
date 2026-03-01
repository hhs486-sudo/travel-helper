'use client';

import { useQuery } from '@tanstack/react-query';
import { bkend } from '@/lib/bkend';
import type { TravelProduct } from '@/types';

// WatchItemCard가 사용하는 item 형태와 동일
interface WatchItemForMatch {
  id: string;
  destination: { name: string; countryCode: string; cityCode?: string; type?: string };
  origin: { cityCode: string; airportCodes?: string[] };
  travel_condition: {
    wishMonths: number[];
    durationRange: { min: number; max: number };
    budget: { maxPerPerson: number };
  };
  watched_product_types: string[];
}

export const travelProductKeys = {
  matched: (watchItemId: string) =>
    ['travel_product', 'matched', watchItemId] as const,
};

async function fetchAllProducts(): Promise<TravelProduct[]> {
  // bkend 서버 필터가 동작하지 않아 전체를 가져와 클라이언트에서 필터링
  const all: TravelProduct[] = [];
  let page = 1;

  while (true) {
    const data = await bkend.data.list('travel_product', {
      limit: '100',
      page: String(page),
    });
    const chunk = ((data as { items?: TravelProduct[] })?.items ?? []) as TravelProduct[];
    all.push(...chunk);

    const pagination = (data as { pagination?: { hasNext?: boolean } })?.pagination;
    if (!pagination?.hasNext) break;
    page++;
  }

  return all;
}

// 스크래퍼가 국가명으로 저장하는 상품들 (도시 특정 안 됨)
const COUNTRY_LEVEL_NAMES = new Set([
  '일본', '태국', '베트남', '필리핀', '말레이시아', '인도네시아',
  '중국', '대만', '유럽', '미국', '호주', '뉴질랜드', '터키', '크로아티아',
]);

function clientFilter(
  products: TravelProduct[],
  item: WatchItemForMatch
): TravelProduct[] {
  const budget = item.travel_condition.budget.maxPerPerson;
  const { min, max } = item.travel_condition.durationRange;

  return products.filter((p) => {
    if (!p.is_active) return false;

    // 예산 필터
    if (p.price_per_person > budget) return false;

    // 기간 필터 (0박은 정보 없음 → 통과, 범위 ±2박 허용)
    if (p.duration_nights > 0 && (p.duration_nights < min - 2 || p.duration_nights > max + 2)) return false;

    // 1) 이름 부분 일치 (오사카↔오사카, 다낭↔다낭)
    const nameMatch =
      p.destination.name.includes(item.destination.name) ||
      item.destination.name.includes(p.destination.name);
    // 2) 상품이 국가명(일본, 태국...)으로 저장된 경우 → 해당 국가의 도시 watch에도 매칭
    const countryLevelMatch =
      COUNTRY_LEVEL_NAMES.has(p.destination.name) &&
      p.destination.countryCode === item.destination.countryCode;
    // 3) COUNTRY 타입 watch (일본, 태국 등록) → 해당 국가 모든 상품 매칭
    const countryWatchMatch =
      item.destination.type === 'COUNTRY' &&
      p.destination.countryCode === item.destination.countryCode;
    if (!nameMatch && !countryLevelMatch && !countryWatchMatch) return false;

    // 출발지 매칭 (cityCode 또는 airportCodes 기준)
    const watchCityCode = item.origin.cityCode;
    const watchAirports = item.origin.airportCodes ?? [];
    const productCityCode = p.origin?.cityCode ?? '';
    const originMatch =
      productCityCode === watchCityCode ||
      watchAirports.includes(productCityCode);
    if (!originMatch) return false;

    // 상품 유형 매칭
    if (!item.watched_product_types.includes(p.product_type)) return false;

    // 출발월 매칭: departure_date_from ~ departure_date_to 범위 안에 희망 월이 포함되는지 확인
    if (p.departure_date_from && item.travel_condition.wishMonths?.length > 0) {
      const fromDate = new Date(p.departure_date_from);
      const toDate = p.departure_date_to ? new Date(p.departure_date_to) : fromDate;
      const hasMatchingMonth = item.travel_condition.wishMonths.some((wishMonth) => {
        for (const year of [fromDate.getFullYear(), fromDate.getFullYear() + 1]) {
          const monthStart = new Date(year, wishMonth - 1, 1);
          const monthEnd = new Date(year, wishMonth, 0);
          if (monthStart <= toDate && monthEnd >= fromDate) return true;
        }
        return false;
      });
      if (!hasMatchingMonth) return false;
    }

    return true;
  });
}

export function useMatchedProducts(item: WatchItemForMatch) {
  return useQuery<TravelProduct[]>({
    queryKey: travelProductKeys.matched(item.id),
    queryFn: async () => {
      const all = await fetchAllProducts();
      return clientFilter(all, item).sort(
        (a, b) => a.price_per_person - b.price_per_person
      );
    },
    staleTime: 60_000,
    enabled: !!item.id,
  });
}
