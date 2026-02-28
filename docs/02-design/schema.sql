-- =============================================================================
-- 트립핑(Tripping) 여행 가격 모니터링 서비스
-- PostgreSQL + TimescaleDB (Neon 호환) 스키마
--
-- 작성일   : 2026-02-27
-- 버전     : v1.0
-- 기반 명세: tripping-product-spec.md v2.2
--
-- 의존성:
--   - TimescaleDB 확장 필수
--   - pg_trgm 확장 (텍스트 유사도 검색용)
--   - pgcrypto 확장 (UUID 생성용)
--
-- 실행 순서:
--   1. 확장 활성화
--   2. ENUM 타입 정의
--   3. 기반(Base) 테이블 생성
--   4. 핵심 도메인 테이블 생성
--   5. 조건 테이블 생성
--   6. 시계열/이력 테이블 생성
--   7. 알림/예약 테이블 생성
--   8. TimescaleDB Hypertable 및 정책 설정
--   9. 인덱스 생성
--  10. Continuous Aggregate 뷰 생성
--  11. 핵심 쿼리 예시
-- =============================================================================


-- =============================================================================
-- SECTION 1: 확장 활성화
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS timescaledb;  -- 시계열 엔진 (필수)
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid() 함수 제공
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- 여행지 이름 유사도 검색 (자동완성)


-- =============================================================================
-- SECTION 2: ENUM 타입 정의
-- =============================================================================

-- 상품 유형: 서비스의 4대 핵심 상품
CREATE TYPE product_type AS ENUM (
    'FLIGHT',   -- 항공권 단독
    'HOTEL',    -- 호텔 단독
    'AIRTEL',   -- 항공 + 호텔 묶음
    'PACKAGE'   -- 완전 패키지 (항공+호텔+일정+가이드)
);

-- 여행 방향: 편도/왕복/오픈조
CREATE TYPE trip_type AS ENUM (
    'ONE_WAY',    -- 편도
    'ROUND_TRIP', -- 왕복
    'OPEN_JAW'    -- 오픈조 (출발지 ≠ 귀국지)
);

-- 좌석 등급
CREATE TYPE fare_class AS ENUM (
    'ECONOMY',
    'PREMIUM_ECONOMY',
    'BUSINESS',
    'FIRST'
);

-- 조식 포함 여부
CREATE TYPE breakfast_type AS ENUM (
    'INCLUDED',
    'OPTIONAL',
    'NOT_AVAILABLE'
);

-- 취소 정책 유형
CREATE TYPE cancellation_type AS ENUM (
    'FREE',           -- 무료 취소 가능
    'PARTIAL',        -- 부분 위약금
    'NON_REFUNDABLE'  -- 환불 불가
);

-- WatchItem 상태
CREATE TYPE watch_status AS ENUM (
    'ACTIVE',    -- 모니터링 중
    'PAUSED',    -- 일시 정지
    'EXPIRED',   -- 여행 기간 경과로 자동 만료
    'TRIGGERED'  -- 알림 발송 후 완료 처리됨
);

-- 알림 채널
CREATE TYPE notification_channel AS ENUM (
    'PUSH',   -- 앱 푸시 (FCM/APNs)
    'EMAIL',  -- 이메일
    'SMS',    -- 문자
    'KAKAO'   -- 카카오 알림톡
);

-- 알림 유형
CREATE TYPE notification_type AS ENUM (
    -- 일반 가격 알림
    'PRICE_DROP',          -- 가격 하락
    'ALL_TIME_LOW',        -- 역대 최저가
    'LOW_AVAILABILITY',    -- 잔여 좌석/객실 희소
    'DEPARTURE_CONFIRMED', -- 에어텔/패키지 출발 확정
    'EARLY_BIRD_ENDING',   -- 얼리버드 마감 임박
    'WEEKLY_SUMMARY',      -- 주간 요약 리포트
    -- 항공사 프로모션 알림 (v2.1+)
    'PROMO_FLASH_SALE',    -- 타임세일 감지
    'PROMO_LAST_MINUTE',   -- 라스트미닛 감지
    'PROMO_EARLY_BIRD',    -- 얼리버드 출시
    'PROMO_SEASONAL',      -- 시즌 프로모션
    'PROMO_NEW_ROUTE',     -- 신규 노선 취항 특가
    'PROMO_MILEAGE_BONUS'  -- 마일리지 적립 보너스
);

-- 항공사 프로모션 유형
CREATE TYPE airline_promotion_type AS ENUM (
    'EARLY_BIRD',    -- 얼리버드: 출발 수개월 전 한정 특가
    'FLASH_SALE',    -- 타임세일: 24~72시간 한정
    'MILEAGE_BONUS', -- 마일리지 적립 보너스
    'SEASONAL',      -- 시즌 프로모션 (황금연휴, 방학)
    'NEW_ROUTE',     -- 신규 노선 취항 특가
    'LAST_MINUTE'    -- 라스트미닛: 출발 임박 땡처리
);

-- 프로모션 긴급도
CREATE TYPE urgency_level AS ENUM (
    'LOW',      -- 일반 얼리버드, 마일리지
    'MEDIUM',   -- 얼리버드 D-7, 시즌 프로모션
    'HIGH',     -- 타임세일 24~72h, 마감 D-3
    'CRITICAL'  -- 타임세일 24h 이내, 라스트미닛, 잔여 5석 이하
);

-- 데이터 수집 방식
CREATE TYPE collection_method AS ENUM (
    'OFFICIAL_API',   -- 항공사 공식 API (NDC 등)
    'WEB_MONITORING', -- 웹 페이지 모니터링
    'RSS_FEED',       -- RSS/Atom 피드
    'EMAIL_PARSING'   -- 뉴스레터 이메일 파싱
);

-- 여행지 유형
CREATE TYPE destination_type AS ENUM (
    'CITY',    -- 특정 도시 (오사카)
    'COUNTRY', -- 국가 전체 (일본)
    'ANY'      -- 어디든 (최저가 자동 탐색 모드)
);

-- 소셜 로그인 제공자
CREATE TYPE auth_provider AS ENUM (
    'GOOGLE',
    'KAKAO',
    'NAVER',
    'APPLE'
);

-- 예약 상태
CREATE TYPE booking_status AS ENUM (
    'PENDING',    -- 예약 진행 중
    'CONFIRMED',  -- 예약 확정
    'CANCELLED',  -- 취소됨
    'COMPLETED'   -- 여행 완료
);

-- 가격 추세
CREATE TYPE price_trend AS ENUM (
    'UP',     -- 상승
    'DOWN',   -- 하락
    'STABLE'  -- 안정
);


-- =============================================================================
-- SECTION 3: 기반 테이블 (Base Tables)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3-1. users: 사용자 (소셜 로그인 전용)
--
-- 설계 결정:
-- - 소셜 로그인만 지원 → 비밀번호 컬럼 없음 (공격 표면 최소화)
-- - 개인정보(이메일, 이름)는 암호화 저장 권고 (컬럼 레벨 암호화 별도 적용)
-- - phone_number는 SMS 알림용 선택 필드
-- - deleted_at Soft Delete 패턴으로 복구 가능성 확보
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_provider       auth_provider NOT NULL,              -- 소셜 로그인 제공자
    external_user_id    VARCHAR(255) NOT NULL,               -- 소셜 제공자의 사용자 ID
    email               VARCHAR(320),                        -- 이메일 (선택, 암호화 권고)
    name                VARCHAR(100),                        -- 표시명
    phone_number        VARCHAR(20),                         -- E.164 형식 (SMS 알림용)
    profile_image_url   TEXT,                                -- 프로필 이미지 URL
    timezone            VARCHAR(50)  NOT NULL DEFAULT 'Asia/Seoul',
    locale              VARCHAR(10)  NOT NULL DEFAULT 'ko-KR',

    -- 알림 전역 설정 (WatchItem별 설정으로 오버라이드 가능)
    push_token          TEXT,                                -- FCM/APNs 토큰
    max_notifications_per_day SMALLINT NOT NULL DEFAULT 3
        CHECK (max_notifications_per_day BETWEEN 1 AND 10),

    -- 감사 컬럼
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at       TIMESTAMPTZ,
    deleted_at          TIMESTAMPTZ,                         -- Soft Delete

    -- 소셜 제공자 + 외부 ID 조합은 유일해야 함
    UNIQUE (auth_provider, external_user_id)
);

