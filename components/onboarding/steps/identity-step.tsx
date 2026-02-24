"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "../store";
import { Building, Shop } from "iconoir-react";

const INDUSTRY_OPTIONS = [
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "HOTEL", label: "Hotel" },
  { value: "BAKERY", label: "Bakery" },
  { value: "CLOUD_KITCHEN", label: "Cloud Kitchen" },
  { value: "CATERING", label: "Catering" },
  { value: "INSTITUTIONAL", label: "Institutional Kitchen" },
];

export function IdentityStep() {
  const { formData, updateData, nextStep } = useOnboardingStore();

  const isValid = formData.name.length >= 2 && formData.business_type;

  return (
    <div className="space-y-12 animate-fade-in">
      <div className="space-y-3">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
          First, the basics.
        </h2>
        <p className="text-xl text-text-secondary max-w-lg leading-relaxed">
          Give your workspace a name and tell us which industry you operate in.
        </p>
      </div>

      <div className="space-y-10">
        <div className="grid grid-cols-1 gap-8">
          <Input
            label="Organization Name"
            placeholder="e.g. Grand Plaza Kitchen"
            value={formData.name}
            onChange={(e) => updateData({ name: e.target.value })}
            leadingIcon={<Building />}
            required
            className="text-lg py-6"
          />

          <Select
            label="Business Type"
            options={INDUSTRY_OPTIONS}
            value={formData.business_type}
            onChange={(val) =>
              updateData({
                business_type: val as any,
                industry_type: val as any,
              })
            }
            leadingIcon={<Shop />}
            placeholder="Select your industry"
            className="text-lg py-6"
          />
        </div>
      </div>

      <div className="flex justify-start pt-8">
        <Button
          onClick={nextStep}
          disabled={!isValid}
          className="px-12 py-7 text-base font-semibold shadow-level-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Begin Setup
        </Button>
      </div>
    </div>
  );
}
