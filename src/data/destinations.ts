import type { DestinationSuggestion } from '@/types';

/** 한국인 인기 여행지 정적 데이터 */
export const DESTINATIONS: DestinationSuggestion[] = [
  // ── 일본 ──────────────────────────────────────────────────
  { id: 'TYO', type: 'CITY', nameKo: '도쿄', nameEn: 'Tokyo', countryCode: 'JP', countryNameKo: '일본', cityCode: 'TYO', airportCodes: ['NRT', 'HND'], popularityScore: 100 },
  { id: 'OSA', type: 'CITY', nameKo: '오사카', nameEn: 'Osaka', countryCode: 'JP', countryNameKo: '일본', cityCode: 'OSA', airportCodes: ['KIX', 'ITM'], popularityScore: 98 },
  { id: 'FUK', type: 'CITY', nameKo: '후쿠오카', nameEn: 'Fukuoka', countryCode: 'JP', countryNameKo: '일본', cityCode: 'FUK', airportCodes: ['FUK'], popularityScore: 90 },
  { id: 'SPK', type: 'CITY', nameKo: '삿포로', nameEn: 'Sapporo', countryCode: 'JP', countryNameKo: '일본', cityCode: 'SPK', airportCodes: ['CTS'], popularityScore: 85 },
  { id: 'NGO', type: 'CITY', nameKo: '나고야', nameEn: 'Nagoya', countryCode: 'JP', countryNameKo: '일본', cityCode: 'NGO', airportCodes: ['NGO'], popularityScore: 75 },
  { id: 'OKA', type: 'CITY', nameKo: '오키나와', nameEn: 'Okinawa', countryCode: 'JP', countryNameKo: '일본', cityCode: 'OKA', airportCodes: ['OKA'], popularityScore: 80 },
  { id: 'KIJ', type: 'CITY', nameKo: '니가타', nameEn: 'Niigata', countryCode: 'JP', countryNameKo: '일본', cityCode: 'KIJ', airportCodes: ['KIJ'], popularityScore: 55 },
  { id: 'HIJ', type: 'CITY', nameKo: '히로시마', nameEn: 'Hiroshima', countryCode: 'JP', countryNameKo: '일본', cityCode: 'HIJ', airportCodes: ['HIJ'], popularityScore: 60 },

  // ── 동남아 ────────────────────────────────────────────────
  { id: 'BKK', type: 'CITY', nameKo: '방콕', nameEn: 'Bangkok', countryCode: 'TH', countryNameKo: '태국', cityCode: 'BKK', airportCodes: ['BKK', 'DMK'], popularityScore: 95 },
  { id: 'HKT', type: 'CITY', nameKo: '푸켓', nameEn: 'Phuket', countryCode: 'TH', countryNameKo: '태국', cityCode: 'HKT', airportCodes: ['HKT'], popularityScore: 88 },
  { id: 'CNX', type: 'CITY', nameKo: '치앙마이', nameEn: 'Chiang Mai', countryCode: 'TH', countryNameKo: '태국', cityCode: 'CNX', airportCodes: ['CNX'], popularityScore: 72 },
  { id: 'SIN', type: 'CITY', nameKo: '싱가포르', nameEn: 'Singapore', countryCode: 'SG', countryNameKo: '싱가포르', cityCode: 'SIN', airportCodes: ['SIN'], popularityScore: 93 },
  { id: 'KUL', type: 'CITY', nameKo: '쿠알라룸푸르', nameEn: 'Kuala Lumpur', countryCode: 'MY', countryNameKo: '말레이시아', cityCode: 'KUL', airportCodes: ['KUL'], popularityScore: 80 },
  { id: 'BKI', type: 'CITY', nameKo: '코타키나발루', nameEn: 'Kota Kinabalu', countryCode: 'MY', countryNameKo: '말레이시아', cityCode: 'BKI', airportCodes: ['BKI'], popularityScore: 78 },
  { id: 'HAN', type: 'CITY', nameKo: '하노이', nameEn: 'Hanoi', countryCode: 'VN', countryNameKo: '베트남', cityCode: 'HAN', airportCodes: ['HAN'], popularityScore: 82 },
  { id: 'SGN', type: 'CITY', nameKo: '호치민', nameEn: 'Ho Chi Minh City', countryCode: 'VN', countryNameKo: '베트남', cityCode: 'SGN', airportCodes: ['SGN'], popularityScore: 80 },
  { id: 'DAD', type: 'CITY', nameKo: '다낭', nameEn: 'Da Nang', countryCode: 'VN', countryNameKo: '베트남', cityCode: 'DAD', airportCodes: ['DAD'], popularityScore: 85 },
  { id: 'MNL', type: 'CITY', nameKo: '마닐라', nameEn: 'Manila', countryCode: 'PH', countryNameKo: '필리핀', cityCode: 'MNL', airportCodes: ['MNL'], popularityScore: 70 },
  { id: 'CEB', type: 'CITY', nameKo: '세부', nameEn: 'Cebu', countryCode: 'PH', countryNameKo: '필리핀', cityCode: 'CEB', airportCodes: ['CEB'], popularityScore: 75 },
  { id: 'DPS', type: 'CITY', nameKo: '발리', nameEn: 'Bali', countryCode: 'ID', countryNameKo: '인도네시아', cityCode: 'DPS', airportCodes: ['DPS'], popularityScore: 87 },
  { id: 'CGK', type: 'CITY', nameKo: '자카르타', nameEn: 'Jakarta', countryCode: 'ID', countryNameKo: '인도네시아', cityCode: 'CGK', airportCodes: ['CGK'], popularityScore: 60 },
  { id: 'RGN', type: 'CITY', nameKo: '양곤', nameEn: 'Yangon', countryCode: 'MM', countryNameKo: '미얀마', cityCode: 'RGN', airportCodes: ['RGN'], popularityScore: 45 },

  // ── 중화권 ────────────────────────────────────────────────
  { id: 'HKG', type: 'CITY', nameKo: '홍콩', nameEn: 'Hong Kong', countryCode: 'HK', countryNameKo: '홍콩', cityCode: 'HKG', airportCodes: ['HKG'], popularityScore: 88 },
  { id: 'TPE', type: 'CITY', nameKo: '타이베이', nameEn: 'Taipei', countryCode: 'TW', countryNameKo: '대만', cityCode: 'TPE', airportCodes: ['TPE', 'TSA'], popularityScore: 90 },
  { id: 'KHH', type: 'CITY', nameKo: '가오슝', nameEn: 'Kaohsiung', countryCode: 'TW', countryNameKo: '대만', cityCode: 'KHH', airportCodes: ['KHH'], popularityScore: 60 },
  { id: 'PEK', type: 'CITY', nameKo: '베이징', nameEn: 'Beijing', countryCode: 'CN', countryNameKo: '중국', cityCode: 'BJS', airportCodes: ['PEK', 'PKX'], popularityScore: 65 },
  { id: 'SHA', type: 'CITY', nameKo: '상하이', nameEn: 'Shanghai', countryCode: 'CN', countryNameKo: '중국', cityCode: 'SHA', airportCodes: ['PVG', 'SHA'], popularityScore: 70 },

  // ── 유럽 ──────────────────────────────────────────────────
  { id: 'CDG', type: 'CITY', nameKo: '파리', nameEn: 'Paris', countryCode: 'FR', countryNameKo: '프랑스', cityCode: 'PAR', airportCodes: ['CDG', 'ORY'], popularityScore: 92 },
  { id: 'LHR', type: 'CITY', nameKo: '런던', nameEn: 'London', countryCode: 'GB', countryNameKo: '영국', cityCode: 'LON', airportCodes: ['LHR', 'LGW', 'STN'], popularityScore: 90 },
  { id: 'FCO', type: 'CITY', nameKo: '로마', nameEn: 'Rome', countryCode: 'IT', countryNameKo: '이탈리아', cityCode: 'ROM', airportCodes: ['FCO', 'CIA'], popularityScore: 88 },
  { id: 'BCN', type: 'CITY', nameKo: '바르셀로나', nameEn: 'Barcelona', countryCode: 'ES', countryNameKo: '스페인', cityCode: 'BCN', airportCodes: ['BCN'], popularityScore: 82 },
  { id: 'MAD', type: 'CITY', nameKo: '마드리드', nameEn: 'Madrid', countryCode: 'ES', countryNameKo: '스페인', cityCode: 'MAD', airportCodes: ['MAD'], popularityScore: 75 },
  { id: 'AMS', type: 'CITY', nameKo: '암스테르담', nameEn: 'Amsterdam', countryCode: 'NL', countryNameKo: '네덜란드', cityCode: 'AMS', airportCodes: ['AMS'], popularityScore: 78 },
  { id: 'FRA', type: 'CITY', nameKo: '프랑크푸르트', nameEn: 'Frankfurt', countryCode: 'DE', countryNameKo: '독일', cityCode: 'FRA', airportCodes: ['FRA'], popularityScore: 72 },
  { id: 'VIE', type: 'CITY', nameKo: '빈', nameEn: 'Vienna', countryCode: 'AT', countryNameKo: '오스트리아', cityCode: 'VIE', airportCodes: ['VIE'], popularityScore: 70 },
  { id: 'ZRH', type: 'CITY', nameKo: '취리히', nameEn: 'Zurich', countryCode: 'CH', countryNameKo: '스위스', cityCode: 'ZRH', airportCodes: ['ZRH'], popularityScore: 68 },
  { id: 'PRG', type: 'CITY', nameKo: '프라하', nameEn: 'Prague', countryCode: 'CZ', countryNameKo: '체코', cityCode: 'PRG', airportCodes: ['PRG'], popularityScore: 74 },
  { id: 'CPH', type: 'CITY', nameKo: '코펜하겐', nameEn: 'Copenhagen', countryCode: 'DK', countryNameKo: '덴마크', cityCode: 'CPH', airportCodes: ['CPH'], popularityScore: 65 },
  { id: 'HEL', type: 'CITY', nameKo: '헬싱키', nameEn: 'Helsinki', countryCode: 'FI', countryNameKo: '핀란드', cityCode: 'HEL', airportCodes: ['HEL'], popularityScore: 62 },
  { id: 'IST', type: 'CITY', nameKo: '이스탄불', nameEn: 'Istanbul', countryCode: 'TR', countryNameKo: '튀르키예', cityCode: 'IST', airportCodes: ['IST', 'SAW'], popularityScore: 80 },

  // ── 미주 ──────────────────────────────────────────────────
  { id: 'LAX', type: 'CITY', nameKo: '로스앤젤레스', nameEn: 'Los Angeles', countryCode: 'US', countryNameKo: '미국', cityCode: 'LAX', airportCodes: ['LAX'], popularityScore: 85 },
  { id: 'JFK', type: 'CITY', nameKo: '뉴욕', nameEn: 'New York', countryCode: 'US', countryNameKo: '미국', cityCode: 'NYC', airportCodes: ['JFK', 'LGA', 'EWR'], popularityScore: 88 },
  { id: 'LAS', type: 'CITY', nameKo: '라스베이거스', nameEn: 'Las Vegas', countryCode: 'US', countryNameKo: '미국', cityCode: 'LAS', airportCodes: ['LAS'], popularityScore: 78 },
  { id: 'SFO', type: 'CITY', nameKo: '샌프란시스코', nameEn: 'San Francisco', countryCode: 'US', countryNameKo: '미국', cityCode: 'SFO', airportCodes: ['SFO'], popularityScore: 75 },
  { id: 'YVR', type: 'CITY', nameKo: '밴쿠버', nameEn: 'Vancouver', countryCode: 'CA', countryNameKo: '캐나다', cityCode: 'YVR', airportCodes: ['YVR'], popularityScore: 70 },
  { id: 'GRU', type: 'CITY', nameKo: '상파울루', nameEn: 'São Paulo', countryCode: 'BR', countryNameKo: '브라질', cityCode: 'SAO', airportCodes: ['GRU', 'CGH'], popularityScore: 40 },

  // ── 대양주 / 기타 ──────────────────────────────────────────
  { id: 'SYD', type: 'CITY', nameKo: '시드니', nameEn: 'Sydney', countryCode: 'AU', countryNameKo: '호주', cityCode: 'SYD', airportCodes: ['SYD'], popularityScore: 82 },
  { id: 'MEL', type: 'CITY', nameKo: '멜버른', nameEn: 'Melbourne', countryCode: 'AU', countryNameKo: '호주', cityCode: 'MEL', airportCodes: ['MEL'], popularityScore: 72 },
  { id: 'AKL', type: 'CITY', nameKo: '오클랜드', nameEn: 'Auckland', countryCode: 'NZ', countryNameKo: '뉴질랜드', cityCode: 'AKL', airportCodes: ['AKL'], popularityScore: 65 },
  { id: 'GUM', type: 'CITY', nameKo: '괌', nameEn: 'Guam', countryCode: 'GU', countryNameKo: '괌', cityCode: 'GUM', airportCodes: ['GUM'], popularityScore: 83 },
  { id: 'PPT', type: 'CITY', nameKo: '사이판', nameEn: 'Saipan', countryCode: 'MP', countryNameKo: '사이판', cityCode: 'SPN', airportCodes: ['SPN'], popularityScore: 72 },
  { id: 'DXB', type: 'CITY', nameKo: '두바이', nameEn: 'Dubai', countryCode: 'AE', countryNameKo: '아랍에미리트', cityCode: 'DXB', airportCodes: ['DXB'], popularityScore: 78 },
  { id: 'CMB', type: 'CITY', nameKo: '콜롬보', nameEn: 'Colombo', countryCode: 'LK', countryNameKo: '스리랑카', cityCode: 'CMB', airportCodes: ['CMB'], popularityScore: 50 },
  { id: 'DEL', type: 'CITY', nameKo: '델리', nameEn: 'Delhi', countryCode: 'IN', countryNameKo: '인도', cityCode: 'DEL', airportCodes: ['DEL'], popularityScore: 52 },
  { id: 'BOM', type: 'CITY', nameKo: '뭄바이', nameEn: 'Mumbai', countryCode: 'IN', countryNameKo: '인도', cityCode: 'BOM', airportCodes: ['BOM'], popularityScore: 48 },
];

/** 검색어로 목적지 필터링 (한글명 / 영문명 / 국가명 모두 검색) */
export function searchDestinations(query: string): DestinationSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return DESTINATIONS.filter(
    (d) =>
      d.nameKo.includes(q) ||
      d.nameEn.toLowerCase().includes(q) ||
      d.countryNameKo.includes(q) ||
      d.cityCode?.toLowerCase().includes(q) ||
      d.airportCodes.some((c) => c.toLowerCase().includes(q))
  )
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 6);
}
