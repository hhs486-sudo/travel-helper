// =============================================================================
// 공통 기반 타입
// =============================================================================

export interface BaseDocument {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export interface User extends BaseDocument {
  email: string;
  name?: string;
}

export interface Place extends BaseDocument {
  userId: string;
  name: string;
  description: string;
  category: PlaceCategory;
  location: {
    address: string;
    city: string;
    country: string;
    lat?: number;
    lng?: number;
  };
  tags: string[];
  rating?: number;
  imageUrl?: string;
  isSaved: boolean;
}

export type PlaceCategory =
  | 'restaurant'
  | 'hotel'
  | 'attraction'
  | 'cafe'
  | 'shopping'
  | 'nature'
  | 'other';

export interface Recommendation extends BaseDocument {
  placeId: string;
  userId: string;
  note: string;
  rating: number;
  visitedAt?: string;
}

// =============================================================================
// WatchItem 관련 타입 (트립핑 핵심 엔티티)
// =============================================================================

/** 상품 유형: 서비스의 4대 핵심 상품 */
export type ProductType = 'FLIGHT' | 'HOTEL' | 'AIRTEL' | 'PACKAGE';

/** 항공 여행 방향 */
export type TripType = 'ONE_WAY' | 'ROUND_TRIP' | 'OPEN_JAW';

/** 좌석 등급 */
export type FareClass = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';

/** WatchItem 상태 */
export type WatchStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'TRIGGERED';

/** 알림 채널 */
export type NotificationChannel = 'PUSH' | 'EMAIL' | 'SMS' | 'KAKAO';

/** 항공사 프로모션 유형 */
export type AirlinePromotionType =
  | 'EARLY_BIRD'
  | 'FLASH_SALE'
  | 'MILEAGE_BONUS'
  | 'SEASONAL'
  | 'NEW_ROUTE'
  | 'LAST_MINUTE';

/** 프로모션 긴급도 */
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// -----------------------------------------------------------------------------
// 여행 조건 타입 (유형별 세부 조건)
// -----------------------------------------------------------------------------

/** 항공권 전용 검색 조건 */
export interface FlightCondition {
  /** 편도 / 왕복 / 오픈조 */
  tripType: TripType;
  /** 최대 경유 허용 횟수 (0 = 직항만) */
  maxStopover: number;
  /** 선호 항공사 코드 목록 (빈 배열 = 전체 허용) */
  preferredAirlines: string[];
  /** 선호 좌석 등급 목록 */
  fareClasses: FareClass[];
  /** 선호 출발 시간대 */
  departureTimeRange?: {
    start: string; // "HH:mm" 형식
    end: string;   // "HH:mm" 형식
  };
  /** 수하물 포함 필수 여부 */
  checkedBaggageRequired: boolean;
}

/** 호텔 전용 검색 조건 */
export interface HotelCondition {
  /** 최소 호텔 등급 (1~5성) */
  minStarRating: number;
  /** 최소 리뷰 점수 (0~10) */
  minReviewScore: number;
  /** 조식 포함 필수 여부 */
  breakfastRequired: boolean;
  /** 무료 취소 가능 상품만 */
  freeCancellationOnly: boolean;
  /** 선호 지역/구역 목록 (예: ["시내 중심", "해변 근처"]) */
  preferredAreas: string[];
}

/** 에어텔(항공+호텔 묶음) 전용 검색 조건 */
export interface AirtelCondition {
  /** 선호 여행사 목록 (빈 배열 = 전체 허용) */
  preferredProviders: string[];
  /** 에어텔 내 호텔 최소 등급 */
  hotelMinStar: number;
  /** 출발 확정 상품만 */
  departureGuaranteedOnly: boolean;
  /** 항공편 변경 가능 선호 여부 (null = 무관) */
  isFlightChangeable?: boolean;
}

/** 패키지 전용 검색 조건 */
export interface PackageCondition {
  /** 가이드 포함 필수 여부 */
  guideRequired: boolean;
  /** 선호 가이드 언어 (예: "한국어") */
  guideLanguage?: string;
  /** 하루 최소 식사 포함 횟수 */
  minMealsPerDay: number;
  /** 최대 단체 인원 선호 (null = 무관) */
  maxGroupSize?: number;
  /** 무료 취소 가능 기간 (출발 N일 전까지) */
  freeCancellationDays: number;
}

// -----------------------------------------------------------------------------
// WatchItem 핵심 엔티티
// -----------------------------------------------------------------------------

/** 현재 최저가 스냅샷 (모니터링 주기마다 갱신되는 캐시) */
export interface BestPriceSnapshot {
  productId: string;
  productType: ProductType;
  /** 1인 1박 환산가 (원) */
  normalizedPrice: number;
  /** 실제 총 결제 금액 (원) */
  totalPrice: number;
  /** 1인 기준 총액 (원) */
  pricePerPerson: number;
  /** 데이터 소스 (예: "스카이스캐너") */
  provider: string;
  /** 예약 페이지 직링크 */
  deepLinkUrl: string;
  /** 예약 적합도 점수 (0~100) */
  bookingScore: number;
  /** 가격 수집 시각 (ISO 8601) */
  fetchedAt: string;
}

/** 매칭된 활성 항공사 프로모션 참조 */
export interface ActivePromotionRef {
  promotionId: string;
  promotionType: AirlinePromotionType;
  airlineName: string;
  urgencyLevel: UrgencyLevel;
  promotionPrice: number;
  discountRate?: number;
  saleEndsAt: string;
  /** 매칭된 노선 목록 (예: ["ICN→KIX"]) */
  matchedRoutes: string[];
}

/** 알림 설정 */
export interface NotificationSettings {
  isEnabled: boolean;
  channels: NotificationChannel[];
  quietHours: {
    start: string; // "HH:mm"
    end: string;   // "HH:mm"
  };
  /** 알림 발송 가격 하락 임계값 (%) */
  thresholds: {
    flight: number;  // 기본: 10
    hotel: number;   // 기본: 15
    airtel: number;  // 기본: 8
    package: number; // 기본: 10
  };
  /** 하루 최대 알림 수 */
  maxPerDay: number;
  /** 항공사 프로모션 알림 설정 (v2.1+) */
  promotionAlerts: {
    isEnabled: boolean;
    /** CRITICAL 긴급도 야간 방해 금지 시간 예외 허용 */
    allowCriticalDuringQuietHours: boolean;
    allowedPromotionTypes: AirlinePromotionType[];
    /** 관심 항공사 코드 목록 (빈 배열 = 전체 허용) */
    watchedAirlines: string[];
  };
}

/** WatchItem: 관심 여행지 모니터링 등록 엔티티 (핵심) */
export interface WatchItem extends BaseDocument {
  userId: string;
  /** bkend.ai destinations 테이블 참조 ID (선택) */
  destinationId?: string;

