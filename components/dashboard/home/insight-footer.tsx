import { Brain } from "iconoir-react";

interface InsightFooterProps {
  insight: string;
  label?: string;
}

export function InsightFooter({
  insight,
  label = "PrepIQ Intelligence",
}: InsightFooterProps) {
  return (
    <section className="mt-16 pt-8 border-t border-surface-4">
      <div className="flex items-start gap-5">
        <div className="w-9 h-9 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0 mt-0.5">
          <Brain className="text-brand-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {label}
            </p>
            <span
              className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"
              aria-hidden="true"
            />
          </div>
          <p className="text-lg leading-7 text-text-primary font-medium">
            {insight}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Generated from real-time operational data and predictive analytics
            across your organization.
          </p>
        </div>
      </div>
    </section>
  );
}
