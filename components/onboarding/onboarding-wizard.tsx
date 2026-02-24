"use client";

import { useOnboardingStore, OnboardingStep } from "./store";
import { IdentityStep } from "./steps/identity-step";
import { OperationsStep } from "./steps/operations-step";
import { ContactStep } from "./steps/contact-step";
import { ReviewStep } from "./steps/review-step";
import { StepIndicator } from "./components/step-indicator";

export function OnboardingWizard() {
  const { currentStep, direction } = useOnboardingStore();

  const animationClass =
    direction === "forward" ? "animate-step-forward" : "animate-step-backward";

  const renderStep = () => {
    switch (currentStep) {
      case OnboardingStep.IDENTITY:
        return <IdentityStep />;
      case OnboardingStep.OPERATIONS:
        return <OperationsStep />;
      case OnboardingStep.CONTACT:
        return <ContactStep />;
      case OnboardingStep.REVIEW:
        return <ReviewStep />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-12 lg:gap-24">
      {/* Sidebar-style indicator for larger screens, top for mobile */}
      <aside className="w-full md:w-64 shrink-0">
        <StepIndicator currentStep={currentStep} />
      </aside>

      <div className="flex-1 max-w-2xl">
        <div key={currentStep} className={`${animationClass} min-h-[400px]`}>
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
