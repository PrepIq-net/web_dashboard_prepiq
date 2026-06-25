"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "../store";
import { Page, Building } from "iconoir-react";
import { organizationRegisterPayloadSchema } from "@/services/organizations/types";
import { useMemo } from "react";

export function OperationsStep() {
  const { formData, updateData, nextStep, prevStep } = useOnboardingStore();

  const errors = useMemo(() => {
    const result = organizationRegisterPayloadSchema.safeParse(formData);
    if (result.success) return {};
    return result.error.issues.reduce((acc: any, issue) => {
      acc[issue.path[0] as string] = issue.message;
      return acc;
    }, {});
  }, [formData]);

  const isValid = !errors.capacity && !errors.description;

  return (
    <div className="space-y-12 animate-fade-in">
      <div className="space-y-3">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
          A bit about your kitchen.
        </h2>
        <p className="text-xl text-text-secondary max-w-lg leading-relaxed">
          Optional — helps the forecast engine calibrate early. You can always
          fill this in later.
        </p>
      </div>

      <div className="space-y-10">
        <div className="grid grid-cols-1 gap-8">
          <Input
            label="Storage Capacity (Units)"
            type="number"
            placeholder="e.g. 5000"
            value={formData.capacity || ""}
            onChange={(e) =>
              updateData({ capacity: parseInt(e.target.value) || undefined })
            }
            leadingIcon={<Building className="h-4 w-4" />}
            error={errors.capacity}
            className="text-lg"
          />

          <div className="space-y-3">
            <label className="text-sm font-semibold uppercase tracking-widest text-text-muted">
              Brief description
            </label>
            <textarea
              className="w-full rounded-card border border-border-default bg-surface-2 p-5 text-lg text-text-primary outline-none transition-all focus:border-brand-gold/60 focus:shadow-[0_0_15px_rgba(168,130,31,0.1)] hover:bg-surface-3 min-h-[160px] resize-none leading-relaxed"
              placeholder="Briefly describe your kitchen operations, capacity, or goals..."
              value={formData.description || ""}
              onChange={(e) => updateData({ description: e.target.value })}
            />
          </div>
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
          Continue
        </Button>
      </div>
    </div>
  );
}