COMMENT ON TABLE  users                       IS '사용자 계정 (소셜 로그인 전용)';
COMMENT ON COLUMN users.external_user_id      IS '소셜 로그인 제공자에서 발급한 고유 사용자 ID';
COMMENT ON COLUMN users.push_token            IS 'FCM(Android) 또는 APNs(iOS) 푸시 토큰, 로그인마다 갱신';
COMMENT ON COLUMN users.deleted_at            IS 'Soft Delete: NULL이면 활성, 값이 있으면 탈퇴 처리됨';


-- -----------------------------------------------------------------------------
-- 3-2. destinations: 여행지 메타 정보 (참조 데이터)
--
-- 설계 결정:
-- - 도시/국가 코드 정규화 테이블로 WatchItem과 분리
-- - IATA 공항 코드 배열 저장으로 "오사카 → KIX, ITM" 다중 공항 처리
-- - coordinates는 지도 표시 및 거리 계산용
-- - popularity_score는 추천 정렬 기준
-- -----------------------------------------------------------------------------
CREATE TABLE destinations (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_type    destination_type NOT NULL DEFAULT 'CITY',
    name_ko             VARCHAR(100) NOT NULL,               -- 한글명 (오사카)
    name_en             VARCHAR(100) NOT NULL,               -- 영문명 (Osaka)
    country_code        CHAR(2)     NOT NULL,                -- ISO 3166-1 Alpha-2 (JP)
    country_name_ko     VARCHAR(100) NOT NULL,               -- 국가명 한글 (일본)
    city_code           VARCHAR(10),                         -- IATA 도시 코드 (OSA)
    airport_codes       VARCHAR(10)[] NOT NULL DEFAULT '{}', -- 공항 코드 배열 ({"KIX","ITM"})
    timezone            VARCHAR(50)  NOT NULL DEFAULT 'Asia/Tokyo',

    -- 지리 정보
    latitude            NUMERIC(9, 6)
        CHECK (latitude BETWEEN -90 AND 90),
    longitude           NUMERIC(9, 6)
        CHECK (longitude BETWEEN -180 AND 180),

    -- 메타데이터
    thumbnail_url       TEXT,
    popularity_score    SMALLINT    NOT NULL DEFAULT 50
        CHECK (popularity_score BETWEEN 0 AND 100),
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,

    -- 감사 컬럼
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  destinations              IS '여행지 메타 정보 참조 테이블 (도시/국가/어디든)';
COMMENT ON COLUMN destinations.city_code   IS 'IATA 도시 코드. 오사카=OSA, 도쿄=TYO';
COMMENT ON COLUMN destinations.airport_codes IS 'IATA 공항 코드 배열. 오사카: {KIX, ITM}';


-- =============================================================================
-- SECTION 4: 핵심 도메인 테이블
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4-1. watch_items: 관심 여행지 모니터링 등록 (핵심 엔티티)
--
-- 설계 결정:
-- - destination, origin, travel_condition을 JSONB로 저장
--   이유: 여행 조건은 유형별로 필드 구성이 다르고, 하위 필드에 자주 접근하는
--         필드(wish_months, pax)는 생성된 컬럼(generated column)으로 추출하여 인덱싱
-- - current_best_snapshot: 최저가 캐시 (매 모니터링마다 업데이트)
--   → PriceHistory JOIN 없이 API 응답 가능, 읽기 성능 극대화
-- - active_promotions: WatchItem에 매칭된 항공사 프로모션 캐시 (JSONB 배열)
-- -----------------------------------------------------------------------------
CREATE TABLE watch_items (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination_id      UUID        REFERENCES destinations(id) ON DELETE SET NULL,

    -- 여행지 정보 (JSONB: 도시/국가/어디든 유형별 유연한 구조)
    -- 예: {"type":"CITY","name":"오사카","countryCode":"JP","cityCode":"OSA","airportCodes":["KIX","ITM"]}
    destination         JSONB       NOT NULL,

    -- 출발지 정보
    -- 예: {"cityCode":"SEL","airportCodes":["ICN","GMP"]}
    origin              JSONB       NOT NULL,

    -- 여행 조건 (공통 필드)
    -- 예: {"wishMonths":[6,7],"durationRange":{"min":3,"max":7},"flexibleDays":2,
    --      "pax":{"adults":2,"children":0,"infants":0},
    --      "budget":{"maxPerPerson":1500000,"isFlexible":false}}
    travel_condition    JSONB       NOT NULL,

    -- 모니터링 대상 상품 유형 배열
    -- 예: {"FLIGHT","HOTEL","AIRTEL"}
    watched_product_types product_type[] NOT NULL
        CHECK (cardinality(watched_product_types) > 0),

    -- 알림 설정
    -- 구조: {isEnabled, channels, quietHours, thresholds, maxPerDay, promotionAlerts}
    notification_settings JSONB     NOT NULL DEFAULT '{
        "isEnabled": true,
        "channels": ["PUSH"],
        "quietHours": {"start": "22:00", "end": "08:00"},
        "thresholds": {"flight": 10, "hotel": 15, "airtel": 8, "package": 10},
        "maxPerDay": 3,
        "promotionAlerts": {
            "isEnabled": true,
            "allowCriticalDuringQuietHours": false,
            "allowedPromotionTypes": ["FLASH_SALE","LAST_MINUTE","EARLY_BIRD","SEASONAL","NEW_ROUTE","MILEAGE_BONUS"],
            "watchedAirlines": []
        }
    }',

    -- 현재 최저가 스냅샷 캐시 (모니터링 주기마다 갱신, 읽기 성능 최적화)
    -- 구조: {byType:{FLIGHT:{...},HOTEL:{...},...}, overallBest:{...}, updatedAt}
    current_best_snapshot JSONB,

    -- 매칭된 활성 항공사 프로모션 캐시 (v2.1+)
    -- 구조: [{promotionId, promotionType, airlineName, urgencyLevel, ...}, ...]
    active_promotions   JSONB       NOT NULL DEFAULT '[]',

    -- 상태 및 모니터링 메타
    status              watch_status NOT NULL DEFAULT 'ACTIVE',
    last_monitored_at   TIMESTAMPTZ,
    next_monitor_at     TIMESTAMPTZ,
    monitoring_count    INTEGER     NOT NULL DEFAULT 0
        CHECK (monitoring_count >= 0),

    -- 감사 컬럼
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ -- Soft Delete

    -- CHECK: 활성 상태에서는 next_monitor_at이 존재해야 함
    -- (애플리케이션 레벨에서 보완 - DB 레벨에서는 partial index로 처리)
);

COMMENT ON TABLE  watch_items                    IS '사용자가 등록한 관심 여행지 모니터링 아이템 (핵심 엔티티)';
COMMENT ON COLUMN watch_items.destination        IS 'JSONB: type(CITY/COUNTRY/ANY), name, countryCode, cityCode, airportCodes';
COMMENT ON COLUMN watch_items.travel_condition   IS 'JSONB: wishMonths, durationRange, flexibleDays, pax, budget';
COMMENT ON COLUMN watch_items.current_best_snapshot IS 'JSONB: 최저가 캐시. PriceHistory JOIN 없이 빠른 응답 제공용';
COMMENT ON COLUMN watch_items.active_promotions  IS 'JSONB 배열: 이 WatchItem에 매칭된 활성 항공사 프로모션 캐시';


-- =============================================================================
-- SECTION 5: 유형별 조건 테이블
--
-- 설계 결정:
-- - WatchItem과 1:0~1 관계로 분리한 이유:
--   1) 사용자가 선택한 유형에만 행이 생성됨 (NULL 컬럼 낭비 방지)
--   2) 유형별 CHECK 제약조건을 명확히 적용 가능
--   3) 쿼리 시 필요한 조건만 JOIN (파티션된 읽기)
-- - preferred_airlines, preferred_areas 등 배열 필드는 GIN 인덱스 적용
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5-1. flight_conditions: 항공권 전용 조건
-- -----------------------------------------------------------------------------
CREATE TABLE flight_conditions (
    id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    watch_item_id            UUID    NOT NULL UNIQUE REFERENCES watch_items(id) ON DELETE CASCADE,
    trip_type                trip_type NOT NULL DEFAULT 'ROUND_TRIP',
    max_stopover             SMALLINT NOT NULL DEFAULT 0
        CHECK (max_stopover BETWEEN 0 AND 5),          -- 0=직항만
    preferred_airlines       VARCHAR(5)[] NOT NULL DEFAULT '{}', -- IATA 항공사 코드 배열
    fare_classes             fare_class[] NOT NULL DEFAULT '{ECONOMY}',
    departure_time_start     TIME,                              -- 선호 출발 시간 시작
    departure_time_end       TIME,                              -- 선호 출발 시간 종료
    checked_baggage_required BOOLEAN NOT NULL DEFAULT FALSE,    -- 수하물 포함 필수 여부
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        departure_time_start IS NULL AND departure_time_end IS NULL
        OR departure_time_start < departure_time_end
    )
);

