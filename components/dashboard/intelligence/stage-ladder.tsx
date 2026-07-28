"use client";

import { Check, Lock, WarningTriangle } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { IntelligenceJourney } from "@/services/production-intelligence/types";

/**
 * The four learning stages, with the gates that earned the current one and the
 * gates still holding the next one back.
 *
 * Every gate carries its own actual/target, because "you are at stage 1" is an
 * assertion and "you have 12 of the 30 trading days stage 2 needs" is a fact
 * the kitchen can act on.
 */

const STAGES = [0, 1, 2, 3] as const;

function GateRow({
  gate,
  met,
}: {
  gate: IntelligenceJourney["stage"]["gates_met"][number];
  met: boolean;
}) {
  const pct =
    gate.target > 0 ? Math.min(100, (gate.actual / gate.target) * 100) : 0;

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-text-primary">{gate.label}</span>
        <span className="shrink-0 font-display text-xs tabular-nums text-text-muted">
          {Math.round(gate.actual)} / {Math.round(gate.target)}
        </span>
      </div>
      {gate.detail ? (
        <p className="mt-0.5 text-xs text-text-muted">{gate.detail}</p>
      ) : null}
      {!met ? (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-text-muted"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </li>
  );
}

export function StageLadder({ journey }: { journey: IntelligenceJourney }) {
  const { t } = useTranslation();
  const { stage } = journey;

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label={t("intelligence.stages")}>
        {STAGES.map((index) => {
          const reached = stage.index >= index;
          const current = stage.index === index;
          return (
            <li
              key={index}
              aria-current={current ? "step" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                current
                  ? "bg-brand-gold/12 text-text-primary"
                  : reached
                    ? "bg-surface-3 text-text-secondary"
                    : "bg-surface-2 text-text-muted"
              }`}
            >
              {reached ? (
                <Check
                  className={`h-3.5 w-3.5 ${current ? "text-text-primary" : "text-status-success"}`}
                  strokeWidth={1.5}
                  aria-hidden
                />
              ) : (
                <Lock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              )}
              <span className="font-medium">
                {t(`intelligence.stage.${index}`)}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
        {stage.headline}
      </p>

      {stage.blocked_reason ? (
        // Being stuck is information. A stage that stalls without saying why
        // is indistinguishable from a broken product.
        <div className="flex gap-3 rounded-r-lg border-l-4 border-l-status-warning bg-status-warning/8 px-4 py-3">
          <WarningTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-status-warning"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="text-sm text-text-primary">{stage.blocked_reason}</p>
        </div>
      ) : null}

      <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        {stage.gates_pending.length > 0 ? (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              {stage.next_stage
                ? t("intelligence.toReach", {
                    stage: stage.next_stage.label,
                  })
                : t("intelligence.stillNeeded")}
            </h4>
            <ul className="mt-1 divide-y divide-border-default">
              {stage.gates_pending.map((gate) => (
                <GateRow key={gate.key} gate={gate} met={false} />
              ))}
            </ul>
          </section>
        ) : null}

        {stage.gates_met.length > 0 ? (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("intelligence.alreadyEarned")}
            </h4>
            <ul className="mt-1 divide-y divide-border-default">
              {stage.gates_met.map((gate) => (
                <GateRow key={gate.key} gate={gate} met />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
