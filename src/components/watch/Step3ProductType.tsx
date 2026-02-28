'use client';

import type {
  Step3FormData,
  ProductType,
  TripType,
  FareClass,
} from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface Step3ProductTypeProps {
  data: Step3FormData;
  onChange: (data: Step3FormData) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

// -----------------------------------------------------------------------
// 상품 유형 카드 메타데이터
// -----------------------------------------------------------------------
const PRODUCT_TYPES: {
  type: ProductType;
  icon: string;
  label: string;
  desc: string;
  color: 'amber' | 'sky' | 'emerald';
}[] = [
  { type: 'FLIGHT', icon: '✈️', label: '항공권', desc: '항공편 가격 모니터링', color: 'sky' },
  { type: 'HOTEL', icon: '🏨', label: '호텔', desc: '숙박 상품 가격 모니터링', color: 'amber' },
  { type: 'AIRTEL', icon: '🛫', label: '에어텔', desc: '항공+호텔 패키지', color: 'emerald' },
  { type: 'PACKAGE', icon: '🧳', label: '패키지', desc: '완전 패키지 여행 상품', color: 'amber' },
];

const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: 'ROUND_TRIP', label: '왕복' },
  { value: 'ONE_WAY', label: '편도' },
  { value: 'OPEN_JAW', label: '오픈조' },
];

const FARE_CLASSES: { value: FareClass; label: string; icon: string }[] = [
  { value: 'ECONOMY', label: '일반석', icon: '💺' },
  { value: 'PREMIUM_ECONOMY', label: '프리미엄 이코노미', icon: '🪑' },
  { value: 'BUSINESS', label: '비즈니스', icon: '🛋️' },
  { value: 'FIRST', label: '일등석', icon: '👑' },
];

// -----------------------------------------------------------------------
// 공통 소(小)컴포넌트
// -----------------------------------------------------------------------

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-600">
      <span>{icon}</span>
      {children}
    </h4>
  );
}

function ToggleChip({
  selected,
  onClick,
  children,
  color = 'sky',
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: 'sky' | 'amber' | 'emerald' | 'violet';
}) {
  const colorMap = {
    sky: selected
      ? 'bg-sky-500 text-white border-sky-500'
      : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300 hover:text-sky-600',
    amber: selected
      ? 'bg-amber-500 text-white border-amber-500'
      : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600',
    emerald: selected
      ? 'bg-emerald-500 text-white border-emerald-500'
      : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-600',
    violet: selected
      ? 'bg-violet-500 text-white border-violet-500'
      : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-150',
        colorMap[color],
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  sublabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
      </div>
      <div className="relative" onClick={() => onChange(!checked)}>
        <div
          className={[
            'h-5 w-9 rounded-full transition-colors duration-200',
            checked ? 'bg-emerald-500' : 'bg-slate-300',
          ].join(' ')}
        >
          <div
            className={[
              'h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform duration-200',
              checked ? 'translate-x-4' : 'translate-x-0.5',
            ].join(' ')}
          />
        </div>
      </div>
    </label>
  );
}

// -----------------------------------------------------------------------
// 세부 조건 섹션 컴포넌트
// -----------------------------------------------------------------------

function FlightConditionPanel({
  data,
  onChange,
}: {
  data: Step3FormData['flightCondition'];
  onChange: (v: Step3FormData['flightCondition']) => void;
}) {
  function toggleFareClass(fc: FareClass) {
    const next = data.fareClasses.includes(fc)
      ? data.fareClasses.filter((c) => c !== fc)
      : [...data.fareClasses, fc];
    onChange({ ...data, fareClasses: next });
  }

  return (
    <Card padding="md" className="border-sky-200 bg-sky-50/50 mt-2">
      <div className="space-y-5">
        {/* 여행 방향 */}
        <div>
          <SectionTitle icon="🔁">여행 방향</SectionTitle>
          <div className="flex gap-2">
            {TRIP_TYPES.map(({ value, label }) => (
              <ToggleChip
                key={value}
                selected={data.tripType === value}
                onClick={() => onChange({ ...data, tripType: value })}
                color="sky"
              >
                {label}
              </ToggleChip>
            ))}
          </div>
        </div>

        {/* 최대 경유 */}
        <div>
          <SectionTitle icon="🔀">최대 경유</SectionTitle>
          <div className="flex gap-2">
            {[0, 1, 2].map((n) => (
              <ToggleChip
                key={n}
                selected={data.maxStopover === n}
                onClick={() => onChange({ ...data, maxStopover: n })}
                color="sky"
              >
                {n === 0 ? '직항만' : `${n}회 이하`}
              </ToggleChip>
            ))}
          </div>
        </div>

        {/* 좌석 등급 */}
        <div>
          <SectionTitle icon="💺">좌석 등급 (복수 선택)</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {FARE_CLASSES.map(({ value, label, icon }) => (
              <ToggleChip
                key={value}
                selected={data.fareClasses.includes(value)}
                onClick={() => toggleFareClass(value)}
                color="sky"
              >
                {icon} {label}
              </ToggleChip>
            ))}
          </div>
        </div>

        {/* 수하물 */}
        <ToggleSwitch
          checked={data.checkedBaggageRequired}
          onChange={(v) => onChange({ ...data, checkedBaggageRequired: v })}
          label="수하물 포함 필수"
          sublabel="위탁 수하물이 포함된 항공편만 검색"
        />
      </div>
    </Card>
  );
}