COMMENT ON TABLE flight_conditions IS '항공권 유형 전용 검색 조건 (WatchItem과 1:0~1)';


-- -----------------------------------------------------------------------------
-- 5-2. hotel_conditions: 호텔 전용 조건
-- -----------------------------------------------------------------------------
CREATE TABLE hotel_conditions (
    id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    watch_item_id         UUID    NOT NULL UNIQUE REFERENCES watch_items(id) ON DELETE CASCADE,
    min_star_rating       SMALLINT NOT NULL DEFAULT 1
        CHECK (min_star_rating BETWEEN 1 AND 5),
    min_review_score      NUMERIC(3, 1) NOT NULL DEFAULT 0.0
        CHECK (min_review_score BETWEEN 0.0 AND 10.0),
    breakfast_required    BOOLEAN NOT NULL DEFAULT FALSE,
    free_cancellation_only BOOLEAN NOT NULL DEFAULT FALSE,
    preferred_areas       TEXT[]  NOT NULL DEFAULT '{}', -- ["시내 중심", "해변 근처"]
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hotel_conditions IS '호텔 유형 전용 검색 조건 (WatchItem과 1:0~1)';


-- -----------------------------------------------------------------------------
-- 5-3. airtel_conditions: 에어텔 전용 조건
-- -----------------------------------------------------------------------------
CREATE TABLE airtel_conditions (
    id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    watch_item_id             UUID    NOT NULL UNIQUE REFERENCES watch_items(id) ON DELETE CASCADE,
    preferred_providers       VARCHAR(100)[] NOT NULL DEFAULT '{}', -- 선호 여행사 배열
    hotel_min_star            SMALLINT NOT NULL DEFAULT 1
        CHECK (hotel_min_star BETWEEN 1 AND 5),
    departure_guaranteed_only BOOLEAN NOT NULL DEFAULT FALSE,
    is_flight_changeable      BOOLEAN,          -- NULL = 무관
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE airtel_conditions IS '에어텔(항공+호텔 묶음) 전용 검색 조건 (WatchItem과 1:0~1)';


-- -----------------------------------------------------------------------------
-- 5-4. package_conditions: 패키지 전용 조건
-- -----------------------------------------------------------------------------
CREATE TABLE package_conditions (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    watch_item_id           UUID    NOT NULL UNIQUE REFERENCES watch_items(id) ON DELETE CASCADE,
    guide_required          BOOLEAN NOT NULL DEFAULT FALSE,
    guide_language          VARCHAR(20),         -- "한국어", "영어"
    min_meals_per_day       SMALLINT NOT NULL DEFAULT 0
        CHECK (min_meals_per_day BETWEEN 0 AND 10),
    max_group_size          SMALLINT
        CHECK (max_group_size IS NULL OR max_group_size > 0),
    free_cancellation_days  SMALLINT NOT NULL DEFAULT 0 -- 출발 N일 전까지 무료 취소
        CHECK (free_cancellation_days >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE package_conditions IS '패키지 유형 전용 검색 조건 (WatchItem과 1:0~1)';


-- =============================================================================
-- SECTION 6: 시계열 가격 이력 (TimescaleDB Hypertable)
--
-- 설계 결정:
-- - 기획서의 PriceHistory.pricePoints[] 배열을 "행(row)" 단위로 풀어서 저장
--   이유:
--     1) TimescaleDB Hypertable은 시간 컬럼 기준 청크 분할 → 배열 내 포인트 개별 압축/집계 불가
--     2) 집계 쿼리(MIN, AVG, 이동평균)를 SQL로 직접 표현 가능
--     3) Continuous Aggregate 뷰 생성 가능 (배열이면 불가)
--     4) 특정 시점 이후 데이터 조회 시 TimescaleDB 청크 pruning 효과 극대화
--
-- - partition_key = watch_item_id 기반 → TimescaleDB 2차원 파티셔닝 활용
--   (시간 x watch_item_id로 청크 내 데이터 밀집도 향상)
--
-- - 보안: 가격 데이터는 민감 정보 아니지만 watch_item_id → user_id 역추적 방지를
--   위해 직접 user_id를 저장하지 않음
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6-1. price_history: 시계열 가격 이력 (TimescaleDB Hypertable 변환 예정)
-- -----------------------------------------------------------------------------
CREATE TABLE price_history (
    -- TimescaleDB Hypertable에서 PRIMARY KEY는 반드시 파티션 컬럼(recorded_at)을 포함해야 함
    watch_item_id        UUID        NOT NULL REFERENCES watch_items(id) ON DELETE CASCADE,
    recorded_at          TIMESTAMPTZ NOT NULL,  -- 가격 수집 시각 (Hypertable 파티션 기준)

    product_type         product_type NOT NULL,
    external_product_id  VARCHAR(255) NOT NULL,  -- 외부 API 상품 ID (소스별 고유값)
    provider             VARCHAR(100) NOT NULL,  -- 데이터 소스 (SKYSCANNER, AMADEUS 등)

    -- 가격 정보
    normalized_price     INTEGER     NOT NULL    -- 1박 1인 환산가 (원). NUMERIC 대신 INTEGER로 성능 최적화
        CHECK (normalized_price > 0),           -- 가격 음수 방지
    total_price          INTEGER     NOT NULL
        CHECK (total_price > 0),
    price_per_person     INTEGER     NOT NULL
        CHECK (price_per_person > 0),
    original_price       INTEGER                 -- 정가 (할인 전, NULL이면 할인 없음)
        CHECK (original_price IS NULL OR original_price > 0),
    currency             CHAR(3)     NOT NULL DEFAULT 'KRW', -- ISO 4217
    is_tax_included      BOOLEAN     NOT NULL DEFAULT TRUE,

    -- 재고/상태
    is_sold_out          BOOLEAN     NOT NULL DEFAULT FALSE,
    available_seats      SMALLINT               -- 잔여 좌석/객실 수 (NULL = 정보 없음)
        CHECK (available_seats IS NULL OR available_seats >= 0),

    -- 딥링크
    deep_link_url        TEXT        NOT NULL,

    PRIMARY KEY (watch_item_id, recorded_at)    -- Hypertable 복합 PK
);

COMMENT ON TABLE  price_history                 IS '시계열 가격 이력 - TimescaleDB Hypertable. 1행 = 1회 가격 수집 포인트';
COMMENT ON COLUMN price_history.recorded_at     IS 'Hypertable 파티션 기준 컬럼. 가격 수집 시각 (UTC 저장 권고)';
COMMENT ON COLUMN price_history.normalized_price IS '1박 1인 환산가(원). 상품 유형 무관 비교 기준값';
COMMENT ON COLUMN price_history.external_product_id IS '외부 API 상품 고유 ID. 동일 상품 추적용';


-- =============================================================================
-- SECTION 7: 항공사 프로모션 (독립 엔티티)
--
-- 설계 결정:
-- - BaseProduct를 상속하지 않는 완전 독립 엔티티 (기획서 명시)
-- - routes는 JSONB 배열: 프로모션 하나에 다수 노선이 포함될 수 있음
--   (예: 대한항공 동계 세일 → 15개 노선 동시 적용)
-- - mileage_bonus는 MILEAGE_BONUS 유형에서만 유의미하므로 JSONB로 선택적 저장
-- - data_quality는 LCC 비API 수집 데이터 신뢰도 추적 (v2.2)
-- =============================================================================

