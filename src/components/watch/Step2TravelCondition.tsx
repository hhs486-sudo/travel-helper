'use client';

import type { Step2FormData } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface Step2TravelConditionProps {
  data: Step2FormData;
  onChange: (data: Step2FormData) => void;
  onNext: () => void;
  onBack: () => void;
}

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const FLEXIBLE_DAYS_OPTIONS = [0, 1, 2, 3, 7];

function NumberStepper({
  label,
  sublabel,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-amber-50 hover:border-amber-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
          </svg>
        </button>
        <span className="w-6 text-center text-base font-bold text-slate-800">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-amber-50 hover:border-amber-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function Step2TravelCondition({
  data,
  onChange,
  onNext,
  onBack,
}: Step2TravelConditionProps) {
  const isValid = data.wishMonths.length > 0 && data.adults >= 1;

  function toggleMonth(month: number) {
    const next = data.wishMonths.includes(month)
      ? data.wishMonths.filter((m) => m !== month)
      : [...data.wishMonths, month].sort((a, b) => a - b);
    onChange({ ...data, wishMonths: next });
  }

  function handleDurationMin(v: number) {
    onChange({
      ...data,
      durationRange: {
        min: v,
        max: Math.max(v, data.durationRange.max),
      },
    });
  }

  function handleDurationMax(v: number) {
    onChange({
      ...data,
      durationRange: {
        min: Math.min(v, data.durationRange.min),
        max: v,
      },
    });
  }

  function formatBudget(value: number): string {
    if (value >= 10000000) return `${(value / 10000000).toFixed(1)}천만원`;
    if (value >= 1000000) return `${(value / 10000).toFixed(0)}만원`;
    return `${value.toLocaleString()}원`;
  }

  return (
    <div className="space-y-5">
      {/* 희망 여행 월 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <span className="text-lg">📅</span>
          희망 여행 월
          <span className="text-xs font-normal text-slate-400">(복수 선택 가능)</span>
        </h3>
        <Card padding="md">
          <div className="grid grid-cols-4 gap-2">
            {MONTH_LABELS.map((label, i) => {
              const month = i + 1;
              const isSelected = data.wishMonths.includes(month);
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => toggleMonth(month)}
                  className={[
                    'rounded-xl py-2.5 text-sm font-semibold transition-all duration-150',
                    isSelected
                      ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                      : 'bg-slate-50 text-slate-500 hover:bg-amber-50 hover:text-amber-600 border border-slate-200',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {data.wishMonths.length > 0 && (
            <p className="mt-3 text-xs text-amber-600 font-medium">
              선택됨: {data.wishMonths.map((m) => MONTH_LABELS[m - 1]).join(', ')}
            </p>
          )}
        </Card>
      </section>

      {/* 여행 기간 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <span className="text-lg">🌙</span>
          여행 기간 (박)
        </h3>
        <Card padding="md">
          <div className="space-y-4">
            <NumberStepper
              label="최소 박수"
              sublabel={`${data.durationRange.min}박 ${data.durationRange.min + 1}일`}
              value={data.durationRange.min}
              min={1}
              max={30}
              onChange={handleDurationMin}
            />
            <div className="h-px bg-slate-100" />
            <NumberStepper
              label="최대 박수"
              sublabel={`${data.durationRange.max}박 ${data.durationRange.max + 1}일`}
              value={data.durationRange.max}
              min={1}
              max={30}
              onChange={handleDurationMax}
            />
          </div>

          {/* 기간 시각화 바 */}
          <div className="mt-4 overflow-hidden rounded-lg bg-slate-100 h-2">
            <div
              className="h-full rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
              style={{
                marginLeft: `${((data.durationRange.min - 1) / 29) * 100}%`,
                width: `${((data.durationRange.max - data.durationRange.min) / 29) * 100 + 3}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-center text-xs text-slate-400">
            {data.durationRange.min}박 ~ {data.durationRange.max}박
          </p>
        </Card>
      </section>

      {/* 날짜 유연성 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <span className="text-lg">🔄</span>
          날짜 유연성
          <span className="text-xs font-normal text-slate-400">(±N일 이내 가격 비교)</span>
        </h3>
        <Card padding="md">
          <div className="flex gap-2">
            {FLEXIBLE_DAYS_OPTIONS.map((days) => {
              const isSelected = data.flexibleDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChange({ ...data, flexibleDays: days })}
                  className={[
                    'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150',
                    isSelected
                      ? 'bg-sky-500 text-white shadow-sm shadow-sky-200'
                      : 'bg-slate-50 text-slate-500 hover:bg-sky-50 hover:text-sky-600 border border-slate-200',
                  ].join(' ')}
                >
                  {days === 0 ? '정확' : `±${days}일`}
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      {/* 인원 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <span className="text-lg">👥</span>
          여행 인원
        </h3>
        <Card padding="md">
          <div className="space-y-4">
            <NumberStepper
              label="성인"
              sublabel="만 12세 이상"
              value={data.adults}
              min={1}
              max={9}
              onChange={(v) => onChange({ ...data, adults: v })}
            />
            <div className="h-px bg-slate-100" />
            <NumberStepper
              label="어린이"
              sublabel="만 2~11세"
              value={data.children}
              min={0}
              max={6}
              onChange={(v) => onChange({ ...data, children: v })}
            />
            <div className="h-px bg-slate-100" />
            <NumberStepper
              label="유아"
              sublabel="만 2세 미만"
              value={data.infants}
              min={0}
              max={data.adults}
              onChange={(v) => onChange({ ...data, infants: v })}
            />
          </div>
        </Card>
      </section>

      {/* 예산 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <span className="text-lg">💰</span>
          1인 최대 예산
        </h3>
        <Card padding="md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">예산 한도</span>
              <span className="text-base font-bold text-emerald-600">
                {formatBudget(data.maxPerPerson)}
              </span>
            </div>
            <input
              type="range"
              min={500000}
              max={10000000}
              step={100000}
              value={data.maxPerPerson}
              onChange={(e) => onChange({ ...data, maxPerPerson: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>50만원</span>
              <span>1,000만원</span>
            </div>

            {/* 직접 입력 */}
            <div className="relative mt-1">
              <input
                type="number"
                value={data.maxPerPerson}
                min={100000}
                step={100000}
                onChange={(e) =>
                  onChange({ ...data, maxPerPerson: Math.max(100000, Number(e.target.value)) })
                }
                className="w-full rounded-xl border border-slate-200 py-2 pl-4 pr-12 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                원
              </span>
            </div>

            {/* 예산 유연성 */}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={data.isBudgetFlexible}
                  onChange={(e) => onChange({ ...data, isBudgetFlexible: e.target.checked })}
                  className="sr-only"
                />
                <div
                  className={[
                    'h-5 w-9 rounded-full transition-colors duration-200',
                    data.isBudgetFlexible ? 'bg-emerald-500' : 'bg-slate-300',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform duration-200',
                      data.isBudgetFlexible ? 'translate-x-4' : 'translate-x-0.5',
                    ].join(' ')}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">예산 유연</p>
                <p className="text-xs text-slate-400">설정 예산 초과 상품도 알림 수신</p>
              </div>
            </label>
          </div>
        </Card>
      </section>

      {/* 버튼 */}
      <div className="flex gap-3">
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
          onClick={onNext}
          className="flex-[2]"
        >
          다음 단계 — 상품 유형 선택
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
