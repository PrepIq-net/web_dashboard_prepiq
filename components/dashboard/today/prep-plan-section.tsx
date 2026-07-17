"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import {
  formatMoney,
  formatQuantity,
  formatSignedMoney,
  isDiscreteUnit,
  percent01,
  signedQuantity,
} from "@/lib/format";
import type { PrepPlanItem, BranchDayToday } from "@/services/production-intelligence/types";
import { QuickMessageButton } from "@/components/hub/quick-message-button";
import {
  buildFinancialSnapshot,
  confidenceLabel,
  hasPricing,
  overrideImpactLine,
  popularityLabel,
  riskLabel,
  riskTone,
  signalLabel,
  type DecisionSummary,
  type ImpactPreview,
  type PrepRow,
  type Translator,
} from "./today-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export type PrepPlanSectionProps = {
  branchDay: BranchDayToday;
  rows: PrepRow[];
  totalRowCount: number;
  forecastRankById: Record<string, number>;
  decisionSummary: DecisionSummary;
  importantItemsOnly: boolean;
  onToggleImportantOnly: () => void;
  isPlanLocked: boolean;
  isMorning: boolean;
  lockPending: boolean;
  startPending: boolean;
  onLockPlan: () => void;
  onStartService: () => void;
  plannedQtyByItem: Record<string, number | "">;
  onPlannedChange: (prepPlanItemId: string, value: string, unit: string) => void;
  onAcceptSuggestion: (
    prepPlanItemId: string,
    suggestedQuantity: number,
    unit: string,
  ) => void;
  onKeepMyPlan: (
    prepPlanItemId: string,
    plannedQuantity: number | null,
    unit: string,
  ) => void;
  onOverrideReason?: (prepPlanItemId: string, reason: string) => void;
  actionErrorByItem: Record<string, string>;
  expandedItemIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onMarkUnavailable: (item: { id: string; title: string }) => void;
  branchId: string;
  targetDate: string;
  orgId: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared row internals (used by both the mobile cards and the desktop table —
// previously two full copies of this logic lived side by side)
// ─────────────────────────────────────────────────────────────────────────────

function backendDecisionFeedback(
  t: Translator,
  item: { decision?: string | null; accepted_suggestion?: boolean },
) {
  if (item.decision === "ACCEPTED_AI" || item.accepted_suggestion) {
    return { tone: "success" as const, message: t("today.feedback.accepted") };
  }
  if (item.decision === "CHEF_OVERRIDE") {
    return { tone: "warning" as const, message: t("today.feedback.overridden") };
  }
  return null;
}

function rowAccent(item: PrepPlanItem, riskScore: number) {
  const isAccepted =
    item.decision === "ACCEPTED_AI" || item.accepted_suggestion;
  const isOverride = item.decision === "CHEF_OVERRIDE";
  return { isAccepted, isOverride, isHighRisk: riskScore >= 0.45 };
}

function ItemIdentity({
  item,
  rank,
  size = "md",
}: {
  item: PrepPlanItem;
  rank: number;
  size?: "md" | "lg";
}) {
  const { t } = useTranslation();
  const imgCls =
    size === "lg"
      ? "h-10 w-10 shrink-0 rounded-lg border border-surface-4"
      : "h-9 w-9 shrink-0 rounded-lg border border-surface-4";
  return (
    <div className="flex items-center gap-3">
      {item.product_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.product_image_url}
          alt={item.product_title}
          className={`${imgCls} object-cover`}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          className={`${imgCls} flex items-center justify-center bg-surface-3 text-[10px] font-bold text-text-muted`}
        >
          {item.product_title.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold leading-tight text-text-primary">
          {item.product_title}
        </p>
        <p className="mt-0.5 text-[11px] text-text-muted">
          {popularityLabel(t, rank)}
        </p>
      </div>
    </div>
  );
}

/** Net quantity to produce: raw demand suggestion minus usable carry-over. */
function netSuggestedQty(item: PrepPlanItem) {
  const carryOver = item.carry_over_qty ?? 0;
  if (carryOver <= 0) return item.suggested_quantity;
  return (
    item.net_suggested_quantity ??
    Math.max(0, item.suggested_quantity - carryOver)
  );
}

/** Suggested quantity, or the supply-constrained pill when availability blocks it. */
function SuggestedQty({ item }: { item: PrepPlanItem }) {
  const { t } = useTranslation();
  const avail = (item.suggestion_reason_json as any)?.availability;
  const isSupplyConstrained =
    avail?.available === false && avail?.suppressed_demand === false;
  if (isSupplyConstrained) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex h-6 w-fit items-center rounded-full border border-status-warning/30 bg-status-warning/10 px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-status-warning">
          {t("today.table.supplyConstrained")}
        </span>
        <span className="text-sm font-semibold text-status-warning">
          0 {item.unit}
        </span>
      </div>
    );
  }
  const carryOver = item.carry_over_qty ?? 0;
  if (carryOver > 0) {
    return (
      <div>
        <p className="font-display text-lg font-semibold text-text-primary">
          {formatQuantity(netSuggestedQty(item), item.unit)}
        </p>
        <span
          className="mt-0.5 inline-flex w-fit items-center rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 py-0.5 text-[10px] font-semibold text-brand-gold"
          title={t("today.plan.carryOverTitle", {
            demand: formatQuantity(item.suggested_quantity, item.unit),
          })}
        >
          {t("today.plan.carryOver", {
            quantity: formatQuantity(carryOver, item.unit),
          })}
        </span>
      </div>
    );
  }
  return (
    <p className="font-display text-lg font-semibold text-text-primary">
      {formatQuantity(item.suggested_quantity, item.unit)}
    </p>
  );
}