CREATE TABLE airline_promotions (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 프로모션 기본 정보
    promotion_type       airline_promotion_type NOT NULL,
    airline_code         VARCHAR(5)  NOT NULL,     -- IATA 항공사 코드 (KE, OZ, 7C, LJ, TW, BX, RS, YP)
    airline_name         VARCHAR(100) NOT NULL,
    title                VARCHAR(500) NOT NULL,    -- "대한항공 오사카 타임세일 – 최대 40% 할인"
    description          TEXT,

    -- 적용 노선 (JSONB 배열)
    -- 예: [{"origin":"ICN","destination":"KIX","tripType":"ROUND_TRIP"}, ...]
    routes               JSONB       NOT NULL DEFAULT '[]',

    -- 프로모션 가격
    promotion_price      INTEGER     NOT NULL
        CHECK (promotion_price > 0),
    original_price       INTEGER
        CHECK (original_price IS NULL OR original_price > 0),
    discount_rate        NUMERIC(5, 2)
        CHECK (discount_rate IS NULL OR discount_rate BETWEEN 0 AND 100),
    currency             CHAR(3)     NOT NULL DEFAULT 'KRW',
    is_tax_included      BOOLEAN     NOT NULL DEFAULT FALSE,
    fare_class           fare_class  NOT NULL DEFAULT 'ECONOMY',

    -- 판매 기간
    sale_starts_at       TIMESTAMPTZ NOT NULL,
    sale_ends_at         TIMESTAMPTZ NOT NULL,
    CHECK (sale_ends_at > sale_starts_at),

    -- 여행 적용 기간 (NULL이면 제한 없음)
    travel_period_start  DATE,
    travel_period_end    DATE,
    CHECK (
        travel_period_start IS NULL AND travel_period_end IS NULL
        OR (travel_period_start IS NOT NULL AND travel_period_end IS NOT NULL
            AND travel_period_end >= travel_period_start)
    ),

    -- 긴급도
    urgency_level        urgency_level NOT NULL DEFAULT 'LOW',
    remaining_seats      SMALLINT
        CHECK (remaining_seats IS NULL OR remaining_seats >= 0),
    expires_in_hours     SMALLINT
        CHECK (expires_in_hours IS NULL OR expires_in_hours >= 0),

    -- 마일리지 보너스 정보 (MILEAGE_BONUS 유형 전용, JSONB)
    -- 예: {"bonusRate":2,"eligiblePrograms":["SKYPASS","ASIANA CLUB"]}
    mileage_bonus        JSONB,

    -- 수집 메타데이터
    collection_method    collection_method NOT NULL,
    source_url           TEXT        NOT NULL,
    deep_link_url        TEXT        NOT NULL,
    fetched_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 데이터 품질 (v2.2: LCC 비API 수집 신뢰도 추적)
    confidence_score     NUMERIC(3, 2) NOT NULL DEFAULT 1.0
        CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    -- 신뢰도 기준: NDC=1.0, RSS=0.95, 이메일=0.92, 웹=0.85
    requires_verification BOOLEAN    NOT NULL DEFAULT FALSE,
    last_verified_at     TIMESTAMPTZ,

    -- 상태
    is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
    is_sold_out          BOOLEAN     NOT NULL DEFAULT FALSE,

    -- 감사 컬럼
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  airline_promotions                   IS '항공사 자체 발행 프로모션 (OTA 외 채널 수집 포함, v2.1+)';
COMMENT ON COLUMN airline_promotions.airline_code      IS 'IATA 항공사 코드: KE=대한항공, OZ=아시아나, 7C=제주항공, LJ=진에어, TW=티웨이, BX=에어부산, RS=에어서울, YP=에어프레미아';
COMMENT ON COLUMN airline_promotions.routes            IS 'JSONB 배열: [{origin, destination, tripType}]. 복수 노선 동시 적용 프로모션 지원';
COMMENT ON COLUMN airline_promotions.confidence_score  IS '데이터 신뢰도: NDC API=1.0, RSS=0.95, 이메일 파싱=0.92, 웹 모니터링=0.85';


-- =============================================================================
-- SECTION 8: 알림 발송 이력
--
-- 설계 결정:
-- - 알림 1건 = 1행. 채널별로 행을 분리하지 않고 channels[] 배열로 저장
--   이유: 동일 이벤트에 대한 멀티채널 발송을 한 행으로 관리 → 피로도 계산 단순화
-- - payload는 JSONB: 알림 유형별로 필드 구성이 다름
-- - read_at, clicked_at NULL이면 미읽음/미클릭
-- - is_acted_on: 알림으로 인한 예약 전환 여부 (어트리뷰션 추적)
-- =============================================================================

CREATE TABLE notifications (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    watch_item_id        UUID        REFERENCES watch_items(id) ON DELETE SET NULL,
    notification_type    notification_type NOT NULL,

    -- 알림 페이로드 (JSONB: 유형별 구조 상이)
    -- 공통: {previousPrice, currentPrice, dropRate, bookingScore, deepLinkUrl}
    -- 프로모션 추가: {promotionId, promotionType, airlineName, saleEndsAt, urgencyLevel}
    payload              JSONB       NOT NULL DEFAULT '{}',

    -- 발송 채널 (멀티채널 지원)
    channels             notification_channel[] NOT NULL
        CHECK (cardinality(channels) > 0),

    -- 발송 상태 추적
    sent_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at              TIMESTAMPTZ,    -- NULL = 미읽음
    clicked_at           TIMESTAMPTZ,   -- NULL = 미클릭
    is_acted_on          BOOLEAN     NOT NULL DEFAULT FALSE, -- 예약 전환 여부

    -- 검색/필터용 역정규화 컬럼 (payload 파싱 없이 빠른 조회용)
    product_type         product_type,
    promotion_id         UUID        REFERENCES airline_promotions(id) ON DELETE SET NULL,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 비즈니스 규칙: read_at은 sent_at 이후여야 함
    CHECK (read_at IS NULL OR read_at >= sent_at),
    CHECK (clicked_at IS NULL OR clicked_at >= sent_at)
);

COMMENT ON TABLE  notifications              IS '알림 발송 이력. 1행 = 1건의 알림 이벤트 (멀티채널 포함)';
COMMENT ON COLUMN notifications.is_acted_on  IS '알림 클릭 후 실제 예약으로 전환된 경우 TRUE (어트리뷰션)';
COMMENT ON COLUMN notifications.payload      IS 'JSONB: 알림 유형별 데이터. 프로모션 알림은 promotionId, saleEndsAt 등 포함';


-- =============================================================================
-- SECTION 9: 예약 내역 (외부 연동)
--
-- 설계 결정:
-- - 트립핑은 예약 플랫폼이 아닌 가격 모니터링 서비스 → 외부 딥링크로 예약 유도
-- - 예약 이력은 어트리뷰션(알림→예약 전환) 추적 및 사용자 여행 이력 관리 목적
-- - 실제 예약 데이터는 외부 시스템에 있으므로 external_booking_id로 참조
-- - price_at_booking: 예약 시점 가격 스냅샷 (이후 가격 변동과 무관하게 기록)
-- =============================================================================

CREATE TABLE bookings (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    watch_item_id        UUID        REFERENCES watch_items(id) ON DELETE SET NULL,
    notification_id      UUID        REFERENCES notifications(id) ON DELETE SET NULL, -- 알림으로 유입된 경우

    -- 예약 상품 정보
    product_type         product_type NOT NULL,
    external_product_id  VARCHAR(255) NOT NULL,  -- 외부 API 상품 ID
    external_booking_id  VARCHAR(255),           -- 외부 예약 확인 번호 (사용자 입력 또는 API 반환)
    provider             VARCHAR(100) NOT NULL,   -- 예약한 OTA/항공사

    -- 여행 정보
    destination_name     VARCHAR(200) NOT NULL,  -- 비정규화: 예약 시점 여행지명 보존
    travel_start_date    DATE        NOT NULL,
    travel_end_date      DATE        NOT NULL,
    CHECK (travel_end_date >= travel_start_date),

    -- 예약 시점 가격 스냅샷 (이후 가격 변동과 무관)
    price_at_booking     INTEGER     NOT NULL
        CHECK (price_at_booking > 0),
    currency             CHAR(3)     NOT NULL DEFAULT 'KRW',
    adults_count         SMALLINT    NOT NULL DEFAULT 1
        CHECK (adults_count > 0),

    -- 예약 상태
    status               booking_status NOT NULL DEFAULT 'PENDING',
    deep_link_url        TEXT        NOT NULL,  -- 예약 페이지 URL

    -- 감사 컬럼
    booked_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  bookings                    IS '사용자 예약 내역 (외부 OTA 연동, 어트리뷰션 추적용)';
COMMENT ON COLUMN bookings.notification_id    IS '알림을 통해 예약으로 전환된 경우 참조. 어트리뷰션 분석에 활용';
COMMENT ON COLUMN bookings.price_at_booking   IS '예약 시점 가격 스냅샷 (원). 이후 가격 변동과 무관하게 기록';


-- =============================================================================
-- SECTION 10: TimescaleDB 설정
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 10-1. Hypertable 변환 (chunk_time_interval: 1개월)
--
-- 선택 이유:
-- - 1개월 청크: 월별 집계 쿼리 패턴과 정합. 압축 단위와도 일치.
-- - 공간별 파티셔닝(space partitioning) 2차원: watch_item_id 기준 16개 파티션
--   → 특정 WatchItem 조회 시 관련 청크만 스캔 (대규모 사용자 환경 대비)
-- -----------------------------------------------------------------------------
SELECT create_hypertable(
    'price_history',                          -- 대상 테이블
    'recorded_at',                            -- 시간 파티션 컬럼
    chunk_time_interval => INTERVAL '1 month', -- 1개월 단위 청크
    if_not_exists => TRUE
);

-- 2차원 공간 파티셔닝: watch_item_id 기준
-- 이점: 특정 WatchItem 조회 시 해당 파티션의 청크만 스캔 → I/O 감소
SELECT add_dimension(
    'price_history',
    'watch_item_id',
    number_partitions => 16,
    if_not_exists => TRUE
);


-- -----------------------------------------------------------------------------
-- 10-2. 자동 압축 정책 (90일 이후 오래된 청크 압축)
--
-- 선택 이유:
-- - 90일 이후 데이터는 실시간 조회보다 집계/통계 용도
-- - TimescaleDB 압축: 컬럼 기반 압축으로 시계열 데이터 90% 이상 압축 가능
-- - segmentby: watch_item_id, product_type → 집계 쿼리 시 압축 상태로 스캔 가능
-- - orderby: recorded_at → 시간 범위 쿼리 최적화
-- -----------------------------------------------------------------------------
ALTER TABLE price_history SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'watch_item_id, product_type',
    timescaledb.compress_orderby   = 'recorded_at DESC'
);

SELECT add_compression_policy(
    'price_history',
    compress_after => INTERVAL '90 days',  -- 90일 경과 청크 자동 압축
    if_not_exists => TRUE
);


-- -----------------------------------------------------------------------------
-- 10-3. 데이터 보존 정책 (1년 이후 자동 삭제)
--
-- 비즈니스 근거:
-- - 가격 이력 1년치면 계절성 패턴 분석에 충분
-- - 무한 보존 시 스토리지 비용 급증 (Neon 용량 제한 고려)
-- - GDPR/PIPA: 서비스 목적 달성 후 개인정보 파기 원칙 (WatchItem 삭제 시 함께 삭제)
-- -----------------------------------------------------------------------------
SELECT add_retention_policy(
    'price_history',
    drop_after  => INTERVAL '1 year',  -- 1년 경과 데이터 자동 삭제
    if_not_exists => TRUE
);


-- =============================================================================
-- SECTION 11: 인덱스 전략
--
-- 인덱스 설계 원칙:
-- 1. 자주 실행되는 쿼리 패턴 기반으로 인덱스 선정
-- 2. 카디널리티(선택도)가 높은 컬럼을 복합 인덱스 선두에 배치
-- 3. 부분 인덱스(Partial Index)로 활성 레코드만 인덱싱 → 인덱스 크기 최소화
-- 4. JSONB 컬럼은 GIN 인덱스 적용
-- 5. 텍스트 검색은 pg_trgm GIN 인덱스 (자동완성)
-- =============================================================================

-- ---- users ----

-- 소셜 로그인 시 사용자 조회 (이메일 빠른 검색)
CREATE INDEX idx_users_email
    ON users (email)
    WHERE deleted_at IS NULL;  -- 활성 사용자만

-- ---- watch_items ----

-- [핵심 쿼리 1] 사용자의 활성 WatchItem 목록 조회 (마이페이지, 홈 화면)
CREATE INDEX idx_watch_items_user_active
    ON watch_items (user_id, created_at DESC)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- [핵심 쿼리 2] 모니터링 스케줄러: next_monitor_at 기준으로 처리할 WatchItem 조회
-- → "지금 처리해야 할 WatchItem" 큐 역할
CREATE INDEX idx_watch_items_next_monitor
    ON watch_items (next_monitor_at ASC)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- destination JSONB 내 airportCodes 배열 검색 (항공사 프로모션 매칭)
-- 예: "KIX를 목적지로 하는 모든 WatchItem 찾기"
CREATE INDEX idx_watch_items_destination_gin
    ON watch_items USING GIN (destination jsonb_path_ops);

-- watched_product_types 배열 검색 (상품 유형별 워커 처리)
CREATE INDEX idx_watch_items_product_types
    ON watch_items USING GIN (watched_product_types);

-- ---- price_history (TimescaleDB 청크 인덱스) ----

-- [핵심 쿼리 3] WatchItem별 가격 추이 조회 (30일/90일 차트)
-- TimescaleDB는 각 청크에 자동으로 이 인덱스를 복제함
CREATE INDEX idx_price_history_watch_item_time
    ON price_history (watch_item_id, recorded_at DESC);

-- [핵심 쿼리 4] 상품 유형 + WatchItem 결합 조회 (유형별 최저가)
CREATE INDEX idx_price_history_watch_item_type
    ON price_history (watch_item_id, product_type, recorded_at DESC)
    WHERE is_sold_out = FALSE;  -- 판매 가능한 상품만

-- [핵심 쿼리 5] 외부 상품 ID로 가격 이력 추적 (동일 상품 가격 변화 추적)
CREATE INDEX idx_price_history_external_product
    ON price_history (external_product_id, recorded_at DESC);

-- normalized_price 범위 검색 (예산 필터링)
CREATE INDEX idx_price_history_normalized_price
    ON price_history (watch_item_id, normalized_price)
    WHERE is_sold_out = FALSE;

-- ---- airline_promotions ----

-- [핵심 쿼리 6] 활성 프로모션 조회 (항공사 코드 + 긴급도 + 판매 기간)
CREATE INDEX idx_airline_promotions_active
    ON airline_promotions (airline_code, urgency_level, sale_ends_at)
    WHERE is_active = TRUE AND is_sold_out = FALSE;

-- 판매 종료 시각 기준 만료 처리 배치
CREATE INDEX idx_airline_promotions_sale_ends
    ON airline_promotions (sale_ends_at)
    WHERE is_active = TRUE;

-- routes JSONB 배열 검색 (도착 공항 기준 프로모션 탐색)
-- 예: "KIX 도착 프로모션 전체 조회"
CREATE INDEX idx_airline_promotions_routes_gin
    ON airline_promotions USING GIN (routes jsonb_path_ops);

-- ---- notifications ----

-- [핵심 쿼리 7] 사용자 알림 목록 (최신순, 미읽음 포함)
CREATE INDEX idx_notifications_user_sent
    ON notifications (user_id, sent_at DESC);

-- 알림 피로도 계산: 오늘 사용자에게 발송된 알림 건수 조회
CREATE INDEX idx_notifications_user_today
    ON notifications (user_id, sent_at)
    WHERE sent_at >= CURRENT_DATE;  -- 부분 인덱스 (당일 데이터만)
    -- 주의: CURRENT_DATE는 동적이므로 실제로는 애플리케이션에서 날짜 조건 처리

-- WatchItem별 마지막 알림 시각 (쿨다운 정책 체크)
CREATE INDEX idx_notifications_watch_item_type
    ON notifications (watch_item_id, notification_type, sent_at DESC);

-- ---- destinations ----

-- 여행지 검색 자동완성 (pg_trgm 기반 한글/영문 유사도 검색)
CREATE INDEX idx_destinations_name_ko_trgm
    ON destinations USING GIN (name_ko gin_trgm_ops);

CREATE INDEX idx_destinations_name_en_trgm
    ON destinations USING GIN (name_en gin_trgm_ops);

-- 공항 코드로 여행지 조회
CREATE INDEX idx_destinations_airport_codes
    ON destinations USING GIN (airport_codes);

-- ---- bookings ----

-- 사용자 예약 내역 조회
CREATE INDEX idx_bookings_user
    ON bookings (user_id, booked_at DESC);

-- 알림 어트리뷰션 분석
CREATE INDEX idx_bookings_notification
    ON bookings (notification_id)
    WHERE notification_id IS NOT NULL;


-- =============================================================================
-- SECTION 12: Continuous Aggregate 뷰 (TimescaleDB)
--
-- 설계 목적:
-- - 실시간 집계 쿼리(AVG, MIN, MAX)는 전체 청크 스캔 필요 → 비용 높음
-- - Continuous Aggregate: 물질화된 뷰를 자동으로 증분 갱신
-- - 하위 쿼리에서 이 뷰를 사용하면 이미 집계된 결과를 읽기만 함
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 12-1. 일별 가격 통계 집계 (Daily Price Stats)
--
-- 용도:
-- - 30일/90일 가격 차트 (UI의 선 그래프)
-- - BookingScore 계산 (역대 최저가 판단)
-- - 이동평균 계산 기반 데이터
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW price_daily_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', recorded_at)  AS bucket_day,     -- 1일 단위 버킷
    watch_item_id,
    product_type,
    MIN(normalized_price)              AS min_price,       -- 일별 최저가
    MAX(normalized_price)              AS max_price,       -- 일별 최고가
    AVG(normalized_price)              AS avg_price,       -- 일별 평균가
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY normalized_price) AS p25_price, -- 1사분위
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY normalized_price) AS p75_price, -- 3사분위
    COUNT(*)                           AS sample_count,    -- 일별 수집 횟수
    BOOL_OR(is_sold_out = FALSE)       AS had_available    -- 해당 일에 재고 있었는지
