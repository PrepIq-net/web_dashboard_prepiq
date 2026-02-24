"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { useOnboardingStore } from "../store";
import { Globe, Mail } from "iconoir-react";
import { organizationRegisterPayloadSchema } from "@/services/organizations/types";
import { useState, useMemo } from "react";

export function ContactStep() {
  const { formData, updateData, nextStep, prevStep } = useOnboardingStore();

  const errors = useMemo(() => {
    const result = organizationRegisterPayloadSchema.safeParse(formData);
    if (result.success) return {};

    return result.error.issues.reduce((acc: any, issue) => {
      acc[issue.path[0] as string] = issue.message;
      return acc;
    }, {});
  }, [formData]);

  const isValid = useMemo(() => {
    const hasAtLeastOneContact =
      formData.email?.trim() || formData.phone?.trim();
    return hasAtLeastOneContact && Object.keys(errors).length === 0;
  }, [formData, errors]);

  return (
    <div className="space-y-12 animate-fade-in">
      <div className="space-y-3">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
          Communication.
        </h2>
        <p className="text-xl text-text-secondary max-w-lg leading-relaxed">
          How should the system and your team reach this organization?
        </p>
      </div>

      <div className="space-y-10">
        <div className="grid grid-cols-1 gap-8">
          <Input
            label="Organization Email"
            type="email"
            placeholder="contact@organization.com"
            value={formData.email || ""}
            onChange={(e) => updateData({ email: e.target.value })}
            leadingIcon={<Mail />}
            error={formData.email ? errors.email : undefined}
            className="text-lg"
          />

          <PhoneInput
            label="Direct Phone Line"
            value={formData.phone || ""}
            onChange={(val) => updateData({ phone: val })}
            error={formData.phone ? errors.phone : undefined}
            className="text-lg"
          />

          <Input
            label="Operational Website"
            type="url"
            placeholder="https://www.organization.com"
            value={formData.website || ""}
            onChange={(e) => updateData({ website: e.target.value })}
            leadingIcon={<Globe />}
            error={formData.website ? errors.website : undefined}
            className="text-lg"
          />
        </div>
      </div>

      <div className="flex items-center gap-6 pt-8">
        <Button
          variant="secondary"
          onClick={prevStep}
          className="px-8 h-14 border-none hover:bg-surface-3"
        >
          Previous
        </Button>
        <Button
          onClick={nextStep}
          disabled={!isValid}
          className="px-12 py-7 text-base font-semibold shadow-level-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Review Workspace
        </Button>
      </div>
    </div>
  );
}
