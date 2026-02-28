# 트립핑(Tripping) 스마트 여행 서비스 — 상품 유형 확장 기획 명세서

> 작성일: 2026-02-27
> 버전: v2.2 (LCC 프로모션 수집 전략 강화)
> 기반 스택: Next.js 14+ / TypeScript / bkend.ai / Zustand / TanStack Query
>
> **v2.2 변경 요약:** 섹션 5-1 LCC OTA 커버리지 분석 추가 / 섹션 5-1-1 국내 LCC 6사 수집 전략 전면 재설계 (합법적 수집 경로 구체화, 프로모션 패턴 분석, 모니터링 주기 조정) / 섹션 8 LCC 전용 워커 설계 및 FSC-LCC 통합 파이프라인 추가

---

## 목차

1. 상품 유형별 데이터 구조 정의
2. 관심 여행지 등록 UX 상세
3. 자동 탐색·추천 로직
4. 추천 결과 화면 설계
5. 외부 API 연동 소스 (유형별)
6. 알림 전략 고도화
7. 개정된 데이터 모델 (WatchItem 중심)
8. 항공사 자체 프로모션 시스템 _(v2.1 신규)_

---

## 1. 상품 유형별 데이터 구조 정의

### 1-1. 4가지 상품 유형 개념 정의

| 유형 | 코드명 | 포함 요소 | 특징 |
|------|--------|-----------|------|
| 항공권 | `FLIGHT` | 항공편만 | 편도/왕복/오픈조 |
| 호텔 | `HOTEL` | 숙박만 | 날짜별 객실 단가 |
| 에어텔 | `AIRTEL` | 항공 + 호텔 묶음 | 여행사 자체 조합 상품 |
| 패키지 | `PACKAGE` | 항공 + 호텔 + 일정 + 가이드 | 완전 패키지, 취소 조건 중요 |

---

### 1-2. 항공권 (FlightProduct)

```typescript
interface FlightProduct extends BaseProduct {
  productType: 'FLIGHT';
  flightDetail: {
    tripType: 'ONE_WAY' | 'ROUND_TRIP' | 'OPEN_JAW';  // 편도 / 왕복 / 오픈조
    outbound: FlightSegment;          // 출발 구간
    inbound?: FlightSegment;          // 귀국 구간 (왕복/오픈조)
    airline: string;                  // 대한항공, 아시아나, 제주항공...
    allianceCode?: string;            // Star Alliance, SkyTeam...
    fareClass: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
    baggage: {
      carry: number;                  // 기내 수하물 (kg)
      checked: number;                // 위탁 수하물 (kg), 0이면 미포함
    };
    isRefundable: boolean;
    changeFee?: number;               // 변경 수수료 (원)
    stopoverCount: number;            // 직항: 0, 경유 횟수
  };
}

interface FlightSegment {
  departureAirport: string;           // ICN, GMP...
  arrivalAirport: string;
  departureAt: string;                // ISO 8601
  arrivalAt: string;
  flightNumber: string;               // KE001
  durationMinutes: number;
}
```

**핵심 가격 속성:**
- `normalizedPrice` = 1인 편도 기준 환산가 (왕복이면 ÷2)
- 유류할증료 + 공항세 포함 여부를 `isTaxIncluded` 플래그로 명시

---

### 1-3. 호텔 (HotelProduct)

```typescript
interface HotelProduct extends BaseProduct {
  productType: 'HOTEL';
  hotelDetail: {
    hotelName: string;
    starRating: 1 | 2 | 3 | 4 | 5;
    reviewScore: number;              // 0~10 (Booking.com 기준 통일)
    reviewCount: number;
    location: {
      address: string;
      distanceFromCenter: number;     // km
      nearbyLandmark?: string;        // "시내 중심 도보 5분"
    };
    roomType: string;                 // Deluxe Double, Superior Twin...
    bedType: string;                  // King, Twin, Double
    maxOccupancy: number;
    checkIn: string;                  // "YYYY-MM-DD"
    checkOut: string;
    nights: number;
    breakfast: 'INCLUDED' | 'OPTIONAL' | 'NOT_AVAILABLE';
    cancellationPolicy: {
      type: 'FREE' | 'PARTIAL' | 'NON_REFUNDABLE';
      freeCancelUntil?: string;       // ISO 8601
      penaltyAmount?: number;
    };
  };
}
```

**핵심 가격 속성:**
- `normalizedPrice` = 1박 1인 기준 환산가
- `totalPrice` = 전체 숙박 합계 (세금/리조트피 포함 여부 명시)

---

### 1-4. 에어텔 (AirtelProduct)

```typescript
interface AirtelProduct extends BaseProduct {
  productType: 'AIRTEL';
  airtelDetail: {
    provider: string;                 // 하나투어, 모두투어...
    productCode: string;              // 여행사 내부 상품 코드
    outboundFlight: FlightSegment;
    inboundFlight?: FlightSegment;
    hotel: {
      name: string;
      starRating: number;
      nights: number;
      roomType: string;
      breakfast: string;
    };
    isFlightChangeable: boolean;      // 항공편 변경 가능 여부
    isHotelChangeable: boolean;       // 호텔 업그레이드 가능 여부
    includedItems: string[];          // ["공항픽업", "유심"] 등
    excludedItems: string[];          // ["여행자보험", "옵션투어"] 등
    minPax: number;                   // 최소 출발 인원
    departureGuaranteed: boolean;     // 출발 확정 여부
  };
}
```

**핵심 가격 속성:**
- `normalizedPrice` = 1인 기준 에어텔 총액
- 항공 단품 + 호텔 단품 합산 대비 절감액 자동 계산 → `savingVsSeparate`

---

### 1-5. 패키지 (PackageProduct)

```typescript
interface PackageProduct extends BaseProduct {
  productType: 'PACKAGE';
  packageDetail: {
    provider: string;
    productCode: string;
    duration: {
      nights: number;
      days: number;                   // 3박 4일
    };
    itinerary: ItineraryDay[];        // 일자별 일정
    guide: {
      isIncluded: boolean;
      language: string;               // "한국어", "영어"
      isLocalGuide: boolean;
    };
    transportation: {
      inbound: boolean;               // 현지 교통 포함 여부
      type: string[];                 // ["전용 버스", "케이블카"]
    };
    meals: {
      breakfast: number;              // 포함 횟수
      lunch: number;
      dinner: number;
    };
    minPax: number;
    maxPax: number;
    departureGuaranteed: boolean;
    cancellationPolicy: CancellationPolicy;
    optionalTours: OptionalTour[];
  };
}

interface ItineraryDay {
  day: number;
  title: string;                      // "파리 시내 관광"
  highlights: string[];               // ["에펠탑", "루브르 박물관"]
  hotel: string;
}
```

---

### 1-6. 통합 정규화 모델 (BaseProduct + NormalizedPrice)

모든 상품 유형이 공유하는 기반 구조. 가격 비교는 반드시 `normalizedPrice`를 기준으로 합니다.

```typescript
interface BaseProduct {
  _id: string;
  productType: ProductType;
  destination: {
    country: string;                  // "일본"
    city: string;                     // "오사카"
    airportCode: string;              // "KIX"
  };
  origin: {
    city: string;                     // "서울"
    airportCode: string;              // "ICN" | "GMP"
  };
  travelPeriod: {
    startDate: string;                // "YYYY-MM-DD"
    endDate: string;
    nights: number;
  };
  paxInfo: {
    adults: number;
    children: number;                 // 만 2~11세
    infants: number;                  // 만 2세 미만
  };
  pricing: ProductPricing;
  source: DataSource;
  fetchedAt: string;                  // 가격 수집 시각
  deepLinkUrl: string;                // 예약 페이지 직링크
  isSoldOut: boolean;
  lastAvailableSeats?: number;        // 잔여 좌석/객실 수
}

interface ProductPricing {
  totalPrice: number;                 // 실제 결제 예정 총액 (원)
  normalizedPrice: number;           // [핵심] 1인 1박 기준 환산가 (원)
  currency: string;                   // "KRW"
  isTaxIncluded: boolean;
  taxAmount?: number;
  discountRate?: number;              // 할인율 (%)
  originalPrice?: number;            // 정가
  pricePerPerson: number;            // 1인 기준 총액
  savingVsSeparate?: number;         // 에어텔/패키지: 개별 구매 대비 절감액
}

interface DataSource {
  provider: string;                   // "스카이스캐너"
  apiName: string;                    // "SKYSCANNER_LIVE"
  externalProductId: string;
  affiliateCode?: string;
}

type ProductType = 'FLIGHT' | 'HOTEL' | 'AIRTEL' | 'PACKAGE';
```

---

### 1-7. 항공사 프로모션 (AirlinePromotion) _(v2.1 신규)_

항공사가 자체 발행하는 프로모션은 `BaseProduct`를 상속하지 않는 별도 엔티티로 관리합니다.
OTA(Skyscanner, Amadeus 등)를 통한 일반 가격 수집과 달리, 항공사 공식 채널에서만 공표되는 한정 특가 정보를 독립적으로 추적하기 위함입니다.

```typescript
type AirlinePromotionType =
  | 'EARLY_BIRD'        // 얼리버드: 출발 수개월 전 한정 특가
  | 'FLASH_SALE'        // 타임세일: 24~72시간 한정 특가
  | 'MILEAGE_BONUS'     // 마일리지 프로모션: 적립 보너스 기간
  | 'SEASONAL'          // 시즌 프로모션: 황금연휴·방학 등 특정 시즌 노선 특가
  | 'NEW_ROUTE'         // 신규 노선 취항 특가
  | 'LAST_MINUTE';      // 라스트미닛: 출발 임박 빈 좌석 땡처리

interface AirlinePromotion {
  _id: string;

  // --- 프로모션 기본 정보 ---
  promotionType: AirlinePromotionType;
  airlineCode: string;                  // "KE" (대한항공), "OZ", "7C", "LJ", "TW", "BX"
  airlineName: string;                  // "대한항공"
  title: string;                        // "대한항공 오사카 타임세일 – 최대 40% 할인"
  description?: string;

  // --- 적용 노선 ---
  routes: Array<{
    origin: string;                     // 출발 공항코드 "ICN"
    destination: string;                // 도착 공항코드 "KIX"
    tripType: 'ONE_WAY' | 'ROUND_TRIP' | 'BOTH';
  }>;

  // --- 프로모션 가격 ---
  pricing: {
    promotionPrice: number;             // 프로모션 적용가 (원, 최저가 기준)
    originalPrice?: number;             // 정상가
    discountRate?: number;              // 할인율 (%)
    currency: string;                   // "KRW"
    isTaxIncluded: boolean;
    fareClass: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  };

  // --- 유효 기간 ---
  saleWindow: {
    startAt: string;                    // 판매 시작 (ISO 8601)
    endAt: string;                      // 판매 종료
    travelPeriod?: {                    // 적용 여행 기간 (null이면 제한 없음)
      startDate: string;
      endDate: string;
    };
  };

  // --- 긴급도 메타데이터 ---
  urgency: {
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    // CRITICAL: 타임세일(24h 이내), 라스트미닛, 잔여 좌석 5석 이하
    // HIGH:     타임세일(24~72h), 마감 D-3 이내
    // MEDIUM:   얼리버드 D-7 이내, 시즌 프로모션
    // LOW:      일반 얼리버드, 마일리지 보너스
    remainingSeats?: number;
    expiresInHours?: number;            // 판매 종료까지 남은 시간
  };

  // --- 마일리지 정보 (MILEAGE_BONUS 유형 전용) ---
  mileageBonus?: {
    bonusRate: number;                  // 추가 적립 배율 (예: 2 = 2배 적립)
    eligiblePrograms: string[];         // ["SKYPASS", "ASIANA CLUB"]
  };

  // --- 수집 메타데이터 ---
  source: {
    collectionMethod: 'OFFICIAL_API' | 'WEB_MONITORING' | 'RSS_FEED' | 'EMAIL_PARSING';
    sourceUrl: string;                  // 원본 프로모션 URL
    deepLinkUrl: string;                // 예약 직링크
    fetchedAt: string;
  };

  // --- 데이터 품질 메타데이터 (v2.2 신규) ---
  // LCC 이메일/웹 수집 데이터의 신뢰도 추적용
  dataQuality?: {
    confidenceScore: number;            // 0~1 (NDC=1.0, 이메일=0.92, 웹=0.85)
    requiresVerification: boolean;      // 비API 소스는 true
    lastVerifiedAt?: string;            // 예약 페이지 접근으로 가격 검증 시각
  };

  isActive: boolean;
  isSoldOut: boolean;
}
```