FROM price_history
WHERE is_sold_out = FALSE  -- 판매 불가 데이터 제외
GROUP BY bucket_day, watch_item_id, product_type
WITH NO DATA;  -- 초기 채우기는 정책에 위임

COMMENT ON MATERIALIZED VIEW price_daily_stats IS 'TimescaleDB Continuous Aggregate: 일별 가격 통계. 차트 렌더링 및 BookingScore 계산용';

-- 자동 갱신 정책: 1시간마다 최근 3일치 재집계 (신규 데이터 반영)
SELECT add_continuous_aggregate_policy(
    'price_daily_stats',
    start_offset   => INTERVAL '3 days',  -- 갱신 시작 오프셋
    end_offset     => INTERVAL '1 hour',  -- 갱신 종료 오프셋 (최근 1시간은 제외 → 청크 안정화)
    schedule_interval => INTERVAL '1 hour',
    if_not_exists  => TRUE
);


-- -----------------------------------------------------------------------------
-- 12-2. 주별 가격 통계 집계 (Weekly Price Stats)
--
-- 용도:
-- - 90일 이상 장기 추세 분석
-- - 계절성 패턴 감지 (BookingScore 15점: 전년 동기 대비 비교)
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW price_weekly_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 week', recorded_at)  AS bucket_week,
    watch_item_id,
    product_type,
    MIN(normalized_price)               AS min_price,
    MAX(normalized_price)               AS max_price,
    AVG(normalized_price)               AS avg_price,
    STDDEV(normalized_price)            AS stddev_price, -- 표준편차 (이상값 탐지용)
    COUNT(*)                            AS sample_count
