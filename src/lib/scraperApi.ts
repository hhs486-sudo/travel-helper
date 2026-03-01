const BASE = process.env.NEXT_PUBLIC_SCRAPER_API_URL ?? 'http://localhost:8001';

export interface ScraperProduct {
  product_type: 'PACKAGE' | 'AIRTEL' | 'FLIGHT' | 'HOTEL';
  product_name: string;
  destination: { name: string; countryCode: string; cityCode?: string };
  origin: { cityCode: string };
  price_per_person: number;
  total_price: number;
  duration_nights: number;
  departure_date_from: string;
  departure_date_to: string;
  pax: number;
  provider: string;
  deep_link_url: string;
}

export interface SearchResponse {
  destination: string;
  count: number;
  cached: boolean;
  results: ScraperProduct[];
}

export async function searchPackages(params: {
  destination: string;
  budget?: number;
  duration_min?: number;
  duration_max?: number;
  product_types?: string[];
  wish_months?: number[];
}): Promise<SearchResponse> {
  const q = new URLSearchParams({ destination: params.destination });
  if (params.budget)        q.set('budget', String(params.budget));
  if (params.duration_min)  q.set('duration_min', String(params.duration_min));
  if (params.duration_max)  q.set('duration_max', String(params.duration_max));
  if (params.product_types?.length) q.set('product_types', params.product_types.join(','));
  if (params.wish_months?.length)   q.set('wish_months', params.wish_months.join(','));

  const res = await fetch(`${BASE}/search?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`scraper API error: ${res.status}`);
  return res.json();
}
