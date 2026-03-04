'use client';

type Step = 'upload' | 'processing' | 'configure' | 'replay';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'processing', label: 'Processing' },
  { key: 'configure', label: 'Configure' },
  { key: 'replay', label: 'Replay' },
];

interface StepperProps {
  current: Step;
}

export function Stepper({ current }: StepperProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-8 h-px mx-1 ${
                  isComplete ? 'bg-blue-400' : 'bg-zinc-200'
                }`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  isCurrent
                    ? 'bg-blue-500 text-white'
                    : isComplete
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-zinc-100 text-zinc-400'
                }`}
              >
                {isComplete ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isCurrent ? 'text-blue-700' : isComplete ? 'text-blue-500' : 'text-zinc-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
