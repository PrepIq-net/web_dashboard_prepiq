"use client";

import { create } from "zustand";
import { type OrganizationRegisterPayload } from "@/services/organizations/types";

export enum OnboardingStep {
  IDENTITY = 0,
  OPERATIONS = 1,
  CONTACT = 2,
  REVIEW = 3,
}

interface OnboardingState {
  currentStep: OnboardingStep;
  direction: "forward" | "backward";
  formData: OrganizationRegisterPayload;
  /** Stable object URL for the cropped logo (managed outside formData to avoid re-creation issues). */
  logoPreviewUrl: string | null;
  setLogoPreviewUrl: (url: string | null) => void;
  setStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateData: (data: Partial<OrganizationRegisterPayload>) => void;
  reset: () => void;
}

const initialData: OrganizationRegisterPayload = {
  name: "",
  business_type: "RESTAURANT",
  industry_type: "RESTAURANT",
  description: "",
  phone: "",
  email: "",
  website: "",
  logo: undefined,
  capacity: undefined,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: OnboardingStep.IDENTITY,
  direction: "forward",
  formData: initialData,
  logoPreviewUrl: null,
  setLogoPreviewUrl: (url) => set({ logoPreviewUrl: url }),
  setStep: (step) =>
    set((state) => ({
      direction: step > state.currentStep ? "forward" : "backward",
      currentStep: step,
    })),
  nextStep: () =>
    set((state) => {
      if (state.currentStep === OnboardingStep.REVIEW) return state;
      return {
        direction: "forward",
        currentStep: state.currentStep + 1,
      };
    }),
  prevStep: () =>
    set((state) => {
      if (state.currentStep === OnboardingStep.IDENTITY) return state;
      return {
        direction: "backward",
        currentStep: state.currentStep - 1,
      };
    }),
  updateData: (data) =>
    set((state) => ({
      formData: { ...state.formData, ...data },
    })),
  reset: () =>
    set({
      currentStep: OnboardingStep.IDENTITY,
      formData: initialData,
      logoPreviewUrl: null,
    }),
}));