**`AirlinePromotion`과 `BaseProduct`의 관계:**

`AirlinePromotion`은 가격 정보 수집 경로가 다르므로 독립 엔티티로 분리하되,
실제 예약 가능 여부가 확인된 항공편에 대해서는 `FlightProduct`를 파생 생성하여
`normalizedPrice` 기반 통합 비교 파이프라인에 편입시킵니다.

```
AirlinePromotion (원천 데이터)
       ↓ 예약 가능 확인 시
FlightProduct (normalizedPrice 계산 완료)
       ↓
통합 비교 엔진 + WatchItem 매칭
```

---

**정규화 계산 공식:**

```
normalizedPrice = totalPrice / (nights * totalPax)

예시:
- 항공권 왕복 200,000원 (1인, 5박 기준) → 200,000 / (5 * 1) = 40,000원/박/인
- 호텔 3박 150,000원 (2인) → 150,000 / (3 * 2) = 25,000원/박/인
- 에어텔 5박 800,000원 (2인) → 800,000 / (5 * 2) = 80,000원/박/인
- 패키지 4박5일 1,200,000원 (2인) → 1,200,000 / (4 * 2) = 150,000원/박/인
```

이 방식으로 상품 유형이 달라도 단일 숫자로 비교 가능합니다.

---

## 2. 관심 여행지 등록 UX 상세

### 2-1. 등록 플로우 (3단계 스텝 UI)

```
[Step 1: 여행지 선택]
→ [Step 2: 여행 조건 입력]
→ [Step 3: 관심 상품 유형 선택]
→ 등록 완료
```

---

### 2-2. Step 1: 여행지 선택

| 필드 | 타입 | 설명 | 필수 |
|------|------|------|------|
| destination | 검색 자동완성 | 도시 또는 국가 입력 ("오사카", "유럽") | Y |
| departureCity | 선택 | 출발지 (기본값: 내 위치 기반 자동 설정) | Y |

**UX 고려사항:**
- "어디든"(Any Destination) 옵션 제공 → 국내 최저가 여행지 자동 탐색 모드
- 도시/국가/공항코드 모두 입력 허용, 내부에서 IATA 코드로 정규화
- 최근 검색 여행지 3개 빠른 선택 버튼

---

### 2-3. Step 2: 여행 조건 입력

#### 공통 필드

| 필드명 | UI 컴포넌트 | 입력 방식 | 필수 |
|--------|------------|-----------|------|
| wishMonth | 월 멀티셀렉터 | 1~12월 중 복수 선택 (예: 6월, 7월) | Y |
| flexibleDates | 슬라이더 | "±N일 유연성" (0~7일) | N |
| duration | 범위 슬라이더 | 최소~최대 여행 기간 (1~30박) | Y |
| adults | 숫자 스피너 | 성인 인원 (1~9) | Y |
| children | 숫자 스피너 | 아동 인원 (0~6) | N |
| budgetMax | 예산 슬라이더 | 1인 총예산 상한 (단위: 만원) | N |
| budgetFlexible | 토글 | "예산 초과해도 좋은 딜은 알려줘" | N |

#### 유형별 추가 조건 (Step 3에서 유형 선택 후 노출)

**항공권 전용 조건:**

| 필드명 | 설명 |
|--------|------|
| tripType | 편도 / 왕복 / 오픈조 선택 |
| preferredAirline | 선호 항공사 (복수 선택, 미선택시 전체) |
| fareClass | 좌석 등급 (이코노미/비즈니스 등) |
| maxStopover | 최대 경유 허용 횟수 (0=직항만) |
| departureTimeRange | 선호 출발 시간대 (새벽/오전/오후/저녁) |
| checkedBaggageRequired | 수하물 포함 필수 여부 |

**호텔 전용 조건:**

| 필드명 | 설명 |
|--------|------|
| minStarRating | 최소 호텔 등급 (1~5성) |
| minReviewScore | 최소 리뷰 점수 (0~10) |
| breakfastIncluded | 조식 포함 필수 여부 |
| freeCancellationOnly | 무료 취소 가능 상품만 |
| preferredArea | 선호 지역/구역 (시내 중심, 해변 등) |

**에어텔 전용 조건:**

| 필드명 | 설명 |
|--------|------|
| preferredProviders | 선호 여행사 (복수 선택) |
| hotelMinStar | 에어텔 내 호텔 최소 등급 |
| departureGuaranteedOnly | 출발 확정 상품만 |
| isFlightChangeable | 항공편 변경 가능 상품 선호 |

**패키지 전용 조건:**

| 필드명 | 설명 |
|--------|------|
| guideRequired | 가이드 포함 필수 여부 |
| guideLanguage | 선호 가이드 언어 |
| mealIncluded | 식사 포함 횟수 최소값 |
| maxGroupSize | 최대 단체 인원 선호 |
| freeCancellationDays | 무료 취소 가능 기간 (출발 N일 전) |

---

### 2-4. Step 3: 관심 상품 유형 선택

```
┌─────────────────────────────────────────────────────┐
│  어떤 상품 유형을 모니터링할까요? (복수 선택 가능)      │
│                                                      │
│  [✓] 항공권    [✓] 호텔    [✓] 에어텔    [✓] 패키지   │
│                                                      │
│  추천: 에어텔 + 항공권 + 호텔을 함께 비교하면         │
│  최적의 조합을 찾을 수 있어요.                        │
└─────────────────────────────────────────────────────┘
```

**알림 임계값 설정 (유형별):**

| 유형 | 기본 알림 조건 |
|------|--------------|
| 항공권 | 등록 시점 대비 10% 이상 하락 또는 역대 최저가 |
| 호텔 | 등록 시점 대비 15% 이상 하락 |
| 에어텔 | 등록 시점 대비 8% 이상 하락 (절대금액 3만원 이상) |
| 패키지 | 얼리버드 특가 출시 또는 등록가 대비 10% 하락 |

사용자가 직접 임계값 커스터마이징 가능 (고급 설정 펼침 UI).

---

## 3. 자동 탐색·추천 로직

### 3-1. 백그라운드 모니터링 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                      모니터링 파이프라인                        │
│                                                              │
│  WatchItem DB                                                │
│       ↓ (스케줄러 트리거)                                      │
│  Watch Job Queue (Bull MQ / Redis)                           │
│       ↓                                                      │
│  상품 유형별 Worker                                           │
│  ├── FlightWorker  → 스카이스캐너/아마데우스 API              │
│  ├── HotelWorker   → Booking.com/Agoda API                   │
│  ├── AirtelWorker  → 하나투어/모두투어 크롤러                  │
│  └── PackageWorker → 여행사 API/크롤러                        │
│       ↓                                                      │
│  PriceHistory DB (시계열 저장)                                │
│       ↓                                                      │
│  가격 분석 엔진 (이상값 탐지 + 추천 판단)                       │
│       ↓                                                      │
│  알림 발송 서비스 (FCM / APNs / 이메일)                        │
└──────────────────────────────────────────────────────────────┘
```

---

### 3-2. 모니터링 주기 설정

출발일까지 남은 기간에 따라 동적으로 조정합니다.

| 잔여 기간 | 항공권 | 호텔 | 에어텔/패키지 |
|---------|--------|------|-------------|
| D-180 이상 | 1회/일 | 1회/일 | 1회/2일 |
| D-90 ~ D-180 | 2회/일 | 2회/일 | 1회/일 |
| D-30 ~ D-90 | 4회/일 | 3회/일 | 2회/일 |
| D-7 ~ D-30 | 8회/일 | 6회/일 | 4회/일 |
| D-7 이내 | 실시간(30분) | 12회/일 | 8회/일 |

**이유:** 항공권은 출발 임박 시 가격 급변동, 호텔은 당일 취소 물량 노출, 패키지는 출발 확정 공지 시점 모니터링이 핵심.

---

### 3-3. 4가지 유형 통합 비교 로직

```typescript
// 통합 비교 엔진 의사코드
function buildUnifiedComparison(watchItemId: string): ComparisonResult {
  const watchItem = getWatchItem(watchItemId);

  // 각 유형별 현재 최저가 수집
  const flightMin    = getMinPrice('FLIGHT', watchItem);
  const hotelMin     = getMinPrice('HOTEL', watchItem);
  const airtelMin    = getMinPrice('AIRTEL', watchItem);
  const packageMin   = getMinPrice('PACKAGE', watchItem);

  // 에어텔 vs 항공+호텔 분리 구매 비교
  const separateCost = flightMin.normalizedPrice + hotelMin.normalizedPrice;
  const airtelCost   = airtelMin.normalizedPrice;
  const saving       = separateCost - airtelCost;  // 양수면 에어텔이 유리

  // 통합 랭킹 산출 (normalizedPrice 기준)
  const ranked = [
    { type: 'FLIGHT+HOTEL', price: separateCost, products: [flightMin, hotelMin] },
    { type: 'AIRTEL',       price: airtelCost,   products: [airtelMin] },
    { type: 'PACKAGE',      price: packageMin.normalizedPrice, products: [packageMin] },
  ].sort((a, b) => a.price - b.price);

  return {
    ranked,
    recommendation: ranked[0],        // 현재 가장 저렴한 조합
    saving,
    lastUpdated: new Date().toISOString(),
  };
}
```

---

### 3-4. "지금 예약하기 좋은 타이밍" 판단 기준

5가지 신호를 종합 점수화(0~100점)하여 `BookingScore`를 산출합니다.

| 신호 | 가중치 | 판단 기준 |
|------|--------|-----------|
| 역대 최저가 여부 | 30점 | 최근 90일 수집 데이터 대비 하위 10% |
| 가격 하락 추세 | 20점 | 7일 이동평균선 하향 돌파 |
| 잔여 좌석/객실 희소성 | 20점 | 잔여 5석 이하 또는 객실 3개 이하 |
| 출발 최적 예약 시점 | 15점 | 항공권: 출발 6~8주 전 / 호텔: 3~4주 전 |
| 계절성 가격 패턴 | 15점 | 전년 동기 대비 저렴 여부 |

```
BookingScore 해석:
80~100점 → "지금이 최적 타이밍입니다" (강력 추천 배지)
60~79점  → "괜찮은 시점입니다" (추천 배지)
40~59점  → "조금 더 기다려볼 수 있어요"
0~39점   → "아직 기다리는 것이 유리합니다"
```

---

## 4. 추천 결과 화면 설계

### 4-1. 전체 화면 구조

```
┌─────────────────────────────────────────────────────┐
│  오사카 · 2026년 7월 · 5박 · 성인 2명               │
│  [수정]                                              │
├─────────────────────────────────────────────────────┤
│  [전체 비교] [항공권] [호텔] [에어텔] [패키지]         │
├─────────────────────────────────────────────────────┤
│  ★ AI 추천                                           │
│  "에어텔이 항공+호텔 따로보다 1인당 42,000원 저렴해요"  │
│  BookingScore: 74점 — 괜찮은 시점입니다              │
├─────────────────────────────────────────────────────┤
│  [상품 카드 목록]                                     │
└─────────────────────────────────────────────────────┘
```

---

### 4-2. 탭 구조 상세

**[전체 비교] 탭 — 통합 뷰**

유형별 최저가를 한눈에 비교하는 요약 카드 4개 + 상세 리스트:

```
┌──────────┬──────────┬──────────┬──────────┐
│  항공권   │  호텔    │  에어텔  │  패키지  │
│  최저가   │  최저가  │  최저가  │  최저가  │
│ 178,000원 │ 89,000원 │ 245,000원│ 480,000원│
│ (1인 편도)│ (1박 1인)│ (1인 총) │ (1인 총) │
└──────────┴──────────┴──────────┴──────────┘

