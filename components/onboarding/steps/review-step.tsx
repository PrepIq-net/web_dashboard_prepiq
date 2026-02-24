"use client";

import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "../store";
import { useRegisterOrganization } from "@/services/organizations/hooks";
import { useRouter } from "next/navigation";
import {
  Building,
  MapPin,
  Phone,
  Globe,
  Mail,
  CheckCircle,
} from "iconoir-react";

export function ReviewStep() {
  const router = useRouter();
  const { formData, prevStep } = useOnboardingStore();
  const registerMutation = useRegisterOrganization();

  async function handleComplete() {
    try {
      await registerMutation.mutateAsync(formData);
      router.push("/");
    } catch (error) {
      // toast is handled in hook
    }
  }

  const SummaryItem = ({ icon: Icon, label, value }: any) => (
    <div className="flex flex-col gap-1 transition-all">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-brand-gold/60" />
        <p className="text-[11px] font-bold text-text-muted uppercase tracking-[0.2em]">
          {label}
        </p>
      </div>
      <p className="text-xl font-medium text-text-primary pl-5 border-l border-border-default/30">
        {value || (
          <span className="text-text-disabled font-normal">Not specified</span>
        )}
      </p>
    </div>
  );

  return (
    <div className="space-y-16 animate-fade-in max-w-4xl">
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-brand-gold mb-4">
          <CheckCircle className="h-6 w-6" />
          <span className="text-sm font-bold uppercase tracking-widest text-brand-gold">
            Ready for Launch
          </span>
        </div>
        <h2 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
          Verify your setup.
        </h2>
        <p className="text-xl text-text-secondary leading-relaxed">
          Almost there. Review your organizational data before we initialize
          your kitchen intelligence layer.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-12">
        <SummaryItem
          icon={Building}
          label="Organization Name"
          value={formData.name}
        />
        <SummaryItem
          icon={Building}
          label="Sector"
          value={formData.business_type}
        />
        <SummaryItem icon={Mail} label="Contact Email" value={formData.email} />
        <SummaryItem
          icon={Phone}
          label="Primary Phone"
          value={formData.phone}
        />
        <SummaryItem
          icon={Globe}
          label="Digital Presence"
          value={formData.website}
        />
      </div>

      {formData.description && (
        <div className="space-y-4 pt-10 border-t border-border-default/50">
          <p className="text-xs font-bold text-text-muted uppercase tracking-[0.2em]">
            Operational Narrative
          </p>
          <p className="text-xl text-text-secondary leading-relaxed max-w-3xl italic">
            &ldquo;{formData.description}&rdquo;
          </p>
        </div>
      )}

      <div className="flex items-center gap-6 pt-12">
        <Button
          variant="secondary"
          onClick={prevStep}
          disabled={registerMutation.isPending}
          className="px-8 h-14 border-none hover:bg-surface-3"
        >
          Modify
        </Button>
        <Button
          onClick={handleComplete}
          disabled={registerMutation.isPending}
          className="px-16 py-8 text-lg font-semibold shadow-level-3 transition-all hover:scale-[1.03] active:scale-[0.97]"
        >
          {registerMutation.isPending
            ? "Configuring Environment..."
            : "Complete & Open Workspace"}
        </Button>
      </div>
    </div>
  );
}
