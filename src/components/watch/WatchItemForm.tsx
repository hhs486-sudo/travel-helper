'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  WatchItemFormData,
  WatchItemFormStep,
  CreateWatchItemRequest,
} from '@/types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/types';
import StepIndicator from '@/components/ui/StepIndicator';
import Step1Destination from '@/components/watch/Step1Destination';
import Step2TravelCondition from '@/components/watch/Step2TravelCondition';
import Step3ProductType from '@/components/watch/Step3ProductType';
import { useCreateWatchItem } from '@/hooks/useWatchItems';

// -----------------------------------------------------------------------
// 기본값
// -----------------------------------------------------------------------
const INITIAL_FORM_DATA: WatchItemFormData = {
  step1: {
    destination: null,
    origin: { cityCode: '', airportCodes: [] },
  },
  step2: {
    wishMonths: [],
    durationRange: { min: 3, max: 7 },
    flexibleDays: 0,
    adults: 2,
    children: 0,
    infants: 0,
    maxPerPerson: 1500000,
    isBudgetFlexible: false,
  },
  step3: {
    watchedProductTypes: [],
    flightCondition: {
      tripType: 'ROUND_TRIP',
      maxStopover: 1,
      preferredAirlines: [],
      fareClasses: ['ECONOMY'],
      checkedBaggageRequired: false,
    },
    hotelCondition: {
      minStarRating: 3,
      minReviewScore: 7,
      breakfastRequired: false,
      freeCancellationOnly: false,
      preferredAreas: [],
    },
    airtelCondition: {
      preferredProviders: [],
      hotelMinStar: 3,
      departureGuaranteedOnly: false,
    },
    packageCondition: {
      guideRequired: false,
      minMealsPerDay: 0,
      freeCancellationDays: 0,
    },
  },
};

const STEPS = [
  { label: '여행지', description: '출발지·목적지' },
  { label: '여행 조건', description: '기간·인원·예산' },
  { label: '상품 유형', description: '항공·호텔 등' },
];

// -----------------------------------------------------------------------
// 폼 데이터 → API 요청 DTO 변환
// -----------------------------------------------------------------------
function buildCreateRequest(form: WatchItemFormData): CreateWatchItemRequest {
  const { step1, step2, step3 } = form;

  if (!step1.destination) throw new Error('목적지를 입력해주세요.');

  const request: CreateWatchItemRequest = {
    destination: step1.destination,
    origin: step1.origin,
    travel_condition: {
      wishMonths: step2.wishMonths,
      durationRange: step2.durationRange,
      flexibleDays: step2.flexibleDays,
      pax: {
        adults: step2.adults,
        children: step2.children,
        infants: step2.infants,
      },
      budget: {
        maxPerPerson: step2.maxPerPerson,
        isFlexible: step2.isBudgetFlexible,
      },
    },
    watched_product_types: step3.watchedProductTypes,
    notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
  };

  // 선택된 상품 유형에 따라 세부 조건 추가
  if (step3.watchedProductTypes.includes('FLIGHT')) {
    request.flight_condition = step3.flightCondition;
  }
  if (step3.watchedProductTypes.includes('HOTEL')) {
    request.hotel_condition = step3.hotelCondition;
  }
  if (step3.watchedProductTypes.includes('AIRTEL')) {
    request.airtel_condition = step3.airtelCondition;
  }
  if (step3.watchedProductTypes.includes('PACKAGE')) {
    request.package_condition = step3.packageCondition;
  }

  return request;
}

// -----------------------------------------------------------------------
// 메인 컴포넌트
// -----------------------------------------------------------------------
export default function WatchItemForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WatchItemFormStep>(1);
  const [formData, setFormData] = useState<WatchItemFormData>(INITIAL_FORM_DATA);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useCreateWatchItem();

  function handleNext() {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as WatchItemFormStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WatchItemFormStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handleSubmit() {
    setSubmitError(null);
    try {
      const payload = buildCreateRequest(formData);
      await createMutation.mutateAsync(payload);
      router.push('/');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : '등록 중 오류가 발생했습니다. 다시 시도해주세요.'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-sky-50 px-4 py-6">
      <div className="mx-auto max-w-lg">
        {/* 헤더 */}
        <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-2xl shadow-lg shadow-amber-200">
            ✈️
          </div>
          <h1 className="mt-3 text-xl font-extrabold text-slate-800">
            관심 여행지 등록
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            조건을 설정하면 가격 변동을 실시간으로 알려드려요.
          </p>
        </div>

        {/* 단계 표시기 */}
        <div className="mb-8 rounded-2xl bg-white px-4 py-4 shadow-sm border border-slate-100">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* 에러 메시지 */}
        {submitError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-red-400 mt-0.5">⚠️</span>
            <p className="text-sm text-red-600">{submitError}</p>
          </div>
        )}

        {/* 스텝 콘텐츠 */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          {/* 스텝 제목 */}
          <div className="mb-5 border-b border-slate-100 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
              Step {currentStep} of 3
            </span>
            <h2 className="mt-1 text-lg font-extrabold text-slate-800">
              {currentStep === 1 && '어디로 떠나고 싶으세요?'}
              {currentStep === 2 && '여행 조건을 알려주세요.'}
              {currentStep === 3 && '어떤 상품을 찾고 계신가요?'}
            </h2>
          </div>

          {currentStep === 1 && (
            <Step1Destination
              data={formData.step1}
              onChange={(step1) => setFormData((prev) => ({ ...prev, step1 }))}
              onNext={handleNext}
            />
          )}

          {currentStep === 2 && (
            <Step2TravelCondition
              data={formData.step2}
              onChange={(step2) => setFormData((prev) => ({ ...prev, step2 }))}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {currentStep === 3 && (
            <Step3ProductType
              data={formData.step3}
              onChange={(step3) => setFormData((prev) => ({ ...prev, step3 }))}
              onSubmit={handleSubmit}
              onBack={handleBack}
              isSubmitting={createMutation.isPending}
            />
          )}
        </div>

        {/* 하단 안내 */}
        <p className="mt-4 text-center text-xs text-slate-400">
          등록 후 언제든지 수정하거나 알림을 끌 수 있어요.
        </p>
      </div>
    </div>
  );
}
