'use client';

interface Step {
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number; // 1-based
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="relative flex items-start justify-between">
      {/* 연결선 */}
      <div
        className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200"
        style={{ zIndex: 0 }}
      />
      {/* 진행된 연결선 */}
      <div
        className="absolute top-4 left-0 h-0.5 bg-amber-400 transition-all duration-500"
        style={{
          zIndex: 1,
          width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
        }}
      />

      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <div
            key={stepNumber}
            className="relative flex flex-1 flex-col items-center"
            style={{ zIndex: 2 }}
          >
            {/* 원형 스텝 버튼 */}
            <div
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300',
                isCompleted
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : isCurrent
                  ? 'border-amber-500 bg-white text-amber-600 shadow-md shadow-amber-100'
                  : 'border-slate-300 bg-white text-slate-400',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isCompleted ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                stepNumber
              )}
            </div>

            {/* 스텝 라벨 */}
            <div className="mt-2 text-center">
              <p
                className={[
                  'text-xs font-semibold',
                  isCurrent ? 'text-amber-600' : isCompleted ? 'text-amber-500' : 'text-slate-400',
                ].join(' ')}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="mt-0.5 text-[10px] text-slate-400">{step.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