FROM price_history
WHERE is_sold_out = FALSE
GROUP BY bucket_week, watch_item_id, product_type
WITH NO DATA;

COMMENT ON MATERIALIZED VIEW price_weekly_stats IS 'TimescaleDB Continuous Aggregate: 주별 가격 통계. 장기 추세 및 계절성 분석용';

SELECT add_continuous_aggregate_policy(
    'price_weekly_stats',
    start_offset      => INTERVAL '2 weeks',
    end_offset        => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists     => TRUE
);


-- =============================================================================
-- SECTION 13: 핵심 쿼리 예시
-- =============================================================================

-- =============================================================================
-- [Query 1] WatchItem별 현재 최저가 조회 (유형별)
--
-- 용도: 홈 화면 / 마이페이지 WatchItem 카드 렌더링
-- 성능: price_history Hypertable + idx_price_history_watch_item_type 사용
--       current_best_snapshot 캐시가 있으면 이 쿼리 대신 캐시 사용 권장
-- =============================================================================
/*
SELECT
    ph.product_type,
    ph.provider,
    ph.normalized_price,
    ph.total_price,
    ph.price_per_person,
    ph.available_seats,
    ph.deep_link_url,
    ph.recorded_at
FROM price_history ph
WHERE ph.watch_item_id = $1                          -- 조회 대상 WatchItem UUID
  AND ph.is_sold_out   = FALSE
  AND ph.recorded_at  >= NOW() - INTERVAL '6 hours' -- 최근 6시간 내 수집 데이터만
  AND ph.normalized_price = (
      SELECT MIN(ph2.normalized_price)
      FROM   price_history ph2
      WHERE  ph2.watch_item_id = $1
        AND  ph2.product_type  = ph.product_type
        AND  ph2.is_sold_out   = FALSE
        AND  ph2.recorded_at  >= NOW() - INTERVAL '6 hours'
  )
ORDER BY ph.product_type, ph.recorded_at DESC;
*/


-- =============================================================================
-- [Query 2] 특정 WatchItem의 가격 추이 (30일 / 90일)
--
-- 용도: 상세 화면 가격 차트 (라인 그래프)
-- 성능: price_daily_stats Continuous Aggregate 사용 → 즉시 응답
-- =============================================================================
/*
-- 30일 일별 최저가 추이
SELECT
    bucket_day,
    product_type,
    min_price,
    avg_price,
    max_price,
    sample_count
FROM price_daily_stats
WHERE watch_item_id = $1
  AND product_type  = $2                               -- 'FLIGHT' | 'HOTEL' | 'AIRTEL' | 'PACKAGE'
  AND bucket_day   >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY bucket_day ASC;

-- 90일 주별 추이 (장기 트렌드)
SELECT
    bucket_week,
    product_type,
    min_price,
    avg_price,
    stddev_price,
    sample_count
FROM price_weekly_stats
WHERE watch_item_id = $1
  AND product_type  = $2
  AND bucket_week  >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY bucket_week ASC;
*/


-- =============================================================================
-- [Query 3] 알림 발송 조건 체크 쿼리
--
-- 용도: 가격 하락 탐지 워커에서 알림 발송 여부 판단
-- 성능: price_daily_stats 집계 뷰 + 최신 raw 데이터 조합
--
-- 로직:
-- 1) 현재 최저가 vs 사용자 등록 시점 가격 → threshold% 이상 하락?
-- 2) 현재 최저가 vs 90일 내 최저가 → 역대 최저가?
-- 3) 마지막 알림 발송 후 쿨다운 시간 경과했는가?
-- =============================================================================
/*
WITH
-- 현재 최저가 (최근 6시간 수집분)
current_min AS (
    SELECT
        watch_item_id,
        product_type,
        MIN(normalized_price) AS current_price,
        MIN(available_seats)  AS min_seats
    FROM   price_history
    WHERE  watch_item_id = $1
      AND  product_type  = $2
      AND  is_sold_out   = FALSE
      AND  recorded_at  >= NOW() - INTERVAL '6 hours'
    GROUP BY watch_item_id, product_type
),
-- 90일 통계 (Continuous Aggregate 활용)
hist_stats AS (
    SELECT
        watch_item_id,
        product_type,
        MIN(min_price)  AS all_time_low_90d,
        AVG(avg_price)  AS avg_90d,
        STDDEV(stddev_price) AS stddev_90d   -- 이동평균용 근사치
    FROM   price_daily_stats
    WHERE  watch_item_id = $1
      AND  product_type  = $2
      AND  bucket_day   >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY watch_item_id, product_type
),
-- 마지막 알림 발송 시각 (쿨다운 체크)
last_notif AS (
    SELECT MAX(sent_at) AS last_sent_at
    FROM   notifications
    WHERE  watch_item_id      = $1
      AND  notification_type IN ('PRICE_DROP', 'ALL_TIME_LOW', 'LOW_AVAILABILITY')
)
SELECT
    cm.current_price,
    hs.all_time_low_90d,
    hs.avg_90d,

    -- 조건 1: 임계값 이상 가격 하락 (WatchItem 설정에서 threshold 읽어야 함)
    -- 아래는 항공권 기본 10% 예시
    CASE WHEN cm.current_price < hs.avg_90d * 0.90 THEN TRUE ELSE FALSE END AS is_below_threshold,

    -- 조건 2: 역대 최저가 (90일 기준)
    CASE WHEN cm.current_price <= hs.all_time_low_90d THEN TRUE ELSE FALSE END AS is_all_time_low,

    -- 조건 3: 잔여 좌석 희소 (5석 이하)
    CASE WHEN cm.min_seats IS NOT NULL AND cm.min_seats <= 5 THEN TRUE ELSE FALSE END AS is_low_availability,

    -- 쿨다운 통과 여부 (항공권: 6시간)
    CASE WHEN ln.last_sent_at IS NULL
              OR ln.last_sent_at < NOW() - INTERVAL '6 hours'
         THEN TRUE ELSE FALSE END AS cooldown_passed,

    ln.last_sent_at
FROM      current_min cm
JOIN      hist_stats  hs ON cm.watch_item_id = hs.watch_item_id AND cm.product_type = hs.product_type
LEFT JOIN last_notif  ln ON TRUE;
*/