항공+호텔 따로: 1인 총 534,000원
에어텔:        1인 총 245,000원  ← 289,000원 절약!
패키지:        1인 총 480,000원
```

---

### 4-3. 상품 카드 디자인 (유형별)

**항공권 카드:**

```
┌─────────────────────────────────────────────────┐
│ [대한항공 로고]  KE001 · 직항                    │
│                                                  │
│ ICN 09:30  ──────────────►  KIX 11:40           │
│                   2시간 10분                      │
│                                                  │
│ 수하물: 23kg 포함 · 이코노미                      │
│ 무료 취소: 출발 24시간 전까지                     │
│                                        [왕복기준] │
│                              1인  ₩178,000        │
│  BookingScore ●●●●○ 74점    [지금 예약하기]       │
└─────────────────────────────────────────────────┘
```

**호텔 카드:**

```
┌─────────────────────────────────────────────────┐
│ [호텔 이미지]  도톤보리 크로스 호텔 ★★★★         │
│               리뷰 8.6 / 10  (2,341개)           │
│                                                  │
│ 시내 중심 도보 3분 · 조식 포함                    │
│ 2026.07.15 ~ 07.20 (5박)                        │
│ Deluxe Double · 무료 취소 7/10까지               │
│                                                  │
│ 2인 5박 총 ₩490,000  (1박 1인 ₩49,000)           │
│  BookingScore ●●●●● 85점    [지금 예약하기]       │
└─────────────────────────────────────────────────┘
```

**에어텔 카드:**

```
┌─────────────────────────────────────────────────┐
│ [하나투어]  오사카 에어텔 BEST                    │
│              출발 확정 완료                       │
│                                                  │
│ ✈ ICN→KIX  LJ201 07/15 10:00 (직항)             │
│ ✈ KIX→ICN  LJ202 07/20 14:00 (직항)             │
│ 🏨 난바 그랜드호텔 ★★★★ (4박)  조식 포함          │
│                                                  │
│ 항공+호텔 따로 시 ₩534,000  →  절약 ₩99,000       │
│ 1인 총 ₩435,000                                  │
│  BookingScore ●●●●○ 74점    [상세보기]            │
└─────────────────────────────────────────────────┘
```

**패키지 카드:**

```
┌─────────────────────────────────────────────────┐
│ [모두투어]  오사카·교토·나라 5박6일               │
│              한국어 가이드 동행                   │
│                                                  │
│ 07/15 출발 · 최대 20명 · 잔여 8석                │
│ 식사: 조식 4회, 석식 2회 포함                    │
│ 포함: 전용버스, 입장권 일체                       │
│ 미포함: 옵션투어, 여행자보험                      │
│                                                  │
│ 1인 총 ₩1,280,000 (2인 기준)                     │
│  BookingScore ●●○○○ 41점    [상세보기]            │
└─────────────────────────────────────────────────┘
```

---

### 4-4. "에어텔 vs 패키지 vs 항공+호텔 따로" 비교 뷰

전체 비교 탭 하단에 고정 노출되는 비교 테이블:

| 항목 | 항공+호텔 따로 | 에어텔 | 패키지 |
|------|--------------|--------|--------|
| 1인 총 비용 | 534,000원 | 435,000원 | 1,280,000원 |
| 자유도 | 최상 | 높음 | 낮음 |
| 일정 유연성 | 완전 자유 | 항공편 고정 | 전일정 고정 |
| 가이드 | 없음 | 없음 | 한국어 가이드 |
| 식사 | 직접 해결 | 조식만 | 조식4+석식2 |
| 취소 편의성 | 각각 취소 | 하나로 취소 | 위약금 발생 |
| 적합 대상 | 자유여행 선호 | 가성비 자유여행 | 편한 여행 선호 |

---

## 5. 외부 API 연동 소스 (유형별)

### 5-1. 항공권 API

| 소스 | API명 | 방식 | 비고 |
|------|-------|------|------|
| Skyscanner | Flights Live Prices API v3 | REST | 글로벌 최저가 집계에 가장 강력 |
| Amadeus | Flight Offers Search API | REST | IATA 공식, 실시간 GDS 데이터 |
| 네이버 항공 | 파트너 API (제휴 필요) | REST | 국내 사용자 점유율 1위 |
| 카약 (Kayak) | Affiliate API | REST | 글로벌 OTA 비교 |
| 에어프레미아/제주항공 | 항공사 직접 API | REST | LCC 직접 연동으로 최저가 확보 |

**우선 연동 순서:** Amadeus → Skyscanner → 네이버 항공

**폴백 전략:** Amadeus 실패 시 Skyscanner로 자동 전환, 양쪽 모두 실패 시 캐시된 마지막 유효 데이터 사용 (최대 6시간 이내)

---

#### 5-1-0. OTA(스카이스캐너·아마데우스)의 국내 LCC 커버리지 분석 _(v2.2 신규)_

OTA API만으로 LCC 가격을 충분히 수집할 수 있는지 여부를 항공사별로 분석합니다.
**결론: OTA 커버리지에 구조적 공백이 존재하며, LCC 직접 수집 레이어가 필수입니다.**

| 항공사 | Amadeus GDS 수록 | Skyscanner 수록 | OTA 공백 유형 | 직접 수집 필요도 |
|--------|----------------|----------------|-------------|--------------|
| 제주항공 (7C) | 부분적 (일부 노선만) | 수록됨 | 프로모션 전용 특가(Promo Fare) OTA 미노출 | 높음 |
| 진에어 (LJ) | 부분적 | 수록됨 | 동일 | 높음 |
| 티웨이항공 (TW) | 부분적 | 수록됨 | 동일 | 높음 |
| 에어부산 (BX) | 부분적 | 수록됨 | 동일 | 높음 |
| 에어서울 (RS) | 미수록 (2026년 현재) | 미수록 | 전체 미수록 | 매우 높음 |
| 에어프레미아 (YP) | 미수록 | 부분 수록 | 중장거리 LCC 특수 구조 | 높음 |
| 대한항공 (KE) | 완전 수록 | 완전 수록 | 없음 | 낮음 (NDC 프로모션만) |
| 아시아나항공 (OZ) | 완전 수록 | 완전 수록 | 없음 | 낮음 (프로모션만) |

**OTA 공백의 원인:**

```
1. LCC 직배 구조 (Direct Distribution)
   - 국내 LCC 대부분은 자사 웹/앱을 통한 직접 판매 비율이 70~80%
   - GDS(글로벌 유통 시스템) 수록을 의도적으로 제한하거나 축소
   - 이유: GDS 수록 수수료(편당 USD 3~6) 절감 전략

2. 프로모션 전용 운임 (Promotional Fare)
   - LCC의 타임세일·얼리버드 특가는 GDS에 올리지 않고 자사 채널 독점 판매
   - Skyscanner가 LCC 요금을 보여줄 때는 '일반 공시 운임(Published Fare)' 기준
   - 실제 최저가(프로모션가)는 OTA 대비 20~60% 저렴할 수 있음

3. 에어서울·에어프레미아 특수 상황
   - 에어서울: 아시아나항공 자회사지만 독자 배포 시스템 사용, GDS 미등재
   - 에어프레미아: 중장거리 LCC 신생 항공사, GDS 등재 초기 단계
```

**실질적 영향:**

```
스카이스캐너로 검색한 "ICN→KIX 최저가"는
제주항공 공시 운임(168,000원)을 보여주지만,
동일 시점 jejuair.net의 타임세일가는 89,000원일 수 있음.