const OVERRIDE_REASONS = [
  "LARGE_BOOKING",
  "EVENT",
  "WEATHER",
  "EXPERIENCE",
  "HOLIDAY",
  "OTHER",
] as const;

/** Optional "why the change?" chips — labeled training data, never a gate.
 * Shown only when the plan meaningfully diverges from the suggestion. */
function OverrideReasonChips({
  item,
  planned,
  disabled,
  onOverrideReason,
  className = "",
}: {
  item: PrepPlanItem;
  planned: number | null;
  disabled: boolean;
  onOverrideReason?: PrepPlanSectionProps["onOverrideReason"];
  className?: string;
}) {
  const { t } = useTranslation();
  if (!onOverrideReason || disabled || planned == null) return null;
  const suggested = item.suggested_quantity;
  const diverges =
    Math.abs(planned - suggested) / Math.max(suggested, 1) >= 0.15;
  if (!diverges) return null;
  const selected = item.override_reason || "";
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {t("today.override.why")}
      </span>
      {OVERRIDE_REASONS.map((reason) => (
        <button
          key={reason}
          type="button"
          onClick={() =>
            onOverrideReason(item.id, selected === reason ? "" : reason)
          }
          className={`inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold transition-colors active:scale-[0.98] ${
            selected === reason
              ? "border-brand-gold/60 bg-brand-gold/15 text-brand-gold"
              : "border-surface-4 text-text-muted hover:bg-surface-3"
          }`}
        >
          {t(`today.override.${reason.toLowerCase()}`)}
        </button>
      ))}
    </div>
  );
}

function VarianceLine({
  variance,
  unit,
  impact,
  suggestedQuantity,
}: {
  variance: number | null;
  unit: string;
  impact: ImpactPreview | undefined;
  suggestedQuantity: number;
}) {
  const { t } = useTranslation();
  const line = overrideImpactLine(t, impact, variance, suggestedQuantity);
  return (
    <>
      <p className="mt-0.5 text-[11px] text-text-muted">
        {variance == null || variance === 0
          ? t("today.table.matchesSuggestion")
          : variance > 0
            ? `${signedQuantity(variance, unit)} ${t("today.table.above")}`
            : `${signedQuantity(variance, unit)} ${t("today.table.below")}`}
      </p>
      {line ? (
        <p
          className={`mt-0.5 text-[11px] font-medium ${line.tone === "warning" ? "text-status-warning" : "text-status-critical"}`}
        >
          {line.text}
        </p>
      ) : null}
    </>
  );
}