-- =============================================================================
-- [Query 4] BookingScore 계산용 통계 쿼리
--
-- 용도: WatchItem 상세 화면의 "지금 예약하기 좋은 타이밍" 점수 산출
-- 성능: price_daily_stats + price_weekly_stats 조합 (모두 물질화된 뷰)
--
-- BookingScore 구성 (총 100점):
--   30점 - 역대 최저가 여부  (최근 90일 하위 10%)
--   20점 - 가격 하락 추세    (7일 이동평균 하향)
--   20점 - 잔여 좌석 희소성  (5석 이하)
--   15점 - 출발 최적 예약 시점 (항공: 6~8주 전 / 호텔: 3~4주 전)
--   15점 - 계절성 (전년 동기 대비 저렴)
-- =============================================================================
/*
WITH
-- 여행 출발일 정보 (WatchItem에서 읽어야 하지만 예시용 파라미터)
params AS (
    SELECT
        $1::UUID            AS watch_item_id,
        $2::product_type    AS product_type,
        $3::DATE            AS departure_date,
        $4::INTEGER         AS current_price  -- 현재 최저가 (Query 1 결과)
),
-- 90일 일별 통계
stats_90d AS (
    SELECT
        MIN(min_price)  AS low_90d,
        MAX(max_price)  AS high_90d,
        AVG(avg_price)  AS avg_90d,
        PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY min_price) AS p10_90d
    FROM   price_daily_stats pds, params p
    WHERE  pds.watch_item_id = p.watch_item_id
      AND  pds.product_type  = p.product_type
      AND  pds.bucket_day   >= CURRENT_DATE - INTERVAL '90 days'
),
-- 7일 이동평균 (최근 7일 vs 직전 7일 비교로 추세 판단)
trend_7d AS (
    SELECT
        AVG(CASE WHEN bucket_day >= CURRENT_DATE - INTERVAL '7 days'  THEN avg_price END) AS avg_recent_7d,
        AVG(CASE WHEN bucket_day  < CURRENT_DATE - INTERVAL '7 days'
                  AND bucket_day >= CURRENT_DATE - INTERVAL '14 days' THEN avg_price END) AS avg_prev_7d
    FROM   price_daily_stats pds, params p
    WHERE  pds.watch_item_id = p.watch_item_id
      AND  pds.product_type  = p.product_type
      AND  pds.bucket_day   >= CURRENT_DATE - INTERVAL '14 days'
),
-- 현재 최저가 잔여 좌석 (price_history raw 조회)
seats AS (
    SELECT MIN(available_seats) AS min_seats
    FROM   price_history ph, params p
    WHERE  ph.watch_item_id = p.watch_item_id
      AND  ph.product_type  = p.product_type
      AND  ph.is_sold_out   = FALSE
      AND  ph.recorded_at  >= NOW() - INTERVAL '6 hours'
)
SELECT
    p.current_price,
    s90.low_90d,
    s90.avg_90d,
    s90.p10_90d,

    -- ① 역대 최저가 점수 (30점)
    CASE
        WHEN p.current_price <= s90.p10_90d THEN 30  -- 하위 10% 이하
        WHEN p.current_price <= s90.low_90d * 1.05 THEN 20  -- 최저가 5% 이내
        WHEN p.current_price <= s90.avg_90d * 0.9  THEN 10  -- 평균 대비 10% 저렴
        ELSE 0
    END AS score_lowest_price,

    -- ② 가격 하락 추세 점수 (20점)
    CASE
        WHEN t7.avg_recent_7d < t7.avg_prev_7d * 0.95 THEN 20  -- 5% 이상 하락 추세
        WHEN t7.avg_recent_7d < t7.avg_prev_7d         THEN 10  -- 소폭 하락
        ELSE 0
    END AS score_trend,

    -- ③ 잔여 좌석 희소성 점수 (20점)
    CASE
        WHEN se.min_seats IS NOT NULL AND se.min_seats <= 3 THEN 20
        WHEN se.min_seats IS NOT NULL AND se.min_seats <= 5 THEN 15
        WHEN se.min_seats IS NOT NULL AND se.min_seats <= 10 THEN 5
        ELSE 0
    END AS score_availability,

    -- ④ 최적 예약 시점 점수 (15점): 상품 유형별 최적 시점 기준 적용
    CASE
        WHEN p.product_type = 'FLIGHT' AND
             (p.departure_date - CURRENT_DATE) BETWEEN 42 AND 56 THEN 15  -- 항공: 6~8주 전
        WHEN p.product_type = 'HOTEL' AND
             (p.departure_date - CURRENT_DATE) BETWEEN 21 AND 28 THEN 15  -- 호텔: 3~4주 전
        WHEN p.product_type IN ('AIRTEL','PACKAGE') AND
             (p.departure_date - CURRENT_DATE) BETWEEN 30 AND 60 THEN 15
        ELSE 5  -- 시점 벗어나도 기본 5점
    END AS score_timing,

    -- ⑤ 계절성 점수 (15점): 전년 동기 대비 비교는 price_weekly_stats 52주 이전 버킷과 비교
    --    (구현 복잡도 감안, 애플리케이션에서 처리 권장)
    0 AS score_seasonality,  -- placeholder

    -- 총점
    (
        CASE WHEN p.current_price <= s90.p10_90d THEN 30
             WHEN p.current_price <= s90.low_90d * 1.05 THEN 20
             WHEN p.current_price <= s90.avg_90d * 0.9  THEN 10 ELSE 0 END
        +
        CASE WHEN t7.avg_recent_7d < t7.avg_prev_7d * 0.95 THEN 20
             WHEN t7.avg_recent_7d < t7.avg_prev_7d         THEN 10 ELSE 0 END
        +
        CASE WHEN se.min_seats IS NOT NULL AND se.min_seats <= 3 THEN 20
             WHEN se.min_seats IS NOT NULL AND se.min_seats <= 5 THEN 15
             WHEN se.min_seats IS NOT NULL AND se.min_seats <= 10 THEN 5 ELSE 0 END
        +
        CASE WHEN p.product_type = 'FLIGHT'
                  AND (p.departure_date - CURRENT_DATE) BETWEEN 42 AND 56 THEN 15
             WHEN p.product_type = 'HOTEL'
                  AND (p.departure_date - CURRENT_DATE) BETWEEN 21 AND 28 THEN 15
             WHEN p.product_type IN ('AIRTEL','PACKAGE')
                  AND (p.departure_date - CURRENT_DATE) BETWEEN 30 AND 60 THEN 15
             ELSE 5 END
    ) AS booking_score

FROM params p, stats_90d s90, trend_7d t7, seats se;
*/


-- =============================================================================
-- [Query 5] 항공사 프로모션 WatchItem 매칭 쿼리
--
-- 용도: 새 프로모션 수집 시 해당 프로모션과 매칭되는 WatchItem 탐색
-- 성능: GIN 인덱스 (destination jsonb_path_ops, watched_product_types)
--       + Partial 인덱스 (status = 'ACTIVE')
--
-- 매칭 조건:
--   1) WatchItem 목적지 공항 코드 ∈ 프로모션 도착지 목록
--   2) WatchItem이 FLIGHT 유형을 모니터링 중
--   3) WatchItem 알림 설정에서 해당 프로모션 유형 허용
-- =============================================================================
/*
SELECT
    wi.id                AS watch_item_id,
    wi.user_id,
    wi.notification_settings,
    wi.destination
FROM  watch_items wi
WHERE wi.status     = 'ACTIVE'
  AND wi.deleted_at IS NULL
  AND 'FLIGHT' = ANY(wi.watched_product_types) -- FLIGHT 유형 모니터링 중

  -- 목적지 공항 코드 매칭: WatchItem destination.airportCodes 배열이
  -- 프로모션 routes 내 destination과 겹치는 경우
  AND EXISTS (
      SELECT 1
      FROM   jsonb_array_elements_text(wi.destination->'airportCodes') AS airport_code
      WHERE  airport_code IN (
          SELECT DISTINCT route->>'destination'
          FROM   jsonb_array_elements($1::JSONB) AS route  -- 프로모션 routes JSONB 파라미터
      )
  )

  -- 프로모션 유형 허용 여부 (notificationSettings.promotionAlerts.allowedPromotionTypes 체크)
  AND wi.notification_settings->'promotionAlerts'->>'isEnabled' = 'true'
  AND (
      -- watchedAirlines 빈 배열이면 전체 허용
      jsonb_array_length(wi.notification_settings->'promotionAlerts'->'watchedAirlines') = 0
      OR wi.notification_settings->'promotionAlerts'->'watchedAirlines' @> to_jsonb($2::TEXT) -- 항공사 코드
  )
ORDER BY wi.created_at DESC
LIMIT 1000;  -- 한 번에 최대 1000개 배치 처리
*/


