"use client";

import { CheckCircle, Lock, Timer } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { IntelligenceJourney } from "@/services/production-intelligence/types";

/**
 * What PrepIQ can and cannot do for this kitchen yet.
 *
 * Three states, and the third is the honest one most products omit: LOCKED
 * means we cannot learn this at all right now — the POS sends no timestamps,
 * or no supplier deliveries are tracked — as opposed to LEARNING, where
 * evidence is simply still accumulating. Collapsing those two into "coming
 * soon" would promise something that will never arrive on its own.
 */

type Capability = IntelligenceJourney["capabilities"][number];

const STATE_ORDER: Record<Capability["state"], number> = {
  LEARNED: 0,
  LEARNING: 1,
  LOCKED: 2,
};

const STATE_TOKENS: Record<
  Capability["state"],
  { Icon: typeof CheckCircle; icon: string; labelKey: string }
> = {
  LEARNED: {
    Icon: CheckCircle,
    icon: "text-status-success",
    labelKey: "intelligence.capability.learned",
  },
  LEARNING: {
    Icon: Timer,
    icon: "text-text-muted",
    labelKey: "intelligence.capability.learning",
  },
  LOCKED: {
    Icon: Lock,
    icon: "text-text-muted",
    labelKey: "intelligence.capability.locked",
  },
};

export function CapabilityList({
  capabilities,
}: {
  capabilities: Capability[];
}) {
  const { t } = useTranslation();

  const rows = [...capabilities].sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.stage - b.stage,
  );

  return (
    <ul className="divide-y divide-border-default">
      {rows.map((capability) => {
        const tokens = STATE_TOKENS[capability.state];
        const { Icon } = tokens;
        return (
          <li key={capability.key} className="flex gap-3 py-3.5">
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${tokens.icon}`}
              strokeWidth={1.5}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span
                  className={`text-sm ${
                    capability.state === "LEARNED"
                      ? "text-text-primary"
                      : "text-text-secondary"
                  }`}
                >
                  {capability.label}
                </span>
                <span className="shrink-0 text-[11px] uppercase tracking-[0.1em] text-text-muted">
                  {t(tokens.labelKey)}
                </span>
              </div>
              {capability.evidence ? (
                <p className="mt-0.5 text-xs text-text-muted">
                  {capability.evidence}
                </p>
              ) : null}
              {capability.state !== "LEARNED" && capability.requirement ? (
                <p className="mt-0.5 text-xs text-text-secondary">
                  {capability.requirement}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
