'use client';

import { useMatchedProducts } from '@/hooks/useTravelProducts';
import MatchedProductCard from './MatchedProductCard';

interface WatchItemForMatch {
  id: string;
  destination: { name: string; countryCode: string };
  origin: { cityCode: string; airportCodes?: string[] };
  travel_condition: {
    wishMonths: number[];
    durationRange: { min: number; max: number };
    budget: { maxPerPerson: number };
  };
  watched_product_types: string[];
}

interface MatchedProductListProps {
  watchItem: WatchItemForMatch;
}

export default function MatchedProductList({ watchItem }: MatchedProductListProps) {
  const { data, isLoading, isError } = useMatchedProducts(watchItem);

  if (isLoading) {
    return (
      <div className="mt-4 grid gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="mt-4 text-center text-sm text-red-400">
        상품을 불러오지 못했습니다.
      </p>
    );
  }

  const products = (data ?? []).slice(0, 20);

  if (products.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center">
        <p className="text-slate-400">현재 조건에 맞는 특가가 없어요.</p>
        <p className="mt-1 text-xs text-slate-300">
          스크래퍼가 새 상품을 수집하면 자동으로 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {products.map((product) => (
        <MatchedProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
