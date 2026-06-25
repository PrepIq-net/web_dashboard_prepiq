"use client";

import { OnboardingStep, useOnboardingStore } from "../store";

const STEPS = [
  {
    label: "Identity",
    description: "Workspace basics",
    step: OnboardingStep.IDENTITY,
  },
  {
    label: "Operations",
    description: "Kitchen details",
    step: OnboardingStep.OPERATIONS,
  },
  {
    label: "Contact",
    description: "Communication",
    step: OnboardingStep.CONTACT,
  },
  {
    label: "Review",
    description: "Confirm & create",
    step: OnboardingStep.REVIEW,
  },
];

export function StepIndicator({
  currentStep,
}: {
  currentStep: OnboardingStep;
}) {
  const { setStep } = useOnboardingStore();

  return (
    <nav className="flex flex-row md:flex-col gap-4 md:gap-10">
      {STEPS.map((step, idx) => {
        const isActive = currentStep === step.step;
        const isCompleted = currentStep > step.step;

        return (
          <div
            key={step.step}
            onClick={() => isCompleted && setStep(step.step)}
            className={`flex flex-col md:flex-row items-center md:items-start gap-3 transition-opacity duration-300 ${
              isCompleted ? "cursor-pointer" : "cursor-default"
            } ${
              isActive
                ? "opacity-100"
                : isCompleted
                  ? "opacity-70 hover:opacity-90"
                  : "opacity-35"
            }`}
          >
            <div className="relative flex flex-col items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold border transition-all duration-300 ${
                  isActive
                    ? "border-brand-gold bg-brand-gold text-surface-1 shadow-[0_0_15px_rgba(168,130,31,0.4)]"
                    : isCompleted
                      ? "border-brand-gold bg-brand-gold text-surface-1"
                      : "border-text-muted/30 bg-transparent text-text-muted"
                }`}
              >
                {isCompleted ? "✓" : idx + 1}
              </span>

              {/* Vertical line connecting steps (hidden on mobile) */}
              {idx < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 bottom-[-40px] left-1/2 w-px bg-border-default/50" />
              )}
            </div>

            <div className="hidden md:flex flex-col gap-0.5 text-left">
              <span
                className={`text-sm font-semibold uppercase tracking-widest ${
                  isActive ? "text-brand-gold" : "text-text-primary"
                }`}
              >
                {step.label}
              </span>
              <span className="text-[11px] text-text-muted font-medium">
                {step.description}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