  // --- 여행지 정보 ---
  destination: {
    type: 'CITY' | 'COUNTRY' | 'ANY';
    name: string;         // 예: "오사카"
    countryCode: string;  // ISO 3166-1 Alpha-2, 예: "JP"
    cityCode?: string;    // IATA 도시 코드, 예: "OSA"
    airportCodes: string[]; // IATA 공항 코드 배열, 예: ["KIX", "ITM"]
  };

  // --- 출발지 정보 ---
  origin: {
    cityCode: string;       // 예: "SEL"
    airportCodes: string[]; // 예: ["ICN", "GMP"]
  };

  // --- 공통 여행 조건 ---
  travelCondition: {
    /** 희망 여행 월 목록 (1~12) */
    wishMonths: number[];
    durationRange: {
      min: number; // 최소 박수
      max: number; // 최대 박수
    };
    /** 날짜 유연성 ±N일 */
    flexibleDays: number;
    pax: {
      adults: number;
      children: number; // 만 2~11세
      infants: number;  // 만 2세 미만
    };
    budget: {
      maxPerPerson: number; // 1인 최대 예산 (원)
      isFlexible: boolean;
    };
  };

  // --- 모니터링 대상 상품 유형 ---
  watchedProductTypes: ProductType[];

  // --- 유형별 세부 조건 (선택한 유형에만 존재) ---
  flightCondition?: FlightCondition;
  hotelCondition?: HotelCondition;
  airtelCondition?: AirtelCondition;
  packageCondition?: PackageCondition;

  // --- 알림 설정 ---
  notificationSettings: NotificationSettings;

  // --- 모니터링 상태 ---
  status: WatchStatus;
  lastMonitoredAt?: string;
  nextMonitorAt?: string;
  monitoringCount: number;

  // --- 현재 최저가 스냅샷 캐시 ---
  currentBestSnapshot?: {
    byType: {
      FLIGHT?: BestPriceSnapshot;
      HOTEL?: BestPriceSnapshot;
      AIRTEL?: BestPriceSnapshot;
      PACKAGE?: BestPriceSnapshot;
    };
    overallBest?: BestPriceSnapshot;
    updatedAt: string;
  };