function HotelConditionPanel({
  data,
  onChange,
}: {
  data: Step3FormData['hotelCondition'];
  onChange: (v: Step3FormData['hotelCondition']) => void;
}) {
  return (
    <Card padding="md" className="border-amber-200 bg-amber-50/50 mt-2">
      <div className="space-y-5">
        {/* 최소 등급 */}
        <div>
          <SectionTitle icon="⭐">최소 호텔 등급</SectionTitle>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onChange({ ...data, minStarRating: star })}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all',
                  data.minStarRating >= star
                    ? 'text-amber-500'
                    : 'text-slate-300 hover:text-amber-300',
                ].join(' ')}
              >
                ★
              </button>
            ))}
            <span className="ml-1 self-center text-xs text-slate-500">
              {data.minStarRating}성 이상
            </span>
          </div>
        </div>

        {/* 최소 리뷰 점수 */}
        <div>
          <SectionTitle icon="📊">최소 리뷰 점수</SectionTitle>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={data.minReviewScore}
              onChange={(e) =>
                onChange({ ...data, minReviewScore: Number(e.target.value) })
              }
              className="flex-1 accent-amber-500"
            />
            <span className="w-10 rounded-lg bg-amber-100 py-1 text-center text-sm font-bold text-amber-700">
              {data.minReviewScore}
            </span>
          </div>
        </div>

        {/* 토글 스위치들 */}
        <div className="space-y-3">
          <ToggleSwitch
            checked={data.breakfastRequired}
            onChange={(v) => onChange({ ...data, breakfastRequired: v })}
            label="조식 포함 필수"
            sublabel="조식이 포함된 객실만 검색"
          />
          <div className="h-px bg-amber-100" />
          <ToggleSwitch
            checked={data.freeCancellationOnly}
            onChange={(v) => onChange({ ...data, freeCancellationOnly: v })}
            label="무료 취소 가능 필수"
            sublabel="무료 취소 조건이 있는 상품만 검색"
          />
        </div>
      </div>
    </Card>
  );
}

function AirtelConditionPanel({
  data,
  onChange,
}: {
  data: Step3FormData['airtelCondition'];
  onChange: (v: Step3FormData['airtelCondition']) => void;
}) {
  return (
    <Card padding="md" className="border-emerald-200 bg-emerald-50/50 mt-2">
      <div className="space-y-5">
        {/* 호텔 최소 등급 */}
        <div>
          <SectionTitle icon="⭐">에어텔 내 호텔 최소 등급</SectionTitle>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onChange({ ...data, hotelMinStar: star })}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all',
                  data.hotelMinStar >= star
                    ? 'text-emerald-500'
                    : 'text-slate-300 hover:text-emerald-300',
                ].join(' ')}
              >
                ★
              </button>
            ))}
            <span className="ml-1 self-center text-xs text-slate-500">
              {data.hotelMinStar}성 이상
            </span>
          </div>
        </div>

        {/* 출발 확정 */}
        <ToggleSwitch
          checked={data.departureGuaranteedOnly}
          onChange={(v) => onChange({ ...data, departureGuaranteedOnly: v })}
          label="출발 확정 상품만"
          sublabel="항공편 출발이 확정된 에어텔만 검색"
        />
      </div>
    </Card>
  );
}

