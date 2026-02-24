"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "../store";
import { Page, MapPin } from "iconoir-react";

export function OperationsStep() {
  const { formData, updateData, nextStep, prevStep } = useOnboardingStore();

  return (
    <div className="space-y-12 animate-fade-in">
      <div className="space-y-3">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
          Mission & Context.
        </h2>
        <p className="text-xl text-text-secondary max-w-lg leading-relaxed">
          Briefly describe your kitchen operations, capacity, or goals to help
          us structure your workspace.
        </p>
      </div>

      <div className="space-y-10">
        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-3">
            <label className="text-sm font-semibold uppercase tracking-widest text-text-muted">
              Workspace Description
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
          className="px-12 py-7 text-base font-semibold shadow-level-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