→ OTA만 의존 시 사용자는 실제 최저가 대비 2배 가격에 예약하게 됨.
→ LCC 직접 수집 레이어 없이는 핵심 가치 제안 불가능.
```

---

### 5-1-1. 항공사 자체 프로모션 채널 _(v2.2 전면 개편)_

OTA API 외에 항공사 공식 채널을 별도 수집 레이어로 운영합니다.
OTA는 항공사 프로모션을 수시간 지연하여 반영하거나 아예 반영하지 않는 경우가 많아 직접 수집이 필수입니다.

---

#### A. 국내 항공사별 수집 전략 상세

##### 대한항공 (KE) — FSC, GDS 완전 수록

| 항목 | 내용 |
|------|------|
| 공식 API | NDC API 제공 (파트너십 신청 필요, 검토 기간 4~8주) |
| Affiliate 프로그램 | KAL 항공권 판매 제휴 (CPA 기반, 별도 계약) |
| RSS/이메일 | KAL e-뉴스레터 파싱 (월 2~4회 발송), SKYPASS 회원 이메일 |
| 웹 모니터링 | koreanair.com/kr/ko/deals 특가 페이지 |
| 프로모션 주기 | 월 1~2회 정기 얼리버드 + 수시 타임세일 (화요일~목요일 오전 집중) |
| **권장 전략** | NDC API 파트너십 신청 (최우선) + 이메일 파싱 병행 |

##### 아시아나항공 (OZ) — FSC, GDS 완전 수록

| 항목 | 내용 |
|------|------|
| 공식 API | GDS(Amadeus/Sabre) 경유 수집 가능, 별도 직접 API 없음 |
| Affiliate 프로그램 | 아시아나 항공권 판매 제휴 (CPA 기반) |
| RSS/이메일 | 아시아나클럽 이메일 (월 2~3회), flyasiana.com 뉴스레터 |
| 웹 모니터링 | flyasiana.com/C/KR/ko/airport/specialFare 특가 페이지 |
| 프로모션 주기 | 월 1~2회 정기 + 비정기 타임세일 |
| **권장 전략** | Amadeus API로 기본 수집 + 이메일 파싱으로 프로모션 탐지 |

##### 제주항공 (7C) — LCC, GDS 부분 수록

| 항목 | 내용 |
|------|------|
| 공식 API | 직접 공개 API 없음. 파트너십 문의 시 B2B 전용 API 협의 가능성 있음 |
| Affiliate 프로그램 | 네이버 항공, 인터파크 등 통한 간접 제휴. 직접 Affiliate 미운영 |
| RSS | 없음 |
| 이메일 | 제주항공 공식 뉴스레터 (주 1~2회, 목/금 오전 발송 패턴) |
| 웹 모니터링 대상 | jejuair.net/jj/kr/timetable/TimeTable.html (프로모션 운임 포함) |
| 카카오 | 제주항공 공식 카카오 채널 (프로모션 발표 즉시 알림톡 발송) |
| 프로모션 패턴 | 화요일 오후 2시~4시 타임세일 집중 발표. 48~72시간 판매 기간 |
| **권장 전략** | 이메일 파싱 (주력) + 웹 모니터링 (보조) + 카카오 채널 수신 |

##### 진에어 (LJ) — LCC, GDS 부분 수록

| 항목 | 내용 |
|------|------|
| 공식 API | 없음. 대한항공 계열이나 NDC 연동 비대상 |
| Affiliate 프로그램 | 없음 |
| RSS | 없음 |
| 이메일 | 진에어 뉴스레터 (월 2~4회, 불규칙) |
| 웹 모니터링 대상 | jinair.com/KOR/event/eventList.html (이벤트/프로모션 목록) |
| 공식 SNS | 인스타그램·페이스북 프로모션 발표 채널 (웹훅 모니터링 불가, 이메일 파싱으로 대체) |
| 프로모션 패턴 | 비정기. 성수기 전 6~8주 얼리버드 집중. 목~금 오전 발표 패턴 |
| **권장 전략** | 이메일 파싱 (주력) + 웹 모니터링 (이벤트 페이지) |

##### 티웨이항공 (TW) — LCC, GDS 부분 수록

| 항목 | 내용 |
|------|------|
| 공식 API | 없음 |
| Affiliate 프로그램 | 없음 |
| RSS | 없음 |
| 이메일 | 티웨이 멤버십 이메일 (월 2~3회) |
| 웹 모니터링 대상 | twayair.com/app/promotion/main (프로모션 전용 페이지) |
| 앱 | 공식 앱 푸시 알림 (수집 불가, 이메일로 대체) |
| 프로모션 패턴 | 월 2~3회 정기 프로모션 + 비정기 타임세일. 수~목 발표 패턴 강함 |
| **권장 전략** | 이메일 파싱 (주력) + 웹 모니터링 |

##### 에어부산 (BX) — LCC, GDS 부분 수록

| 항목 | 내용 |
|------|------|
| 공식 API | 없음. 아시아나 계열이나 독자 시스템 사용 |
| Affiliate 프로그램 | 없음 |
| RSS | 없음 |
| 이메일 | 에어부산 뉴스레터 (주 1~2회, 목요일 오전 집중) |
| 웹 모니터링 대상 | airbusan.com/ko/promotion/list (프로모션 목록 페이지) |
| 프로모션 패턴 | 부산 출발 노선 특화. 주 1~2회 소규모 타임세일 빈번 |
| **권장 전략** | 이메일 파싱 (주력) + 웹 모니터링 |

##### 에어서울 (RS) — LCC, GDS 미수록

| 항목 | 내용 |
|------|------|
| 공식 API | 없음 |
| OTA 수록 | Skyscanner·Amadeus 모두 미수록 (2026년 현재). 자사 직판만 운영 |
| Affiliate 프로그램 | 없음 |
| RSS | 없음 |
| 이메일 | 에어서울 회원 이메일 (격주 수준, 목요일 발송 패턴) |
| 웹 모니터링 대상 | flyairseoul.com/CW/ko/promotion/eventList.html |
| 프로모션 패턴 | 주 1회 타임세일 빈번 (48시간 한정). 일본·동남아 단거리 특화 |
| **권장 전략** | 이메일 파싱 (필수, OTA 미수록으로 유일한 수집 경로) + 웹 모니터링 |
| **주의** | OTA로 에어서울 가격 수집 자체가 불가능하므로 직접 수집 없이는 서비스 불가 |

##### 에어프레미아 (YP) — LCC(중장거리), GDS 부분 수록

| 항목 | 내용 |
|------|------|
| 공식 API | 없음 (GDS 등재 진행 중) |
| OTA 수록 | Skyscanner 부분 수록. 프로모션 운임 미반영 |
| Affiliate 프로그램 | 없음 (2026년 현재) |
| RSS | 없음 |
| 이메일 | 에어프레미아 뉴스레터 (비정기, 이벤트 시 발송) |
| 웹 모니터링 대상 | airpremiausa.com/ko/promotion (프로모션 페이지) |
| 특이사항 | 인천-LA·뉴욕·방콕 등 중장거리 노선 특화. 일반 LCC와 다른 장거리 얼리버드 패턴 |
| 프로모션 패턴 | 월 1~2회 얼리버드 집중. 출발 3~6개월 전 특가 다수 |
| **권장 전략** | 이메일 파싱 (주력) + 웹 모니터링 |

---

#### B. LCC 특화 프로모션 패턴 분석 _(v2.2 신규)_

LCC의 프로모션 발행에는 공통 패턴이 있으며, 이를 모니터링 주기 설계에 반영합니다.

**발표 요일 패턴:**

```
국내 LCC 프로모션 발표 집중 시간대 (경험적 패턴):
- 화요일 오후 2시~4시: 제주항공 타임세일 집중
- 수요일~목요일 오전: 진에어·에어부산·에어서울 발표 패턴
- 금요일 오전: 주말 이후 여행 대상 타임세일 (당일~D+3 출발)
- 월요일: 주간 프로모션 발표 드물음 (쿨다운 기간)
```

**프로모션 유형별 리드타임:**

| 유형 | 발표 시점 | 판매 기간 | 적용 출발 기간 |
|------|---------|---------|------------|
| 타임세일 (FLASH_SALE) | 수시 | 24~72시간 | 발표 후 1~12주 이내 출발 |
| 얼리버드 (EARLY_BIRD) | 출발 8~16주 전 | 1~2주 | 발표 후 2~6개월 이내 출발 |
| 라스트미닛 (LAST_MINUTE) | 출발 3~7일 전 | 24~48시간 | 즉시 출발 |
| 시즌 프로모션 (SEASONAL) | 성수기 전 8~12주 | 2~4주 | 황금연휴·방학 시즌 |
| 신규 취항 (NEW_ROUTE) | 취항 발표일 | 1~4주 | 취항 초기 3~6개월 |

**국내선 vs 국제선 차이:**

```
국내선 (김포/김해/제주 등):
- 타임세일 빈도: 매우 높음 (주 2~3회)
- 최저가 수준: 9,900원~29,000원 (편도, 공항세 별도)
- 판매 기간: 24~48시간으로 짧음
- OTA 미반영률: 약 80% (국내선은 GDS 우회가 더 강함)

국제선 (일본·동남아·중국 등):
- 타임세일 빈도: 주 0~1회
- 최저가 수준: 69,000원~149,000원 (왕복, 세금 미포함)
- 판매 기간: 48~72시간
- OTA 미반영률: 약 50~60%
```

**모니터링 주기 조정 (LCC 특화):**

기존 모니터링 주기(섹션 3-2)에 LCC 프로모션 전용 레이어를 추가합니다.

| 모니터링 대상 | 기존 주기 | LCC 최적화 주기 | 이유 |
|------------|--------|--------------|------|
| LCC 이메일 파싱 | 수신 즉시 | 수신 즉시 (변경 없음) | Push 방식이라 실시간 가능 |
| LCC 프로모션 페이지 (타임세일 탐지용) | 1회/시간 | 15분마다 (화~금 오전 10시~오후 6시) | 발표 직후 매진 빈번 |
| LCC 프로모션 페이지 (야간/주말) | 1회/시간 | 1회/시간 (유지) | 야간 발표 드물어 불필요한 호출 감소 |
| LCC 일반 요금 페이지 | 4회/일 | 4회/일 (변경 없음) | 일반 요금은 변동 적음 |

---

#### C. 법적 리스크 재검토 및 현실적 해결 방안 _(v2.2 신규)_

기존 기획서의 "법무 검토 후 진행"을 실질적 기준으로 구체화합니다.

**웹 스크래핑 관련 국내 법적 기준:**

```
[저작권법 관점]
- 항공권 가격 정보(숫자)는 저작물에 해당하지 않음 (창작성 없는 사실적 정보)
- 단, 웹페이지 전체 구조·디자인을 복제하면 저작권법 위반 가능
- 가격·노선·날짜 등 사실 정보만 추출하는 방식은 저작권 문제 없음

[이용약관 관점]
- 이용약관 위반은 민사상 손해배상 청구 대상 (형사 처벌 아님)
- 국내 항공사들의 이용약관 스크래핑 금지 조항 실제 현황:
  · 제주항공: "영리 목적의 자동화된 데이터 수집 금지" 명시
  · 진에어: 유사 조항 있음
  · 에어부산: 유사 조항 있음
  · 에어서울: 명시적 금지 조항 미확인
  · 에어프레미아: 명시적 금지 조항 미확인
- 법원 판례: 이용약관 위반만으로 형사책임 없음. 민사상 청구는 실손해 입증 어려움.

[robots.txt 관점]
- robots.txt는 법적 구속력 없음 (기술적 신사협정)
- 다만 robots.txt 무시 + 서버 부하 유발 시 업무방해죄 적용 가능성
- 핵심 기준: "서버에 과도한 부하를 주는가"
```

**항공사별 robots.txt 수집 허용 현황:**

| 항공사 | robots.txt 내 스크래핑 | 실질적 허용 범위 | 대응 전략 |
|--------|---------------------|---------------|---------|
| 제주항공 | 일부 경로 Disallow | 프로모션 페이지: Allow | robots.txt 준수하면 법적 문제 없음 |
| 진에어 | 이벤트 페이지: Allow | 이벤트 페이지 수집 가능 | robots.txt 준수 |
| 티웨이항공 | 프로모션 페이지: Allow | 수집 가능 | robots.txt 준수 |
| 에어부산 | 프로모션 페이지: Allow | 수집 가능 | robots.txt 준수 |
| 에어서울 | 미확인 (정기 재확인 필요) | 보수적으로 1회/30분 이하 | Rate Limit 준수 |
| 에어프레미아 | 미확인 | 보수적으로 1회/30분 이하 | Rate Limit 준수 |

**합법적 수집을 위한 기술적 준수 기준:**

```typescript
// LCC 웹 모니터링 워커 준수 사항
const LCC_SCRAPING_RULES = {
  // 1. robots.txt 사전 확인 (워커 시작 시 매일 1회 갱신)
  respectRobotsTxt: true,

  // 2. Rate Limiting: 동일 도메인 요청 간 최소 간격
  minRequestIntervalMs: 5000,    // 5초 이상 간격 (일반적 서버 부하 기준)

  // 3. User-Agent 명시 (봇임을 숨기지 않음)
  userAgent: 'Tripping-Bot/1.0 (travel deal aggregator; contact@tripping.kr)',

  // 4. 수집 범위: 공개 프로모션 페이지만 (로그인 필요 페이지 제외)
  onlyPublicPages: true,

  // 5. 이미지·동영상 등 미디어 파일 다운로드 금지
  mediaDownload: false,

  // 6. 수집 데이터: 가격·노선·날짜·할인율 등 사실 정보만 추출
  dataTypes: ['price', 'route', 'date', 'discountRate', 'promotionTitle'],
};
```

**파트너십 없이 합법적으로 수집 가능한 방법 (우선순위):**

```
1순위: 이메일 파싱 (가장 안전)
   - 항공사 뉴스레터 구독은 누구나 가능한 공개 서비스
   - 수신한 이메일을 파싱하는 것은 법적 문제 없음
   - 단, 이메일 내용을 원문 그대로 재배포하면 저작권 문제 가능
   - 가격·날짜·노선 정보만 추출하여 구조화하는 것은 적법