function PackageConditionPanel({
  data,
  onChange,
}: {
  data: Step3FormData['packageCondition'];
  onChange: (v: Step3FormData['packageCondition']) => void;
}) {
  return (
    <Card padding="md" className="border-violet-200 bg-violet-50/50 mt-2">
      <div className="space-y-5">
        {/* 가이드 필수 */}
        <ToggleSwitch
          checked={data.guideRequired}
          onChange={(v) =>
            onChange({ ...data, guideRequired: v, guideLanguage: v ? '한국어' : undefined })
          }
          label="가이드 동반 필수"
          sublabel="한국어 가이드 포함 상품만 검색"
        />

        {/* 무료 취소 기간 */}
        <div>
          <SectionTitle icon="🔓">무료 취소 기간</SectionTitle>
          <p className="mb-2 text-xs text-slate-400">출발 몇 일 전까지 무료 취소 가능한 상품을 원하시나요?</p>
          <div className="flex flex-wrap gap-2">
            {[0, 3, 7, 14, 30].map((days) => (
              <ToggleChip
                key={days}
                selected={data.freeCancellationDays === days}
                onClick={() => onChange({ ...data, freeCancellationDays: days })}
                color="violet"
              >
                {days === 0 ? '조건 없음' : `${days}일 전`}
              </ToggleChip>
            ))}
          </div>
        </div>

        {/* 하루 최소 식사 */}
        <div>
          <SectionTitle icon="🍽️">하루 최소 포함 식사</SectionTitle>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((n) => (
              <ToggleChip
                key={n}
                selected={data.minMealsPerDay === n}
                onClick={() => onChange({ ...data, minMealsPerDay: n })}
                color="violet"
              >
                {n === 0 ? '무관' : `${n}식`}
              </ToggleChip>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------
// 메인 컴포넌트
// -----------------------------------------------------------------------

export default function Step3ProductType({
  data,
  onChange,
  onSubmit,
  onBack,
  isSubmitting,
}: Step3ProductTypeProps) {
  const isValid = data.watchedProductTypes.length > 0;

  function toggleProductType(type: ProductType) {
    const next = data.watchedProductTypes.includes(type)
      ? data.watchedProductTypes.filter((t) => t !== type)
      : [...data.watchedProductTypes, type];
    onChange({ ...data, watchedProductTypes: next });
  }

  return (
    <div className="space-y-5">
      {/* 상품 유형 선택 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <span className="text-lg">🎯</span>
          모니터링할 상품 유형
          <span className="text-xs font-normal text-slate-400">(복수 선택 가능)</span>
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {PRODUCT_TYPES.map(({ type, icon, label, desc, color }) => {
            const isSelected = data.watchedProductTypes.includes(type);
            return (
              <Card
                key={type}
                padding="md"
                hoverable
                selected={isSelected}
                selectedColor={color}
                onClick={() => toggleProductType(type)}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p
                      className={[
                        'text-sm font-bold',
                        isSelected
                          ? color === 'sky'
                            ? 'text-sky-700'
                            : color === 'emerald'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                          : 'text-slate-700',
                      ].join(' ')}
                    >
                      {label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{desc}</p>
                  </div>
                  {isSelected && (
                    <div
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded-full',
                        color === 'sky'
                          ? 'bg-sky-500'
                          : color === 'emerald'
                          ? 'bg-emerald-500'
                          : 'bg-amber-500',
                      ].join(' ')}
                    >
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 선택된 유형별 세부 조건 */}
      {data.watchedProductTypes.includes('FLIGHT') && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold text-sky-600">
            ✈️ 항공권 세부 조건
          </h3>
          <FlightConditionPanel
            data={data.flightCondition}
            onChange={(v) => onChange({ ...data, flightCondition: v })}
          />
        </section>
      )}

      {data.watchedProductTypes.includes('HOTEL') && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold text-amber-600">
            🏨 호텔 세부 조건
          </h3>
          <HotelConditionPanel
            data={data.hotelCondition}
            onChange={(v) => onChange({ ...data, hotelCondition: v })}
          />
        </section>
      )}

      {data.watchedProductTypes.includes('AIRTEL') && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-600">
            🛫 에어텔 세부 조건
          </h3>
          <AirtelConditionPanel
            data={data.airtelCondition}
            onChange={(v) => onChange({ ...data, airtelCondition: v })}
          />
        </section>
      )}

      {data.watchedProductTypes.includes('PACKAGE') && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold text-violet-600">
            🧳 패키지 세부 조건
          </h3>
          <PackageConditionPanel
            data={data.packageCondition}
            onChange={(v) => onChange({ ...data, packageCondition: v })}
          />
        </section>
      )}

      {/* 선택 없을 때 안내 */}
      {data.watchedProductTypes.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-2xl">👆</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            모니터링할 상품 유형을 1개 이상 선택해주세요.
          </p>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          이전
        </Button>
        <Button
          variant="primary"
          size="lg"
          disabled={!isValid}
          isLoading={isSubmitting}
          onClick={onSubmit}
          className="flex-[2]"
        >
          {!isSubmitting && (
            <>
              관심 여행지 등록
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