-- =============================================================================
-- SECTION 14: 유지보수 보조 함수 및 트리거
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 14-1. updated_at 자동 갱신 트리거 함수
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 부착
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_watch_items_updated_at
    BEFORE UPDATE ON watch_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_destinations_updated_at
    BEFORE UPDATE ON destinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_flight_conditions_updated_at
    BEFORE UPDATE ON flight_conditions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_hotel_conditions_updated_at
    BEFORE UPDATE ON hotel_conditions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_airtel_conditions_updated_at
    BEFORE UPDATE ON airtel_conditions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_package_conditions_updated_at
    BEFORE UPDATE ON package_conditions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_airline_promotions_updated_at
    BEFORE UPDATE ON airline_promotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- -----------------------------------------------------------------------------
-- 14-2. WatchItem 상태 자동 만료 함수
-- 용도: 스케줄러 배치 잡에서 호출. 여행 기간이 지난 WatchItem을 EXPIRED 처리
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_old_watch_items()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE watch_items
        SET    status     = 'EXPIRED',
               updated_at = NOW()
        WHERE  status     = 'ACTIVE'
          AND  deleted_at IS NULL
          -- wish_months 중 마지막 달이 지났으면 만료
          -- (정확한 종료일은 travel_condition JSONB에서 추출)
          AND  (travel_condition->'wishMonths'->>-1)::SMALLINT
               < EXTRACT(MONTH FROM CURRENT_DATE)
               -- 단순화: 실제로는 연도 + 월 복합 비교 필요 (애플리케이션 레벨 보완)
        RETURNING id
    )
    SELECT COUNT(*) INTO expired_count FROM expired;

    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_old_watch_items() IS '여행 희망 월이 경과한 ACTIVE WatchItem을 EXPIRED로 자동 전환. 스케줄러 배치 잡에서 일 1회 호출.';


-- -----------------------------------------------------------------------------
-- 14-3. 항공사 프로모션 만료 처리 함수
-- 용도: sale_ends_at 경과한 프로모션을 is_active=FALSE로 배치 처리
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deactivate_expired_promotions()
RETURNS INTEGER AS $$
DECLARE
    deactivated_count INTEGER;
BEGIN
    WITH deactivated AS (
        UPDATE airline_promotions
        SET    is_active   = FALSE,
               updated_at  = NOW()
        WHERE  is_active   = TRUE
          AND  sale_ends_at < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO deactivated_count FROM deactivated;

    RETURN deactivated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION deactivate_expired_promotions() IS '판매 기간이 종료된 항공사 프로모션을 비활성화. 스케줄러에서 15분 주기 호출 권장.';


-- =============================================================================
-- SECTION 15: Row Level Security (RLS) - 멀티테넌트 데이터 격리
--
-- 설계 원칙: 최소 권한(Least Privilege) - 사용자는 본인 데이터만 접근 가능
-- Neon에서는 Connection Pooler를 통해 app_user 역할을 사용
-- JWT 클레임(sub)을 current_setting()으로 전달하는 방식 사용
-- =============================================================================

-- RLS 활성화
ALTER TABLE watch_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;

-- 애플리케이션 역할 (Neon 환경에서는 DB 접속 역할)
-- CREATE ROLE app_user; -- Neon 프로젝트 설정에서 관리

-- watch_items: 본인 데이터만 읽기/쓰기
CREATE POLICY watch_items_user_isolation ON watch_items
    USING (user_id = (current_setting('app.current_user_id', TRUE))::UUID);

-- notifications: 본인에게 발송된 알림만
CREATE POLICY notifications_user_isolation ON notifications
    USING (user_id = (current_setting('app.current_user_id', TRUE))::UUID);

-- bookings: 본인 예약만
CREATE POLICY bookings_user_isolation ON bookings
    USING (user_id = (current_setting('app.current_user_id', TRUE))::UUID);

-- users: 본인 프로필만 (관리자는 별도 정책)
CREATE POLICY users_self_only ON users
    USING (id = (current_setting('app.current_user_id', TRUE))::UUID);

COMMENT ON POLICY watch_items_user_isolation ON watch_items
    IS 'RLS: 사용자는 본인의 WatchItem만 접근 가능. 앱에서 SET LOCAL app.current_user_id = <uuid> 실행 필요.';


-- =============================================================================
-- SECTION 16: 파티셔닝 전략 검토 노트
--
-- [price_history]
--   → TimescaleDB Hypertable로 처리. 별도 PostgreSQL 파티셔닝 불필요.
--   → Hypertable이 시간 + 공간 2차원 파티셔닝을 내부적으로 관리.
--
-- [notifications]
--   → 서비스 초기(~1년): 단일 테이블로 충분.
--   → 규모 확장 시(알림 건수 연간 1억 건 이상):
--      PARTITION BY RANGE (sent_at) 적용으로 월별 파티셔닝 전환 권고.
--      아래는 향후 마이그레이션 가이드:
--
--    CREATE TABLE notifications_new (LIKE notifications INCLUDING ALL)
--    PARTITION BY RANGE (sent_at);
--
--    CREATE TABLE notifications_2026_01 PARTITION OF notifications_new
--    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
--    -- (월별 파티션 자동 생성 배치 필요)
--
-- [airline_promotions]
--   → 프로모션은 단기 수명 데이터. is_active=FALSE 건을 정기적으로 아카이브
--      테이블로 이동하는 전략이 파티셔닝보다 운영 단순성 면에서 유리.
-- =============================================================================


-- =============================================================================
-- SECTION 17: 성능 모니터링 보조 뷰
-- =============================================================================

-- 슬로우 쿼리 분석용 인덱스 사용률 확인 뷰
CREATE VIEW v_index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan        AS index_scans,
    idx_tup_read    AS tuples_read,
    idx_tup_fetch   AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

COMMENT ON VIEW v_index_usage IS '인덱스별 스캔 횟수 및 크기 모니터링. 스캔 횟수 0인 인덱스는 제거 검토.';


-- 테이블 크기 및 데드 튜플 모니터링 뷰 (VACUUM 스케줄링 판단용)
CREATE VIEW v_table_bloat AS
SELECT
    schemaname,
    relname           AS tablename,
    n_live_tup        AS live_rows,
    n_dead_tup        AS dead_rows,
    ROUND(n_dead_tup::NUMERIC / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) AS dead_ratio_pct,
    last_vacuum,
    last_autovacuum,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS total_size
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

COMMENT ON VIEW v_table_bloat IS '테이블별 데드 튜플 비율 및 VACUUM 이력. dead_ratio_pct > 20% 시 수동 VACUUM 검토.';


-- WatchItem 모니터링 큐 상태 (스케줄러 건강도 확인)
CREATE VIEW v_monitor_queue_status AS
SELECT
    status,
    COUNT(*)                                                          AS count,
    COUNT(*) FILTER (WHERE next_monitor_at < NOW())                   AS overdue,
    COUNT(*) FILTER (WHERE next_monitor_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour') AS due_soon,
    AVG(monitoring_count)                                             AS avg_monitoring_count,
    MAX(last_monitored_at)                                            AS most_recent_check
FROM watch_items
WHERE deleted_at IS NULL
GROUP BY status;

COMMENT ON VIEW v_monitor_queue_status IS '모니터링 큐 상태 대시보드. overdue > 0이면 워커 장애 점검 필요.';


-- =============================================================================
-- 스키마 생성 완료
-- =============================================================================
-- 생성된 객체 요약:
--   ENUM 타입      : 13개 (product_type, trip_type, fare_class 등)
--   테이블         : 11개 (users, destinations, watch_items, *_conditions×4,
--                          price_history, airline_promotions, notifications, bookings)
--   Hypertable     : 1개 (price_history)
--   압축 정책       : 1개 (90일 이후)
--   보존 정책       : 1개 (1년 이후 삭제)
--   Cont. Aggregate: 2개 (price_daily_stats, price_weekly_stats)
--   인덱스         : 19개 (복합, 부분, GIN 포함)
--   트리거         : 9개 (updated_at 자동 갱신)
--   함수           : 3개 (update_updated_at_column, expire_old_watch_items,
--                          deactivate_expired_promotions)
--   RLS 정책       : 4개 (users, watch_items, notifications, bookings)
--   모니터링 뷰    : 3개 (v_index_usage, v_table_bloat, v_monitor_queue_status)
-- =============================================================================