2순위: 공개 RSS/Atom 피드 구독
   - 항공사가 제공하는 RSS는 수집을 명시적으로 허용한 것
   - 현재 국내 LCC는 RSS 미제공 (대한항공만 일부 제공)
   - 향후 제공 여부 주기적 확인 필요

3순위: 공개 프로모션 페이지 모니터링 (robots.txt 준수 + Rate Limit 준수)
   - 위 기술적 준수 기준 엄격히 적용
   - 수집 목적: 사실 정보 추출 (가격 비교·알림 서비스)
   - 월 1회 이상 이용약관 변경 여부 모니터링
   - 법무 리뷰: 서비스 론칭 전 이용약관 전문 검토 (1회성 검토로 충분)

4순위: B2B 파트너십 협의
   - 트래픽/사용자 수가 의미 있는 수준(MAU 1만명 이상) 도달 후 협의
   - 협의 대상: 제주항공 (국내 LCC 1위), 진에어 (2위)
   - 제공 가능 가치: 앱 내 딥링크 트래픽, 예약 전환 데이터

5순위: Affiliate 프로그램
   - 현재 국내 LCC는 직접 Affiliate 미운영
   - 네이버·인터파크 등 대형 제휴사 통한 간접 연결 가능
   - 수수료: 발권 금액의 1~3% 수준
```

---

### 5-2. 호텔 API

| 소스 | API명 | 방식 | 비고 |
|------|-------|------|------|
| Booking.com | Demand API v2 | REST | 전세계 재고 최다 |
| Agoda | YCS Partner API | REST | 아시아 지역 특화 |
| Expedia | EPS Rapid API | REST | 글로벌 커버리지 우수 |
| Hotels.com | 위 Expedia 계열 공유 | REST | Expedia Group 동일 재고 |
| 야놀자 | 파트너 API (제휴) | REST | 국내 + 동남아 특화 |

**우선 연동 순서:** Booking.com → Agoda → Expedia

**중복 제거:** 동일 호텔이 여러 소스에 있을 경우 `hotelChainCode + 위치 좌표` 기반 중복 제거 후 최저가만 노출.

---

### 5-3. 에어텔 API

| 소스 | 연동 방식 | 비고 |
|------|-----------|------|
| 하나투어 | 파트너 API + 딥링크 | 국내 1위 여행사, 상품 수 최다 |
| 모두투어 | 파트너 API + 딥링크 | 국내 2위, 에어텔 상품 풍부 |
| 인터파크 투어 | 파트너 API | 가격 경쟁력 높은 LCC 에어텔 다수 |
| 참좋은여행 | 스크래핑 (제휴 전까지) | 중소 여행사 중 에어텔 특화 |
| 노랑풍선 | 파트너 API | 동남아/일본 에어텔 강점 |

**스크래핑 주의:** 크롤링 시 robots.txt 준수 필수. 제휴 API 미확보 여행사는 법무 검토 후 진행.

---

### 5-4. 패키지 API

| 소스 | 연동 방식 | 비고 |
|------|-----------|------|
| 하나투어 | 패키지 상품 API | 국내 최다 패키지 라인업 |
| 모두투어 | 패키지 상품 API | 단독 상품 및 공동 기획 상품 |
| 롯데JTB | 파트너 API | 일본 패키지 특화 |
| 자유투어 | 파트너 API | 가성비 패키지 특화 |
| 여행박사 | 파트너 API | 직항 패키지 특화 |

---

### 5-5. 통합 API Gateway 구조

```
클라이언트
    ↓
API Gateway (bkend.ai 내 Edge Function)
    ├── /search/flights     → FlightAggregator
    │       ├── AmadeusClient
    │       └── SkyscannerClient
    ├── /search/hotels      → HotelAggregator
    │       ├── BookingComClient
    │       └── AgodaClient
    ├── /search/airtels     → AirtelAggregator
    │       ├── HanaTourClient
    │       └── ModuTourClient
    ├── /search/packages    → PackageAggregator
    │       ├── HanaTourPackageClient
    │       └── ModuTourPackageClient
    └── /promotions/airline → AirlinePromotionAggregator  ← v2.1 신규, v2.2 강화
            ├── [FSC 수집]
            │   ├── KoreanAirNdcClient     (대한항공 NDC API, 실시간)
            │   └── AsianaGdsClient        (아시아나 Amadeus 경유)
            └── [LCC 직접 수집] ← v2.2 신규
                ├── LccEmailParsingWorker  (7C/LJ/TW/BX/RS/YP 이메일 파싱)
                ├── LccWebMonitorWorker    (프로모션 페이지 모니터링)
                └── RawPromotionNormalizer (소스 무관 통합 정규화)
```

각 Aggregator는 다음을 담당:
1. 여러 소스 병렬 요청 (Promise.allSettled)
2. 응답 정규화 → BaseProduct 구조로 변환
3. 중복 제거 및 normalizedPrice 계산
4. PriceHistory DB에 결과 저장

**AirlinePromotionAggregator 추가 담당:**
5. `AirlinePromotion` 엔티티 생성 및 DB 저장
6. `urgency.level` 자동 산출 (판매 종료 시각 기준)
7. WatchItem 프로모션 매칭 잡 트리거
8. _(v2.2 추가)_ LCC 수집 데이터 신뢰도 검증 (가격 이상값 필터링)
9. _(v2.2 추가)_ 중복 프로모션 제거 (동일 프로모션 다중 소스 수집 시 고신뢰도 데이터 우선)

---

## 6. 알림 전략 고도화

### 6-1. 유형별 알림 차별화

| 유형 | 알림 타이밍 | 알림 메시지 톤 | 긴급도 |
|------|------------|--------------|--------|
| 항공권 | 가격 하락 + 잔여 좌석 5석 이하 | "지금 잡지 않으면 없어져요" | 매우 높음 |
| 호텔 | 무료 취소 기한 D-3 + 가격 하락 | "취소 가능한 지금 예약하세요" | 높음 |
| 에어텔 | 출발 확정 공지 + 가격 하락 | "출발 확정됐어요! 확인해보세요" | 높음 |
| 패키지 | 얼리버드 마감 D-7 + 잔여 5석 이하 | "마감 임박! 서두르세요" | 중간 |
| 항공사 타임세일 | 프로모션 감지 즉시 | "지금 딱 6시간! 대한항공 특가" | 긴급 (CRITICAL) |
| 항공사 라스트미닛 | 프로모션 감지 즉시 | "오늘 출발 땡처리, 지금만!" | 긴급 (CRITICAL) |
| 항공사 얼리버드 | 프로모션 감지 후 정시 발송 | "일찍 잡으면 최대 30% 저렴해요" | 낮음 (LOW) |

---

### 6-1-1. 프로모션 긴급도별 알림 처리 전략 _(v2.1 신규)_

`AirlinePromotion.urgency.level`에 따라 알림 파이프라인을 분기합니다.

```
┌─────────────────────────────────────────────────────────────┐
│              프로모션 긴급도별 알림 처리 흐름                   │
│                                                             │
│  AirlinePromotion 수집                                      │
│       ↓                                                     │
│  urgency.level 판정                                         │
│       ├── CRITICAL (타임세일 24h 이내 / 라스트미닛)           │
│       │    ├── 야간 방해금지 예외 처리 (사전 동의 필요)         │
│       │    ├── 일일 알림 한도 초과 시에도 우선 발송            │
│       │    ├── 푸시 + 카카오 알림톡 동시 발송 (멀티채널)       │
│       │    └── 알림 제목에 남은 시간 명시: "⏰ 3시간 남음"     │
│       │                                                     │
│       ├── HIGH (타임세일 24~72h / 마감 D-3)                  │
│       │    ├── 야간 방해금지 적용                             │
│       │    ├── 일일 알림 한도 내 우선순위 상위 배치            │
│       │    └── 푸시 우선 발송 (이메일 병행)                   │
│       │                                                     │
│       ├── MEDIUM (얼리버드 D-7 / 시즌 프로모션)               │
│       │    ├── 야간 방해금지 적용                             │
│       │    └── 기존 알림 우선순위 큐에 편입                   │
│       │                                                     │
│       └── LOW (일반 얼리버드 / 마일리지 보너스)               │
│            └── 주간 요약 리포트에 포함하여 배치 발송            │
└─────────────────────────────────────────────────────────────┘
```

**CRITICAL 긴급도 판정 기준:**

```typescript
function calcUrgencyLevel(promo: AirlinePromotion): UrgencyLevel {
  const hoursLeft = differenceInHours(new Date(promo.saleWindow.endAt), new Date());

  if (promo.promotionType === 'LAST_MINUTE') return 'CRITICAL';
  if (promo.promotionType === 'FLASH_SALE' && hoursLeft <= 24) return 'CRITICAL';
  if (promo.promotionType === 'FLASH_SALE' && hoursLeft <= 72) return 'HIGH';
  if (promo.urgency.remainingSeats !== undefined && promo.urgency.remainingSeats <= 5) return 'CRITICAL';
  if (hoursLeft <= 72) return 'HIGH';
  if (hoursLeft <= 168) return 'MEDIUM';   // 7일 이내
  return 'LOW';
}
```

**CRITICAL 알림 메시지 템플릿:**

```
[푸시 알림]
제목: ⏰ {hoursLeft}시간 남음 — {airlineName} 특가
본문: {origin} → {destination} {promotionPrice}원
      (정상가 대비 {discountRate}% 할인 · {fareClass})
액션버튼: [지금 예약] [나중에]

[카카오 알림톡] (CRITICAL 전용)
{airlineName}에서 한정 특가를 발표했습니다.
노선: {origin} → {destination}
가격: {promotionPrice}원 ({discountRate}% 할인)
판매 마감: {saleWindow.endAt} ({hoursLeft}시간 후)
▶ 예약하기: {deepLinkUrl}
```

---

### 6-2. 가격 하락 감지 알고리즘

**단순 임계값 방식 (1단계):**

```
hasPriceDrop = currentPrice < (registeredPrice * (1 - threshold))

