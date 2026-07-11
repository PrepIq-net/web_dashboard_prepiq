"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { percent01 } from "@/lib/format";
import type { BranchDayToday } from "@/services/production-intelligence/types";
import {
  deriveNetworkLearnings,
  deriveNetworkSuggestedAction,
  type DecisionSummary,
} from "./today-helpers";

/**
 * Collapsed "more context" footer for the morning phase: what other kitchens
 * in the network are seeing, plus a summary of today's plan decisions.
 */
export function MorningContextFooter({
  branchDay,
  decisionSummary,
}: {
  branchDay: BranchDayToday;
  decisionSummary: DecisionSummary;
}) {
  const { t } = useTranslation();
  const network = branchDay.kitchen_intelligence_network;
  const networkLearnings = useMemo(
    () => deriveNetworkLearnings(network),
    [network],
  );
  const networkSuggestedAction = useMemo(
    () => deriveNetworkSuggestedAction(t, network),
    [network, t],
  );

  return (
    <details className="mt-8 mb-4">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-text-secondary transition-colors">
        {t("today.morning.moreContext")}
      </summary>

      <div className="mt-4 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            {t("today.morning.otherKitchens")}
          </p>
          {networkLearnings.length ? (
            <div className="space-y-2">
              {networkLearnings.map((learning) => (
                <div
                  key={`${learning.label}-${learning.detail}`}
                  className="flex items-start gap-3 py-2 border-b border-surface-4/50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {learning.label}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {learning.detail}
                      {typeof learning.confidence === "number"
                        ? ` ${t("today.morning.reliability", { pct: percent01(learning.confidence) })}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              {t("today.morning.nothingNotable")}
            </p>
          )}
          {networkSuggestedAction ? (
            <p className="mt-3 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">
                {t("today.morning.suggested")}:{" "}
              </span>
              {networkSuggestedAction}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            {t("today.morning.decisionSummary")}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
            <span>
              {t("today.morning.reviewed")}:{" "}
              <span className="font-semibold text-text-primary">
                {decisionSummary.reviewed}
              </span>
            </span>
            <span>
              {t("today.morning.usedSuggestion")}:{" "}
              <span className="font-semibold text-status-success">
                {decisionSummary.accepted}
              </span>
            </span>
            <span>
              {t("today.morning.ownNumber")}:{" "}
              <span className="font-semibold text-status-warning">
                {decisionSummary.overridden}
              </span>
            </span>
            <span>
              {t("today.morning.wasteExposure")}:{" "}
              <span className="font-semibold text-text-primary">
                {decisionSummary.projectedWaste.toFixed(1)}%
              </span>
            </span>
            <span>
              {t("today.morning.forecastImpact")}:{" "}
              <span
                className={`font-semibold ${decisionSummary.accuracyImpact >= 0 ? "text-status-success" : "text-status-critical"}`}
              >
                {decisionSummary.accuracyImpact >= 0 ? "+" : ""}
                {decisionSummary.accuracyImpact.toFixed(1)}%
              </span>
            </span>
          </div>
        </div>
      </div>
    </details>
  );
}