  // --- 매칭된 활성 항공사 프로모션 캐시 (v2.1+) ---
  activePromotions: ActivePromotionRef[];
}

// -----------------------------------------------------------------------------
// WatchItem 목록용 경량 타입 (카드 UI, 마이페이지 목록에서 사용)
// -----------------------------------------------------------------------------

/** WatchItem 요약 (목록 조회용 경량 타입) */
export interface WatchItemSummary {
  _id: string;
  /** 목적지 표시명 */
  destinationName: string;
  destinationType: 'CITY' | 'COUNTRY' | 'ANY';
  countryCode: string;
  /** 희망 여행 월 목록 */
  wishMonths: number[];
  /** 여행 기간 범위 (박) */
  durationRange: { min: number; max: number };
  /** 성인 인원 */
  adults: number;
  /** 모니터링 상품 유형 목록 */
  watchedProductTypes: ProductType[];
  /** 알림 활성 여부 */
  alertEnabled: boolean;
  /** WatchItem 상태 */
  status: WatchStatus;
  /** 현재 최저가 (normalizedPrice, 원) */
  currentBestPrice?: number;
  /** 현재 최저가 상품 유형 */
  currentBestType?: ProductType;
  /** 예약 적합도 점수 (0~100) */
  bookingScore?: number;
  /** 매칭된 활성 프로모션 수 */
  activePromotionCount: number;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// WatchItem 생성/수정 요청 DTO
// -----------------------------------------------------------------------------

/** WatchItem 알림 설정 기본값 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  isEnabled: true,
  channels: ['PUSH'],
  quietHours: { start: '22:00', end: '08:00' },
  thresholds: { flight: 10, hotel: 15, airtel: 8, package: 10 },
  maxPerDay: 3,
  promotionAlerts: {
    isEnabled: true,
    allowCriticalDuringQuietHours: false,
    allowedPromotionTypes: [
      'FLASH_SALE',
      'LAST_MINUTE',
      'EARLY_BIRD',
      'SEASONAL',
      'NEW_ROUTE',
      'MILEAGE_BONUS',
    ],
    watchedAirlines: [],
  },
};

/** WatchItem 생성 요청 DTO */
export interface CreateWatchItemRequest {
  // --- Step 1: 여행지 선택 ---
  destination: WatchItem['destination'];
  origin: WatchItem['origin'];

  // --- Step 2: 여행 조건 입력 ---
  travelCondition: WatchItem['travelCondition'];

  // --- Step 3: 상품 유형 및 세부 조건 ---
  watchedProductTypes: ProductType[];
  flightCondition?: FlightCondition;
  hotelCondition?: HotelCondition;
  airtelCondition?: AirtelCondition;
  packageCondition?: PackageCondition;

  // --- 알림 설정 (선택, 기본값 적용) ---
  notificationSettings?: Partial<NotificationSettings>;
}

/** WatchItem 수정 요청 DTO (부분 업데이트 지원) */
export type UpdateWatchItemRequest = Partial<
  Omit<CreateWatchItemRequest, 'destination' | 'origin'>
> & {
  destination?: Partial<WatchItem['destination']>;
  origin?: Partial<WatchItem['origin']>;
  status?: WatchStatus;
};

// -----------------------------------------------------------------------------
// 여행지 자동완성 검색 결과 타입 (Step 1 목적지 검색용)
// -----------------------------------------------------------------------------

/** 여행지 자동완성 검색 결과 항목 */
export interface DestinationSuggestion {
  id: string;
  type: 'CITY' | 'COUNTRY' | 'ANY';
  nameKo: string;   // 한글명 (예: "오사카")
  nameEn: string;   // 영문명 (예: "Osaka")
  countryCode: string;
  countryNameKo: string;
  cityCode?: string;
  airportCodes: string[];
  thumbnailUrl?: string;
  popularityScore: number;
}

/** 출발지 선택 옵션 */
export interface OriginOption {
  label: string;    // 표시명 (예: "서울 (인천/김포)")
  cityCode: string;
  airportCodes: string[];
}

/** 자주 사용하는 출발지 목록 */
export const COMMON_ORIGINS: OriginOption[] = [
  { label: '서울 (인천/김포)', cityCode: 'SEL', airportCodes: ['ICN', 'GMP'] },
  { label: '부산 (김해)', cityCode: 'PUS', airportCodes: ['PUS'] },
  { label: '제주 (제주국제)', cityCode: 'CJU', airportCodes: ['CJU'] },
  { label: '대구 (대구국제)', cityCode: 'TAE', airportCodes: ['TAE'] },
  { label: '청주 (청주국제)', cityCode: 'CJJ', airportCodes: ['CJJ'] },
];

// -----------------------------------------------------------------------------
// 폼 스텝 타입 (WatchItemForm에서 사용)
// -----------------------------------------------------------------------------

export type WatchItemFormStep = 1 | 2 | 3;

/** Step 1 폼 데이터 */
export interface Step1FormData {
  destination: WatchItem['destination'] | null;
  origin: WatchItem['origin'];
}

/** Step 2 폼 데이터 */
export interface Step2FormData {
  wishMonths: number[];
  durationRange: { min: number; max: number };
  flexibleDays: number;
  adults: number;
  children: number;
  infants: number;
  maxPerPerson: number;
  isBudgetFlexible: boolean;
}

/** Step 3 폼 데이터 */
export interface Step3FormData {
  watchedProductTypes: ProductType[];
  flightCondition: FlightCondition;
  hotelCondition: HotelCondition;
  airtelCondition: AirtelCondition;
  packageCondition: PackageCondition;
}

/** 전체 WatchItemForm 데이터 (3단계 통합) */
export interface WatchItemFormData {
  step1: Step1FormData;
  step2: Step2FormData;
  step3: Step3FormData;
}