임계값 기본값:
- 항공권: 10%
- 호텔:   15%
- 에어텔: 8%
- 패키지: 10%
```

**이동평균 + 표준편차 방식 (2단계, 고도화):**

```typescript
function isPriceAnomaly(priceHistory: PricePoint[]): boolean {
  const recent30 = priceHistory.slice(-30);           // 최근 30개 데이터
  const avg = mean(recent30.map(p => p.price));
  const std = stddev(recent30.map(p => p.price));
  const currentPrice = priceHistory.at(-1)!.price;

  const zScore = (currentPrice - avg) / std;
  return zScore < -1.5;                               // 평균 대비 1.5 시그마 이하
}
```

**역대 최저가 탐지 (3단계):**

```
isAllTimeLow = currentPrice < min(priceHistory.allTime)
```

알림 발송 조건: 세 가지 중 하나라도 해당되면 알림 후보로 등록, 피로도 필터 통과 후 발송.

---

### 6-3. 알림 피로도 방지 전략

**쿨다운 정책 (상품 단위):**

| 유형 | 동일 상품 재알림 최소 간격 |
|------|------------------------|
| 항공권 | 6시간 (잔여좌석 1~2석이면 즉시) |
| 호텔 | 12시간 |
| 에어텔 | 24시간 |
| 패키지 | 48시간 |

**사용자 단위 일일 알림 한도:**

```
기본값: 최대 3건/일 (설정에서 1~10건 조정 가능)
야간 방해금지: 22:00 ~ 08:00 (설정 변경 가능)
단, 잔여 좌석 1~2석 항공권은 야간 방해금지 예외 처리 (사용자 동의 필요)
```

**사용자 반응 기반 개인화:**

```
알림 클릭률이 낮은 카테고리 → 알림 빈도 자동 감소 제안
"이 여행지 알림은 그만 받기" 원터치 비활성화 버튼
3회 이상 무반응 → "알림이 도움이 되고 있나요?" 피드백 요청
```

**알림 우선순위 큐:**

```
Priority 1 (즉시): 역대 최저가 + 잔여 좌석 3석 이하
Priority 2 (정시): 가격 10% 이상 하락
Priority 3 (배치): 주간 요약 리포트 (매주 월요일 오전 9시)
```

---

## 7. 개정된 데이터 모델 (WatchItem 중심)

### 7-1. WatchItem (핵심 엔티티)

```typescript
interface WatchItem extends BaseDocument {
  userId: string;

  // --- 여행지 정보 ---
  destination: {
    type: 'CITY' | 'COUNTRY' | 'ANY';
    name: string;                     // "오사카"
    countryCode: string;              // "JP"
    cityCode?: string;                // "OSA"
    airportCodes: string[];           // ["KIX", "ITM"]
  };
  origin: {
    cityCode: string;                 // "SEL"
    airportCodes: string[];           // ["ICN", "GMP"]
  };

  // --- 여행 조건 ---
  travelCondition: {
    wishMonths: number[];             // [6, 7] = 6월, 7월
    durationRange: {
      min: number;                    // 최소 박수
      max: number;                    // 최대 박수
    };
    flexibleDays: number;             // ±N일 유연성
    pax: {
      adults: number;
      children: number;
      infants: number;
    };
    budget: {
      maxPerPerson: number;           // 1인 최대 예산 (원)
      isFlexible: boolean;
    };
  };

  // --- 모니터링 대상 상품 유형 ---
  watchedProductTypes: ProductType[];  // ['FLIGHT', 'HOTEL', 'AIRTEL']

  // --- 유형별 세부 조건 ---
  flightCondition?: FlightCondition;
  hotelCondition?: HotelCondition;
  airtelCondition?: AirtelCondition;
  packageCondition?: PackageCondition;

  // --- 알림 설정 ---
  notificationSettings: {
    isEnabled: boolean;
    channels: ('PUSH' | 'EMAIL' | 'SMS' | 'KAKAO')[];
    quietHours: {
      start: string;                  // "22:00"
      end: string;                    // "08:00"
    };
    thresholds: {                     // 알림 발송 임계값 (%)
      flight: number;                 // 기본: 10
      hotel: number;                  // 기본: 15
      airtel: number;                 // 기본: 8
      package: number;                // 기본: 10
    };
    maxPerDay: number;                // 기본: 3
    // v2.1 신규: 프로모션 알림 설정
    promotionAlerts: {
      isEnabled: boolean;             // 항공사 프로모션 알림 수신 여부
      allowCriticalDuringQuietHours: boolean; // CRITICAL 긴급도 야간 예외 허용
      allowedPromotionTypes: AirlinePromotionType[];
      // 기본값: ['FLASH_SALE', 'LAST_MINUTE', 'EARLY_BIRD', 'SEASONAL', 'NEW_ROUTE', 'MILEAGE_BONUS']
      watchedAirlines: string[];      // 관심 항공사 코드 목록 (빈 배열 = 전체)
    };
  };

  // --- 상태 관리 ---
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'TRIGGERED';
  lastMonitoredAt: string;
  nextMonitorAt: string;
  monitoringCount: number;            // 총 모니터링 횟수 누적

  // --- 현재 최저가 스냅샷 (캐시) ---
  currentBest: {
    byType: {
      FLIGHT?: BestPriceSnapshot;
      HOTEL?: BestPriceSnapshot;
      AIRTEL?: BestPriceSnapshot;
      PACKAGE?: BestPriceSnapshot;
    };
    overallBest: BestPriceSnapshot;   // 전체 중 최저가
    updatedAt: string;
  };

  // v2.1 신규: 매칭된 활성 프로모션 참조
  activePromotions: Array<{
    promotionId: string;              // AirlinePromotion._id 참조
    promotionType: AirlinePromotionType;
    airlineName: string;
    urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    promotionPrice: number;
    discountRate?: number;
    saleEndsAt: string;
    matchedRoutes: string[];          // 매칭된 노선 ("ICN→KIX")
  }>;
}

interface BestPriceSnapshot {
  productId: string;
  productType: ProductType;
  normalizedPrice: number;
  totalPrice: number;
  pricePerPerson: number;
  provider: string;
  deepLinkUrl: string;
  bookingScore: number;
  fetchedAt: string;
}
```

---

### 7-2. FlightCondition / HotelCondition / AirtelCondition / PackageCondition

```typescript
interface FlightCondition {
  tripType: 'ONE_WAY' | 'ROUND_TRIP' | 'OPEN_JAW';
  maxStopover: number;
  preferredAirlines: string[];
  fareClass: string[];
  departureTimeRange?: { start: string; end: string };
  checkedBaggageRequired: boolean;
}

interface HotelCondition {
  minStarRating: number;
  minReviewScore: number;
  breakfastRequired: boolean;
  freeCancellationOnly: boolean;
  preferredAreas: string[];
}

interface AirtelCondition {
  preferredProviders: string[];
  hotelMinStar: number;
  departureGuaranteedOnly: boolean;
  isFlightChangeable?: boolean;
}

interface PackageCondition {
  guideRequired: boolean;
  guideLanguage?: string;
  minMealsPerDay: number;
  maxGroupSize?: number;
  freeCancellationDays: number;
}
```

---

### 7-3. PriceHistory (시계열 가격 이력)

```typescript
interface PriceHistory extends BaseDocument {
  watchItemId: string;
  productType: ProductType;
  externalProductId: string;         // 외부 API 상품 ID
  provider: string;

  pricePoints: PricePoint[];         // 시계열 데이터 (최대 90일치)

  statistics: {
    min90d: number;                  // 90일 최저가
    max90d: number;                  // 90일 최고가
    avg90d: number;                  // 90일 평균가
    std90d: number;                  // 90일 표준편차
    isAllTimeLow: boolean;
    trend: 'UP' | 'DOWN' | 'STABLE'; // 7일 이동평균 추세
  };
}

interface PricePoint {
  timestamp: string;                 // ISO 8601
  normalizedPrice: number;
  totalPrice: number;
  currency: string;
  isSoldOut: boolean;
  availableSeats?: number;
}
```

---

### 7-4. Notification (알림 발송 이력)

```typescript
interface Notification extends BaseDocument {
  userId: string;
  watchItemId: string;
  productId: string;
  productType: ProductType;

  type: 'PRICE_DROP'            // 가격 하락
      | 'ALL_TIME_LOW'          // 역대 최저가
      | 'LOW_AVAILABILITY'      // 잔여 좌석 희소
      | 'DEPARTURE_CONFIRMED'   // 출발 확정
      | 'EARLY_BIRD_ENDING'     // 얼리버드 마감 임박
      | 'WEEKLY_SUMMARY'        // 주간 요약
      // v2.1 신규: 항공사 프로모션 알림 유형
      | 'PROMO_FLASH_SALE'      // 타임세일 감지
      | 'PROMO_LAST_MINUTE'     // 라스트미닛 감지
      | 'PROMO_EARLY_BIRD'      // 얼리버드 출시
      | 'PROMO_SEASONAL'        // 시즌 프로모션 출시
      | 'PROMO_NEW_ROUTE'       // 신규 노선 취항 특가
      | 'PROMO_MILEAGE_BONUS';  // 마일리지 적립 보너스

  payload: {
    previousPrice: number;
    currentPrice: number;
    dropRate: number;            // 하락률 (%)
    bookingScore: number;
    deepLinkUrl: string;
    availableSeats?: number;
    // v2.1 신규: 프로모션 알림 전용 페이로드
    promotionId?: string;
    promotionType?: AirlinePromotionType;
    airlineName?: string;
    saleEndsAt?: string;         // 판매 종료 시각 (타임세일/라스트미닛)
    urgencyLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    mileageBonusRate?: number;   // MILEAGE_BONUS 전용
  };

  channels: ('PUSH' | 'EMAIL' | 'SMS')[];
  sentAt: string;
  readAt?: string;
  clickedAt?: string;
  isActedOn: boolean;            // 예약 전환 여부 (어트리뷰션)
}
```

---

### 7-5. 전체 데이터 모델 관계도

```
User
 └─── WatchItem (1:N)
         ├─── FlightCondition    (1:0~1)
         ├─── HotelCondition     (1:0~1)
         ├─── AirtelCondition    (1:0~1)
         ├─── PackageCondition   (1:0~1)
         ├─── PriceHistory       (1:N, 유형별)
         │       └─── PricePoint[] (시계열 배열)
         ├─── Notification       (1:N)
         └─── AirlinePromotion[] (N:M, activePromotions 참조)  ← v2.1 신규

AirlinePromotion (독립 엔티티)  ← v2.1 신규
 └─── (예약 가능 확인 시) FlightProduct 파생 생성

BaseProduct (추상)
 ├─── FlightProduct
 ├─── HotelProduct
 ├─── AirtelProduct
 └─── PackageProduct
```

---

## 8. 항공사 자체 프로모션 시스템 _(v2.2 대폭 강화)_

### 8-1. 프로모션 수집 파이프라인 (FSC + LCC 통합)

```
┌──────────────────────────────────────────────────────────────────────┐
│                  항공사 프로모션 수집 파이프라인 (v2.2)                  │
│                                                                      │
│  [FSC 수집 레이어]                    [LCC 직접 수집 레이어]             │
│  ├── KoreanAirNdcClient              ├── LccEmailParsingWorker        │
│  │   (대한항공 NDC API, 실시간)       │   (7C/LJ/TW/BX/RS/YP 이메일)  │
│  ├── AsianaGdsClient                 ├── LccWebMonitorWorker          │
│  │   (아시아나 Amadeus 경유)          │   (프로모션 페이지 15~60분)     │
│  └── AirlineRssFeedWorker            └── LccNewsletterSubscriber      │
│      (대한항공 RSS, 수신 즉시)             (뉴스레터 계정 풀 관리)       │
│                ↓                                   ↓                  │
│         ┌──────────────────────────────────────────┐                  │
│         │       RawPromotionNormalizer              │                  │
│         │  (소스 무관 AirlinePromotion 엔티티 생성)  │                  │
│         └──────────────────────────────────────────┘                  │
│                              ↓                                        │
│                    AirlinePromotion DB 저장                            │
│                              ↓                                        │
│                    urgency.level 자동 산출                             │
│                              ↓                                        │
│                    WatchItem 매칭 엔진                                 │
│             (목적지 + 관심 항공사 + 여행 시기 + 프로모션 유형)            │
│                              ↓                                        │
│                    알림 우선순위 큐 편입                                │
│             (CRITICAL → 즉시 / HIGH~LOW → 기존 큐 규칙)               │
│                              ↓                                        │
│                사용자 알림 (PUSH / KAKAO / EMAIL)                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 8-1-1. LCC 직접 수집 워커 설계 _(v2.2 신규)_