function DecisionFeedback({
  item,
  error,
  className = "",
}: {
  item: PrepPlanItem;
  error?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  if (error) {
    return <p className={`text-xs text-status-critical ${className}`}>{error}</p>;
  }
  const feedback = backendDecisionFeedback(t, item);
  if (!feedback) return null;
  return (
    <p
      className={`text-xs ${feedback.tone === "success" ? "text-status-success" : "text-status-warning"} ${className}`}
    >
      {feedback.message}
    </p>
  );
}

function PlannedInput({
  item,
  value,
  disabled,
  onChange,
  widthClass,
}: {
  item: PrepPlanItem;
  value: number | "";
  disabled: boolean;
  onChange: (value: string) => void;
  widthClass: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        step={isDiscreteUnit(item.unit) ? 1 : 0.01}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`h-8 ${widthClass} rounded-lg border border-surface-4 bg-surface-3 px-2.5 text-sm font-semibold text-text-primary transition-colors focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 disabled:opacity-60`}
      />
      <span className="text-xs text-text-muted">{item.unit}</span>
    </div>
  );
}

function AcceptKeepButtons({
  item,
  planned,
  disabled,
  onAccept,
  onKeep,
  size = "sm",
}: {
  item: PrepPlanItem;
  planned: number | null;
  disabled: boolean;
  onAccept: PrepPlanSectionProps["onAcceptSuggestion"];
  onKeep: PrepPlanSectionProps["onKeepMyPlan"];
  size?: "sm" | "md";
}) {
  const { t } = useTranslation();
  const h = size === "md" ? "h-8" : "h-7";
  return (
    <>
      <button
        type="button"
        onClick={() => onAccept(item.id, netSuggestedQty(item), item.unit)}
        disabled={disabled}
        className={`inline-flex ${h} items-center rounded-full border border-status-success/40 bg-status-success/15 px-3 text-xs font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success/30`}
      >
        {t("today.table.accept")}
      </button>
      <button
        type="button"
        onClick={() => onKeep(item.id, planned, item.unit)}
        disabled={disabled}
        className={`inline-flex ${h} items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/20`}
      >
        {t("today.table.keepMine")}
      </button>
    </>
  );
}

function RowLinks({
  item,
  isMorning,
  branchId,
  targetDate,
  orgId,
  isExpanded,
  onToggleExpand,
  onMarkUnavailable,
  whyLabelKey,
}: {
  item: PrepPlanItem;
  isMorning: boolean;
  branchId: string;
  targetDate: string;
  orgId: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onMarkUnavailable: (item: { id: string; title: string }) => void;
  whyLabelKey: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onToggleExpand(item.id)}
        className="text-[11px] font-semibold text-brand-gold transition-colors hover:text-brand-gold/80"
      >
        {isExpanded ? t("today.table.hide") : t(whyLabelKey)}
      </button>
      <Link
        href={`/workspace/today/item/${item.id}?branch=${branchId}&date=${targetDate}&title=${encodeURIComponent(item.product_title)}&product_id=${item.product_id}&org=${orgId}`}
        className="text-[11px] font-medium text-brand-gold/70 transition-colors hover:text-brand-gold"
      >
        {t("today.table.deepDive")}
      </Link>
      <Link
        href={`/workspace/items/${item.product_id}?branch=${branchId}`}
        className="text-[11px] font-medium text-text-muted transition-colors hover:text-brand-gold"
      >
        {t("today.table.trackRecord")}
      </Link>
      <QuickMessageButton
        refType="PREP_ITEM"
        objectId={item.id}
        title={item.product_title}
        label={t("today.table.message")}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted transition-colors hover:text-brand-gold"
      />
      {isMorning ? (
        <button
          type="button"
          onClick={() =>
            onMarkUnavailable({ id: item.product_id, title: item.product_title })
          }
          className="text-[11px] font-medium text-text-muted transition-colors hover:text-status-warning"
        >
          {t("today.table.markUnavailable")}
        </button>
      ) : null}
    </div>
  );
}

function BatchConstraints({ item }: { item: PrepPlanItem }) {
  const { t } = useTranslation();
  const constraints = (item.suggestion_reason_json as any)?.constraints as
    | any[]
    | undefined;
  if (!constraints?.length) return null;
  return (
    <div className="space-y-0.5">
      {constraints.map((c: any, i: number) => (
        <p key={i} className="text-text-muted">
          {t("today.table.batchRule", {
            raw: c.raw_qty,
            rounded: c.rounded_qty,
          })}
          {c.batch_size != null
            ? ` ${t("today.table.batchSize", { size: c.batch_size })}`
            : ""}
        </p>
      ))}
    </div>
  );
}