#### LccEmailParsingWorker

LCC 6사의 공식 뉴스레터를 구독하는 전용 이메일 계정 풀을 운영하고, 수신된 이메일을 실시간으로 파싱합니다.

```typescript
// LCC 이메일 파싱 워커 설계
interface LccEmailWorkerConfig {
  // 항공사별 뉴스레터 구독 계정
  emailAccounts: Array<{
    airlineCode: string;              // "7C", "LJ", "TW", "BX", "RS", "YP"
    emailAddress: string;             // "tripping-7c@tripping.kr" 등 전용 계정
    imapConfig: ImapConfig;           // IMAP 서버 설정
    newsletterSenderPatterns: string[]; // ["@jejuair.net", "@jejuair.com"]
  }>;
}

// 이메일 파싱 프로세스
async function parseLccEmail(rawEmail: RawEmail): Promise<AirlinePromotion | null> {
  // 1. 발신자 검증 (스팸/피싱 방지)
  const isLegitimateEmail = validateSender(rawEmail.from, allowedSenderPatterns);
  if (!isLegitimateEmail) return null;

  // 2. LLM 기반 구조화 추출 (GPT-4o-mini 활용, 비용 최적화)
  const extracted = await extractPromotionData(rawEmail.htmlBody, {
    fields: ['title', 'routes', 'promotionPrice', 'originalPrice',
             'saleStartAt', 'saleEndAt', 'travelPeriod', 'promotionType'],
    fallbackToTextBody: true,          // HTML 파싱 실패 시 텍스트 본문 사용
  });

  if (!extracted || !extracted.routes?.length) return null;

  // 3. 신뢰도 검증: 추출된 가격이 합리적 범위인지 확인
  const isValidPrice = extracted.promotionPrice > 0
    && extracted.promotionPrice < 5_000_000;  // 500만원 이하
  if (!isValidPrice) return null;

  // 4. AirlinePromotion 엔티티 생성
  return buildAirlinePromotion({
    ...extracted,
    collectionMethod: 'EMAIL_PARSING',
    sourceUrl: rawEmail.messageId,
    fetchedAt: new Date().toISOString(),
  });
}
```

**이메일 계정 풀 운영 전략:**

```
- 항공사당 최소 2개 계정 운영 (Primary + Backup)
  이유: 이메일 발송 오류·스팸 필터링 방어
- 계정 활성 유지: 월 1회 이상 항공사 웹사이트 로그인
  (비활성 계정 뉴스레터 중단 방지)
- 이메일 수신 즉시 파싱 트리거 (IMAP IDLE 방식, polling 아님)
- 파싱 실패율 모니터링: 15% 이상 시 프롬프트 재조정 알림
```

---

#### LccWebMonitorWorker

robots.txt 준수 및 Rate Limit 기준 하에 LCC 프로모션 페이지를 주기적으로 모니터링합니다.

```typescript
// LCC 웹 모니터링 워커 설계
interface LccWebMonitorTarget {
  airlineCode: string;
  targetUrls: Array<{
    url: string;
    pageType: 'PROMOTION_LIST' | 'TIMESALE_PAGE' | 'MAIN_PAGE';
    // PROMOTION_LIST: 프로모션 전체 목록 (1회/시간 모니터링)
    // TIMESALE_PAGE: 타임세일 전용 페이지 (15분 모니터링, 화~금 10:00~18:00)
    // MAIN_PAGE: 메인 배너 특가 (1회/시간 모니터링)
    checkInterval: number;            // 분 단위
    activeHoursOnly?: {               // 지정 시간대만 고빈도 모니터링
      daysOfWeek: number[];           // 0=일, 1=월 ... 5=금
      startHour: number;              // 10
      endHour: number;                // 18
    };
  }>;
  // 변경 감지 기준: HTML diffing으로 가격 영역 변경 여부 확인
  priceSelector: string;              // CSS selector for price elements
  // 이전 수집과 비교하여 변경된 경우에만 파싱 실행
  onChangeOnly: boolean;
}

// 항공사별 모니터링 타겟 설정
const LCC_MONITOR_TARGETS: LccWebMonitorTarget[] = [
  {
    airlineCode: '7C',
    targetUrls: [
      {
        url: 'https://www.jejuair.net/jj/kr/timetable/TimeTable.html',
        pageType: 'PROMOTION_LIST',
        checkInterval: 60,
      },
      {
        url: 'https://www.jejuair.net/jj/kr/promotion/timesale.html',
        pageType: 'TIMESALE_PAGE',
        checkInterval: 15,
        activeHoursOnly: { daysOfWeek: [2, 3, 4, 5], startHour: 10, endHour: 18 },
        // 화~금 오전 10시~오후 6시만 15분 간격
      },
    ],
    priceSelector: '.price-area, .promotion-price',
    onChangeOnly: true,
  },
  {
    airlineCode: 'LJ',
    targetUrls: [
      {
        url: 'https://www.jinair.com/KOR/event/eventList.html',
        pageType: 'PROMOTION_LIST',
        checkInterval: 60,
      },
    ],
    priceSelector: '.event-price, .sale-price',
    onChangeOnly: true,
  },
  {
    airlineCode: 'TW',
    targetUrls: [
      {
        url: 'https://www.twayair.com/app/promotion/main',
        pageType: 'PROMOTION_LIST',
        checkInterval: 60,
      },
    ],
    priceSelector: '.promotion-item .price',
    onChangeOnly: true,
  },
  {
    airlineCode: 'BX',
    targetUrls: [
      {
        url: 'https://www.airbusan.com/ko/promotion/list',
        pageType: 'PROMOTION_LIST',
        checkInterval: 60,
      },
    ],
    priceSelector: '.promo-price',
    onChangeOnly: true,
  },
  {
    airlineCode: 'RS',
    targetUrls: [
      {
        url: 'https://www.flyairseoul.com/CW/ko/promotion/eventList.html',
        pageType: 'PROMOTION_LIST',
        checkInterval: 30,   // OTA 미수록으로 더 자주 확인
      },
    ],
    priceSelector: '.event-list .price',
    onChangeOnly: true,
  },
  {
    airlineCode: 'YP',
    targetUrls: [
      {
        url: 'https://www.airpremiausa.com/ko/promotion',
        pageType: 'PROMOTION_LIST',
        checkInterval: 60,
      },
    ],
    priceSelector: '.promotion-price',
    onChangeOnly: true,
  },
];
```

**HTML 변경 감지 전략 (불필요한 파싱 최소화):**

```typescript
async function detectPromotionPageChange(
  target: LccWebMonitorTarget['targetUrls'][0],
  previousHash: string
): Promise<{ hasChanged: boolean; newHash: string; changedContent?: string }> {
  const html = await fetchWithRateLimit(target.url);

  // 가격 관련 영역만 추출하여 해시 비교 (전체 페이지 아님)
  const priceArea = extractBySelector(html, target.priceSelector);
  const newHash = sha256(priceArea);

  if (newHash === previousHash) {
    return { hasChanged: false, newHash };
  }

  return { hasChanged: true, newHash, changedContent: priceArea };
}
// 변경 감지 시에만 LLM 파싱 실행 → LLM API 비용 최소화
```

---

### 8-1-2. FSC vs LCC 데이터 통합 방식 _(v2.2 신규)_

FSC(대한항공·아시아나)와 LCC(제주항공 등)는 수집 경로가 달라도 동일한 `AirlinePromotion` 엔티티로 정규화합니다.

**수집 경로별 데이터 품질 비교:**

| 수집 경로 | 가격 정확도 | 실시간성 | 구조화 품질 | 법적 위험도 |
|---------|-----------|--------|-----------|-----------|
| NDC API (대한항공) | 매우 높음 | 실시간 | 완전 구조화 | 없음 |
| GDS/Amadeus (아시아나) | 높음 | 5~15분 지연 | 높음 | 없음 |
| 이메일 파싱 (LCC) | 높음 | 수신 즉시 | LLM 의존 (90~95%) | 매우 낮음 |
| 웹 모니터링 (LCC) | 중간 | 15~60분 지연 | LLM 의존 | 낮음 (robots.txt 준수 시) |

**통합 정규화 프로세스:**

```typescript
// RawPromotionNormalizer: 수집 소스 무관하게 동일 엔티티 생성
class RawPromotionNormalizer {
  normalize(
    raw: NdcPromotion | GdsPromotion | EmailPromotion | WebScrapedPromotion,
    collectionMethod: CollectionMethod,
  ): AirlinePromotion {
    return {
      _id: generateId(),
      promotionType: this.inferPromotionType(raw),
      airlineCode: raw.carrierCode,
      airlineName: AIRLINE_NAMES[raw.carrierCode],
      title: raw.title ?? this.generateTitle(raw),
      routes: this.normalizeRoutes(raw),
      pricing: {
        promotionPrice: raw.price,
        originalPrice: raw.originalPrice,
        discountRate: this.calcDiscountRate(raw.price, raw.originalPrice),
        currency: raw.currency ?? 'KRW',
        isTaxIncluded: raw.isTaxIncluded ?? false,
        fareClass: raw.fareClass ?? 'ECONOMY',
      },
      saleWindow: {
        startAt: raw.saleStart ?? new Date().toISOString(),
        endAt: raw.saleEnd,
        travelPeriod: raw.travelPeriod,
      },
      urgency: {
        level: calcUrgencyLevel(raw),
        remainingSeats: raw.remainingSeats,
        expiresInHours: calcHoursLeft(raw.saleEnd),
      },
      source: {
        collectionMethod,
        sourceUrl: raw.sourceUrl,
        deepLinkUrl: raw.bookingUrl ?? raw.sourceUrl,
        fetchedAt: new Date().toISOString(),
      },
      // 데이터 품질 메타데이터 (LCC 수집 신뢰도 추적용)
      dataQuality: {
        confidenceScore: collectionMethod === 'OFFICIAL_API' ? 1.0
          : collectionMethod === 'EMAIL_PARSING' ? 0.92
          : 0.85,                      // WEB_MONITORING
        requiresVerification: collectionMethod !== 'OFFICIAL_API',
      },
      isActive: true,
      isSoldOut: false,
    };
  }

  // 프로모션 유형 추론 (이메일/웹 수집 시 자동 분류)
  private inferPromotionType(raw: any): AirlinePromotionType {
    const titleLower = (raw.title ?? '').toLowerCase();
    if (titleLower.includes('타임세일') || titleLower.includes('flash'))
      return 'FLASH_SALE';
    if (titleLower.includes('얼리버드') || titleLower.includes('early'))
      return 'EARLY_BIRD';
    if (titleLower.includes('라스트') || titleLower.includes('last minute'))
      return 'LAST_MINUTE';
    if (titleLower.includes('마일리지') || titleLower.includes('mileage'))
      return 'MILEAGE_BONUS';
    if (titleLower.includes('취항') || titleLower.includes('new route'))
      return 'NEW_ROUTE';
    return 'SEASONAL';
  }
}
```

**중복 제거 (동일 프로모션이 이메일 + 웹 모니터링 양쪽에서 수집되는 경우):**

```typescript
async function deduplicatePromotion(
  incoming: AirlinePromotion,
  existingPromos: AirlinePromotion[]
): Promise<'INSERT' | 'UPDATE' | 'SKIP'> {
  const duplicate = existingPromos.find(existing =>
    existing.airlineCode === incoming.airlineCode
    && existing.promotionType === incoming.promotionType
    && existing.saleWindow.endAt === incoming.saleWindow.endAt
    && hasSameRoutes(existing.routes, incoming.routes)
  );

  if (!duplicate) return 'INSERT';

  // 동일 프로모션이면 신뢰도 높은 소스의 데이터로 업데이트
  if (incoming.dataQuality.confidenceScore > duplicate.dataQuality.confidenceScore) {
    return 'UPDATE';
  }

  return 'SKIP';
}
```

---

### 8-1-3. 수집 소스 신뢰도 검증 메커니즘 _(v2.2 신규)_

LCC 수집 데이터는 LLM 파싱에 의존하므로 가격 신뢰도 검증이 필수입니다.

```typescript
// 가격 합리성 검증: 수집된 LCC 프로모션 가격이 비현실적이지 않은지 확인
function validateLccPromotionPrice(
  promo: AirlinePromotion,
  historicalPrices: PricePoint[]
): ValidationResult {
  const { promotionPrice, fareClass } = promo.pricing;

  // 1. 절대 최저가 기준 (노선별 물리적 하한선)
  const ROUTE_PRICE_FLOORS: Record<string, number> = {
    'ICN-GMP': 5_000,   // 국내선 5,000원 이상
    'ICN-CJU': 9_000,   // 제주 9,000원 이상
    'ICN-NRT': 30_000,  // 일본 3만원 이상
    'ICN-KIX': 30_000,
    'ICN-BKK': 50_000,  // 동남아 5만원 이상
    'DEFAULT': 9_000,
  };

  const routeKey = `${promo.routes[0]?.origin}-${promo.routes[0]?.destination}`;
  const priceFloor = ROUTE_PRICE_FLOORS[routeKey] ?? ROUTE_PRICE_FLOORS['DEFAULT'];

  if (promotionPrice < priceFloor) {
    return { isValid: false, reason: 'PRICE_BELOW_FLOOR', suggestManualReview: true };
  }

  // 2. 역대 최저가 대비 50% 이상 저렴하면 이상값 의심
  if (historicalPrices.length >= 10) {
    const historicalMin = Math.min(...historicalPrices.map(p => p.normalizedPrice));
    if (promotionPrice < historicalMin * 0.5) {
      return { isValid: false, reason: 'ANOMALY_VS_HISTORY', suggestManualReview: true };
    }
  }

  return { isValid: true };
}
```

---

### 8-2. WatchItem 프로모션 매칭 로직

사용자가 등록한 WatchItem과 수집된 AirlinePromotion을 연결하는 매칭 기준입니다.

```typescript
function matchPromotionToWatchItems(
  promo: AirlinePromotion,
  watchItems: WatchItem[]
): WatchItem[] {
  return watchItems.filter(item => {
    // 1. 프로모션 알림 활성화 여부
    if (!item.notificationSettings.promotionAlerts.isEnabled) return false;

    // 2. 관심 항공사 필터 (빈 배열이면 전체 허용)
    const watchedAirlines = item.notificationSettings.promotionAlerts.watchedAirlines;
    if (watchedAirlines.length > 0 && !watchedAirlines.includes(promo.airlineCode)) {
      return false;
    }

    // 3. 허용 프로모션 유형 필터
    const allowedTypes = item.notificationSettings.promotionAlerts.allowedPromotionTypes;
    if (!allowedTypes.includes(promo.promotionType)) return false;

    // 4. 목적지 매칭 (WatchItem.destination과 프로모션 노선 교차)
    const destinationMatch = promo.routes.some(route =>
      item.destination.airportCodes.includes(route.destination)
    );
    if (!destinationMatch) return false;

    // 5. 여행 시기 매칭 (프로모션 travelPeriod가 WatchItem.wishMonths와 겹치는지)
    if (promo.saleWindow.travelPeriod) {
      const promoMonths = getMonthsInRange(
        promo.saleWindow.travelPeriod.startDate,
        promo.saleWindow.travelPeriod.endDate
      );
      const hasMonthOverlap = promoMonths.some(m => item.travelCondition.wishMonths.includes(m));
      if (!hasMonthOverlap) return false;
    }

    // 6. 예산 필터 (프로모션 가격이 예산 상한 이내인지)
    if (item.travelCondition.budget.maxPerPerson > 0) {
      if (promo.pricing.promotionPrice > item.travelCondition.budget.maxPerPerson) return false;
    }

    return true;
  });
}
```

---

### 8-3. UI 반영 — 프로모션 배지 및 섹션

#### 프로모션 배지/태그 규칙

상품 카드 및 리스트 아이템에 아래 규칙으로 배지를 표시합니다.

| 프로모션 유형 | 배지 스타일 | 배지 텍스트 예시 |
|------------|-----------|--------------|
| FLASH_SALE | 빨간색 강조 + 카운트다운 타이머 | `타임세일 · 5h 23m 남음` |
| LAST_MINUTE | 빨간색 강조 + 깜빡임 | `라스트미닛 · 오늘만` |
| EARLY_BIRD | 파란색 | `얼리버드 · D-45` |
| SEASONAL | 주황색 | `황금연휴 특가` |
| NEW_ROUTE | 초록색 | `신규 취항` |
| MILEAGE_BONUS | 보라색 | `마일리지 2배 적립` |

```
상품 카드 예시:
┌─────────────────────────────────────────────────┐
│ [대한항공 로고]  KE001 · 직항                    │
│ ┌──────────────────┐                            │
│ │ ⚡ 타임세일 5h23m │  ← FLASH_SALE 배지         │
│ └──────────────────┘                            │
│ ICN 09:30  ──────────────►  KIX 11:40           │
│                   2시간 10분                      │
│                                                  │
│ 이코노미 · 23kg 포함 · 무료 취소                  │
│ 정상가 ~~258,000원~~  →  1인 ₩155,000             │
│                              (40% 할인)           │
│  BookingScore ●●●●● 91점    [지금 예약하기]       │
└─────────────────────────────────────────────────┘
```

---

#### 프로모션 전용 피드 섹션

홈 화면 및 결과 화면 상단에 "항공사 프로모션" 섹션을 별도 노출합니다.

```
┌─────────────────────────────────────────────────────┐
│  항공사 프로모션  [전체보기]                           │
│  내 관심 여행지와 매칭된 최신 특가                    │
├─────────────────────────────────────────────────────┤
│  ┌────────────────┐ ┌────────────────┐              │
│  │ ⚡ 타임세일     │ │ 얼리버드       │              │
│  │ 대한항공       │ │ 제주항공       │              │
│  │ ICN→KIX        │ │ ICN→NRT        │              │
│  │ ₩155,000 (-40%)│ │ ₩89,000 (-20%) │              │
│  │ [5h 23m 남음]  │ │ [D-45]         │              │
│  └────────────────┘ └────────────────┘              │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ 마일리지 2배 적립 기간 — 아시아나항공         │    │
│  │ 모든 국제선 2026.03.01 ~ 03.15              │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**프로모션 피드 정렬 규칙:**
1. CRITICAL 긴급도 → 최상단 (잔여 시간 오름차순)
2. HIGH 긴급도 → 그 다음 (잔여 시간 오름차순)
3. MEDIUM/LOW → 할인율 내림차순

---

### 8-4. 프로모션 전용 화면 (프로모션 탭)

결과 화면 탭 구조에 "프로모션" 탭을 추가합니다.

```
[전체 비교] [항공권] [호텔] [에어텔] [패키지] [프로모션]  ← 신규
                                               ↑
                                    활성 프로모션 수 배지 표시
                                    예: [프로모션 3]
```

**프로모션 탭 내 필터:**

```
[전체] [타임세일] [라스트미닛] [얼리버드] [마일리지]

항공사 필터: [전체] [대한항공] [아시아나] [제주항공] [진에어] [티웨이] [에어부산]
```

---

## 부록: 다음 단계 구현 우선순위

| 우선순위 | 작업 | 예상 공수 | 비고 |
|---------|------|---------|------|
| P0 | WatchItem CRUD API + 등록 UX (3단계 스텝) | 2주 | |
| P0 | Amadeus 항공권 연동 + PriceHistory 저장 | 1.5주 | |
| P1 | Booking.com 호텔 연동 | 1주 | |
| P1 | 통합 비교 엔진 + normalizedPrice 계산 | 1주 | |
| P1 | BookingScore 산출 로직 | 0.5주 | |
| P1 | **LCC 이메일 파싱 워커 (LccEmailParsingWorker)** | 1.5주 | v2.2 신규, P1 격상 |
| P2 | 추천 결과 화면 (전체 비교 탭) | 1.5주 | |
| P2 | 알림 발송 파이프라인 (FCM + 카카오 알림톡 연동) | 1.5주 | |
| P2 | **LCC 웹 모니터링 워커 (LccWebMonitorWorker)** | 1주 | v2.2 신규 |
| P2 | **RawPromotionNormalizer + 중복 제거 + 가격 검증** | 0.5주 | v2.2 신규 |
| P2 | WatchItem 프로모션 매칭 + 긴급 알림 처리 | 1주 | |
| P2 | 프로모션 배지 + 홈 피드 섹션 UI | 1주 | |
| P3 | 하나투어/모두투어 에어텔 연동 | 2주 | |
| P3 | 대한항공 NDC API 파트너십 연동 | 2주 | 비즈니스 협의 병행 |
| P3 | 가격 이동평균 + 이상값 탐지 고도화 | 1주 | |
| P3 | 주간 요약 알림 리포트 | 0.5주 | |
| P3 | 프로모션 전용 탭 + 고급 필터 UI | 1주 | |
| P3 | LCC B2B 파트너십 협의 (제주항공·진에어) | 비즈니스 트랙 | MAU 1만 이후 착수 |

**MVP 정의 (6주 내 출시 가능):**
WatchItem 등록 + 항공권 모니터링(FSC) + 호텔 모니터링 + 기본 알림 발송 + 결과 화면

에어텔/패키지 연동은 MVP 이후 v1.1에서 순차 추가.

**프로모션 시스템 (v1.1 목표, MVP+4주) — v2.2 강화:**
LCC 이메일 파싱 (P1, MVP와 병행 개발 가능) → LCC 웹 모니터링 → 정규화/중복 제거 → WatchItem 매칭 → 타임세일/라스트미닛 긴급 알림 → 프로모션 피드 UI.

**LCC 수집 우선순위 결정 근거:**
- 에어서울(RS): OTA 미수록으로 이메일+웹 모니터링이 유일한 수집 경로 → 가장 먼저 구현
- 제주항공(7C): 국내 LCC 1위, 타임세일 빈도 최고 → 두 번째 구현
- 진에어(LJ), 티웨이(TW), 에어부산(BX): 패턴 유사하여 묶음 구현 가능
- 에어프레미아(YP): 중장거리 특화로 별도 프로모션 패턴, 마지막 구현

대한항공 NDC API 파트너십은 별도 비즈니스 협의 트랙으로 진행 (MAU 성장 후 레버리지 확보).