function SignalAdjustments({ item }: { item: PrepPlanItem }) {
  const { t } = useTranslation();
  if (!item.forecast_context.applied_signals) return null;
  const entries = Object.entries(item.forecast_context.applied_signals).filter(
    ([, signal]: [string, any]) => Math.abs(signal?.modifier ?? 0) >= 0.005,
  );
  if (!entries.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {t("today.table.signalAdjustments")}
      </p>
      <div className="space-y-1">
        {entries.map(([key, signal]: [string, any]) => {
          const modifier = signal?.modifier ?? 0;
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-text-secondary">{signalLabel(t, key)}</span>
              <span
                className={`font-semibold ${modifier > 0 ? "text-status-success" : "text-status-warning"}`}
              >
                {modifier > 0 ? "↑" : "↓"} {(Math.abs(modifier) * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImpactSummary({ impact }: { impact: ImpactPreview | undefined }) {
  const { t } = useTranslation();
  if (!impact) return null;
  if (impact.narrative) {
    return (
      <div className="mb-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t("today.table.overrideImpact")}
        </p>
        <p
          className={`text-sm font-medium ${impact.delta_quantity > 0 ? "text-status-warning" : "text-status-critical"}`}
        >
          {impact.narrative}
        </p>
      </div>
    );
  }
  return (
    <div className="mb-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {t("today.table.marginImpact")}
      </p>
      <p
        className={`text-sm font-semibold ${impact.margin_impact_estimate >= 0 ? "text-status-success" : "text-status-critical"}`}
      >
        {formatSignedMoney(impact.margin_impact_estimate)}
      </p>
    </div>
  );
}

function FinancialScenarios({
  item,
  planned,
}: {
  item: PrepPlanItem;
  planned: number | null;
}) {
  const { t } = useTranslation();
  if (!hasPricing(item)) {
    return (
      <p className="text-text-muted">{t("today.table.missingPricing")}</p>
    );
  }
  const financials = buildFinancialSnapshot({
    plannedQty: planned ?? item.suggested_quantity,
    predictedQty: item.forecast_context.predicted_quantity_needed,
    unit: item.unit,
    unitPrice: item.forecast_context.unit_price,
    unitCost: item.forecast_context.unit_cost,
    unitMargin: item.forecast_context.unit_margin,
  });
  return (
    <div className="space-y-0.5">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {t("today.table.financialScenarios")}
      </p>
      {financials.revenueIfSold != null && (
        <p>
          {financials.marginIfSold != null
            ? t("today.table.ifSoldOutWithMargin", {
                revenue: formatMoney(financials.revenueIfSold),
                margin: formatMoney(financials.marginIfSold),
              })
            : t("today.table.ifSoldOut", {
                revenue: formatMoney(financials.revenueIfSold),
              })}
        </p>
      )}
      {financials.wasteIfAll != null && (
        <p>{t("today.table.ifWasted", { cost: formatMoney(financials.wasteIfAll) })}</p>
      )}
      {financials.lostMarginIfStockout != null && financials.shortfallQty > 0 && (
        <p>
          {t("today.table.stockoutWarning", {
            quantity: formatQuantity(financials.shortfallQty, financials.unit),
            margin: formatMoney(financials.lostMarginIfStockout),
          })}
        </p>
      )}
    </div>
  );
}

/** Full "why this quantity" explainer: reasoning, constraints, signals, money. */
function WhyPanel({
  item,
  planned,
  impact,
  layout,
}: {
  item: PrepPlanItem;
  planned: number | null;
  impact: ImpactPreview | undefined;
  layout: "stack" | "grid";
}) {
  const { t } = useTranslation();
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-1 gap-4 pt-3 text-[11px] text-text-secondary md:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.table.whyThisQuantity")}
          </p>
          <div className="space-y-0.5">
            {item.forecast_context.reasoning.map((line) => (
              <p key={`r-${item.id}-${line}`}>{line}</p>
            ))}
          </div>
          <div className="mt-2 border-t border-surface-4/40 pt-2 empty:hidden">
            <BatchConstraints item={item} />
          </div>
        </div>
        <SignalAdjustments item={item} />
        <div>
          <ImpactSummary impact={impact} />
          <FinancialScenarios item={item} planned={planned} />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2.5 border-t border-surface-4/60 bg-surface-3/20 px-4 py-3 text-[11px] text-text-secondary">
      <div className="border-b border-surface-4/40 pb-2 empty:hidden">
        <BatchConstraints item={item} />
      </div>
      <div className="space-y-0.5">
        {item.forecast_context.reasoning.map((line) => (
          <p key={`mobile-r-${item.id}-${line}`}>{line}</p>
        ))}
      </div>
      <div className="border-t border-surface-4/40 pt-2 empty:hidden">
        <SignalAdjustments item={item} />
      </div>
      <div className="border-t border-surface-4/40 pt-2 empty:hidden">
        <ImpactSummary impact={impact} />
      </div>
      <div className="border-t border-surface-4/40 pt-2">
        <FinancialScenarios item={item} planned={planned} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────────────────────

export function PrepPlanSection(props: PrepPlanSectionProps) {
  const { t } = useTranslation();
  const {
    branchDay,
    rows,
    totalRowCount,
    forecastRankById,
    decisionSummary,
    importantItemsOnly,
    onToggleImportantOnly,
    isPlanLocked,
    isMorning,
    lockPending,
    startPending,
    onLockPlan,
    onStartService,
    plannedQtyByItem,
    onPlannedChange,
    onAcceptSuggestion,
    onKeepMyPlan,
    onOverrideReason,
    actionErrorByItem,
    expandedItemIds,
    onToggleExpand,
    onMarkUnavailable,
    branchId,
    targetDate,
    orgId,
  } = props;

  const lockStartButtons = (
    <>
      <button
        type="button"
        onClick={onLockPlan}
        disabled={isPlanLocked || lockPending}
        className="inline-flex h-10 items-center rounded-full border border-surface-4 px-5 text-sm font-semibold text-text-primary transition-all duration-200 hover:border-status-success/60 hover:text-status-success active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPlanLocked
          ? t("today.prepPlan.planLocked")
          : lockPending
            ? t("today.prepPlan.locking")
            : t("today.prepPlan.lockPlan")}
      </button>
      <button
        type="button"
        onClick={onStartService}
        disabled={startPending || !isPlanLocked}
        className="inline-flex h-10 items-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-[#141416] transition-all duration-200 hover:bg-brand-gold-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {startPending
          ? t("today.prepPlan.starting")
          : t("today.prepPlan.startService")}
      </button>
    </>
  );

  return (
    <section className="mb-11">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("today.prepPlan.title")}
          </p>
          <h3 className="font-display text-xl font-semibold text-text-primary sm:text-2xl">
            {t("today.prepPlan.subtitle")}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-secondary">
            <span>
              <span className="font-semibold text-text-primary">
                {decisionSummary.reviewed}
              </span>{" "}
              {t("today.prepPlan.ofCount", { total: totalRowCount })}
            </span>
            {(branchDay.morning_overview?.projected_margin_total ?? 0) > 0 ? (
              <span>
                {t("today.prepPlan.projectedMargin")}{" "}
                <span className="font-semibold text-status-success">
                  {formatMoney(branchDay.morning_overview?.projected_margin_total ?? 0)}
                </span>
              </span>
            ) : null}
            {branchDay.morning_overview?.chef_accuracy_score?.available ? (
              <span>
                {t("today.prepPlan.yourAccuracy")}{" "}
                <span className="font-semibold text-text-primary">
                  {branchDay.morning_overview.chef_accuracy_score.chef_forecast_accuracy_pct.toFixed(1)}
                  %
                </span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleImportantOnly}
            className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/50 hover:text-brand-gold"
          >
            {importantItemsOnly
              ? t("today.prepPlan.priorityItems")
              : t("today.prepPlan.allItems")}
          </button>
          {lockStartButtons}
        </div>
      </div>

      {!isPlanLocked ? (
        <p className="mb-4 text-xs text-text-muted">
          {t("today.prepPlan.lockFirst")}
        </p>
      ) : branchDay.plan_lock?.locked_at ? (
        <p className="mb-4 text-xs text-status-success">
          {branchDay.plan_lock.locked_by?.name
            ? t("today.prepPlan.lockedAtBy", {
                time: new Date(branchDay.plan_lock.locked_at).toLocaleTimeString(
                  "en-US",
                  { hour: "2-digit", minute: "2-digit" },
                ),
                user: branchDay.plan_lock.locked_by.name,
              })
            : t("today.prepPlan.lockedAtTime", {
                time: new Date(branchDay.plan_lock.locked_at).toLocaleTimeString(
                  "en-US",
                  { hour: "2-digit", minute: "2-digit" },
                ),
              })}
        </p>
      ) : null}

      {/* ── Mobile cards ── */}
      <div className="lg:hidden space-y-2">
        {rows.map(({ item, riskScore, planned, variance, impact }) => {
          const { isAccepted, isOverride, isHighRisk } = rowAccent(
            item,
            riskScore,
          );
          const isExpanded = expandedItemIds.has(item.id);
          return (
            <article
              key={`mobile-forecast-${item.id}`}
              className={`overflow-hidden rounded-xl border bg-surface-2 transition-colors ${
                isAccepted
                  ? "border-l-[3px] border-l-status-success/70 border-status-success/30"
                  : isOverride
                    ? "border-l-[3px] border-l-status-warning/70 border-status-warning/30"
                    : isHighRisk
                      ? "border-l-[3px] border-l-status-critical/50 border-status-critical/25"
                      : "border-surface-4"
              }`}
            >
              <div className="flex items-start justify-between gap-3 px-4 pt-4">
                <ItemIdentity
                  item={item}
                  rank={forecastRankById[item.id] ?? 999}
                  size="lg"
                />
                <span
                  className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskTone(riskScore)}`}
                >
                  {riskLabel(t, riskScore)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 divide-x divide-surface-4/60 border-y border-surface-4/60">
                <div className="px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {t("today.table.aiSuggests")}
                  </p>
                  <div className="mt-1">
                    <SuggestedQty item={item} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {t("today.table.ordersAndConfidence", {
                      orders: Math.round(item.forecast_context.predicted_orders),
                      confidence: confidenceLabel(
                        t,
                        item.forecast_context.confidence_score,
                      ),
                    })}
                  </p>
                </div>
                <div className="px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {t("today.table.yourPlan")}
                  </p>
                  <div className="mt-1">
                    <PlannedInput
                      item={item}
                      value={plannedQtyByItem[item.id] ?? ""}
                      disabled={isPlanLocked}
                      onChange={(value) => onPlannedChange(item.id, value, item.unit)}
                      widthClass="w-20"
                    />
                  </div>
                  <VarianceLine
                    variance={variance}
                    unit={item.unit}
                    impact={impact}
                    suggestedQuantity={item.suggested_quantity}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AcceptKeepButtons
                    item={item}
                    planned={planned}
                    disabled={isPlanLocked}
                    onAccept={onAcceptSuggestion}
                    onKeep={onKeepMyPlan}
                    size="md"
                  />
                </div>
                <RowLinks
                  item={item}
                  isMorning={isMorning}
                  branchId={branchId}
                  targetDate={targetDate}
                  orgId={orgId}
                  isExpanded={isExpanded}
                  onToggleExpand={onToggleExpand}
                  onMarkUnavailable={onMarkUnavailable}
                  whyLabelKey="today.table.why"
                />
              </div>

              <DecisionFeedback
                item={item}
                error={actionErrorByItem[item.id]}
                className="px-4 pb-3"
              />

              <OverrideReasonChips
                item={item}
                planned={planned}
                disabled={isPlanLocked}
                onOverrideReason={onOverrideReason}
                className="px-4 pb-3"
              />

              {isExpanded ? (
                <WhyPanel item={item} planned={planned} impact={impact} layout="stack" />
              ) : null}
            </article>
          );
        })}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 lg:block">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-surface-4/80 bg-surface-3/40">
            <tr>
              {[
                t("today.table.item"),
                t("today.table.aiSuggests"),
                t("today.table.confidence"),
                t("today.table.yourPlan"),
                "",
              ].map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted ${index === 0 ? "w-[200px]" : ""}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-4/50">
            {rows.map(({ item, riskScore, planned, variance, impact }) => {
              const { isAccepted, isOverride, isHighRisk } = rowAccent(
                item,
                riskScore,
              );
              const isExpanded = expandedItemIds.has(item.id);
              const accentClass = isAccepted
                ? "border-l-[3px] border-l-status-success/70"
                : isOverride
                  ? "border-l-[3px] border-l-status-warning/70"
                  : isHighRisk
                    ? "border-l-[3px] border-l-status-critical/50"
                    : "border-l-[3px] border-l-transparent";

              return (
                <Fragment key={item.id}>
                  <tr
                    className={`align-top transition-colors hover:bg-surface-3/20 ${accentClass} ${
                      isAccepted
                        ? "bg-status-success/[0.025]"
                        : isOverride
                          ? "bg-status-warning/[0.025]"
                          : ""
                    }`}
                  >
                    <td className="px-4 py-4">
                      <ItemIdentity
                        item={item}
                        rank={forecastRankById[item.id] ?? 999}
                      />
                    </td>

                    <td className="px-4 py-4">
                      <SuggestedQty item={item} />
                      <p className="mt-0.5 text-xs text-text-muted">
                        {t("today.table.expectedOrders", {
                          orders: Math.round(
                            item.forecast_context.predicted_orders,
                          ),
                        })}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-text-primary">
                        {percent01(item.forecast_context.confidence_score)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {confidenceLabel(
                          t,
                          item.forecast_context.confidence_score,
                        )}
                      </p>
                      <span
                        className={`mt-1.5 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${riskTone(riskScore)}`}
                      >
                        {riskLabel(t, riskScore)} {t("today.table.risk")}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <PlannedInput
                        item={item}
                        value={plannedQtyByItem[item.id] ?? ""}
                        disabled={isPlanLocked}
                        onChange={(value) => onPlannedChange(item.id, value, item.unit)}
                        widthClass="w-24"
                      />
                      <VarianceLine
                        variance={variance}
                        unit={item.unit}
                        impact={impact}
                        suggestedQuantity={item.suggested_quantity}
                      />
                      <DecisionFeedback
                        item={item}
                        error={actionErrorByItem[item.id]}
                        className="mt-1"
                      />
                      <OverrideReasonChips
                        item={item}
                        planned={planned}
                        disabled={isPlanLocked}
                        onOverrideReason={onOverrideReason}
                        className="mt-1.5 max-w-65"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AcceptKeepButtons
                          item={item}
                          planned={planned}
                          disabled={isPlanLocked}
                          onAccept={onAcceptSuggestion}
                          onKeep={onKeepMyPlan}
                        />
                      </div>
                      <div className="mt-1.5">
                        <RowLinks
                          item={item}
                          isMorning={isMorning}
                          branchId={branchId}
                          targetDate={targetDate}
                          orgId={orgId}
                          isExpanded={isExpanded}
                          onToggleExpand={onToggleExpand}
                          onMarkUnavailable={onMarkUnavailable}
                          whyLabelKey="today.table.whyDesktop"
                        />
                      </div>
                    </td>
                  </tr>

                  {isExpanded ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="border-b border-surface-4/50 bg-surface-3/20 px-6 pb-5 pt-0"
                      >
                        <WhyPanel
                          item={item}
                          planned={planned}
                          impact={impact}
                          layout="grid"
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Commit zone — progress + Lock/Start anchored at list bottom ── */}
      <div className="mt-6 flex flex-col gap-3 border-t border-surface-4/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">
            {decisionSummary.reviewed}
          </span>{" "}
          {t("today.prepPlan.ofCount", { total: totalRowCount })}
          {decisionSummary.reviewed < totalRowCount ? (
            <span className="ml-2 text-text-muted">
              · {totalRowCount - decisionSummary.reviewed}{" "}
              {t("today.prepPlan.pending")}
            </span>
          ) : (
            <span className="ml-2 text-status-success">
              · {t("today.table.allReviewed")}
            </span>
          )}
          {!isPlanLocked && (
            <span className="ml-3 text-xs text-text-muted">
              {t("today.prepPlan.lockToStart")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">{lockStartButtons}</div>
      </div>
    </section>
  );
}
