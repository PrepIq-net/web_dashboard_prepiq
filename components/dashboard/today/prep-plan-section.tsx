"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Sparks } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import {
  formatQuantity,
  isDiscreteUnit,
  percent01,
  signedQuantity,
} from "@/lib/format";
import { useMoney } from "@/lib/branch-currency";
import type { PrepPlanItem, BranchDayToday } from "@/services/production-intelligence/types";
import { QuickMessageButton } from "@/components/hub/quick-message-button";
import { ItemImage } from "./item-image";
import { classifyItemIcon } from "./item-visual";
import {
  buildFinancialSnapshot,
  categoryChipLabel,
  confidenceLabel,
  hasPricing,
  humanizeReasoning,
  isUnconfirmedSuggestion,
  netSuggestedQty,
  overrideImpactLine,
  overridePrecedentLine,
  planRiskBreakdown,
  popularityLabel,
  qualifiedRiskLabel,
  riskKindHint,
  riskTone,
  signalLabel,
  splitByPreparation,
  type DecisionSummary,
  type ImpactPreview,
  type PreparationCode,
  type PrepRow,
  type Translator,
} from "./today-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export type PrepPlanSectionProps = {
  branchDay: BranchDayToday;
  rows: PrepRow[];
  /** STOCKED items — shown as stock levels, never as production decisions. */
  stockRows?: PrepRow[];
  totalRowCount: number;
  forecastRankById: Record<string, number>;
  decisionSummary: DecisionSummary;
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
  /** View-only mode: the user lacks the plan-editing permissions. */
  readOnly?: boolean;
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

/** Icon for the item's type — reads `product_category` first (drink, dessert,
 * bakery, ...) and falls back to the backend's PREPARED/ASSEMBLED/STOCKED
 * classification. Same read `ItemImage`'s fallback tile uses, so the chip and
 * the thumbnail never disagree about what kind of thing this row is. */
function PreparationIcon({
  code,
  category,
  className = "",
}: {
  code: PreparationCode | undefined;
  category?: string | null;
  className?: string;
}) {
  const Icon = classifyItemIcon(category, code);
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}

/**
 * What kind of thing this row is.
 *
 * The payload carried a thumbnail and a title and nothing else, so a bottled
 * Coke and a slow-cooked luwombo were presented identically — same controls,
 * same "AI suggests", same prep language. The chip is the smallest honest fix:
 * it says what the item is before the numbers claim what to do with it.
 */
function CategoryChip({ item }: { item: PrepPlanItem }) {
  const { t } = useTranslation();
  const label = categoryChipLabel(t, item);
  if (!label) return null;
  const code = item.preparation_type?.code;
  return (
    <span
      title={item.preparation_type?.basis || undefined}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-surface-4 bg-surface-3/60 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary"
    >
      <PreparationIcon code={code} category={item.product_category} className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
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
  // Bigger than the old 40/36px tiles — planning is a review surface, not a
  // dense console, so the image is allowed to actually carry recognition
  // weight instead of reading as a decorative corner dot.
  const imgCls =
    size === "lg"
      ? "h-16 w-16 shrink-0 rounded-xl border border-surface-4"
      : "h-12 w-12 shrink-0 rounded-xl border border-surface-4";
  const iconCls = size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <div className="flex items-center gap-3">
      <ItemImage item={item} className={imgCls} iconClassName={iconCls} />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight text-text-primary">
          {item.product_title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <CategoryChip item={item} />
          <span className="text-[11px] text-text-muted">
            {popularityLabel(t, rank)}
          </span>
        </div>
      </div>
    </div>
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
    <>
      <p className="font-display text-lg font-semibold text-text-primary">
        {formatQuantity(item.suggested_quantity, item.unit)}
      </p>
      <UncertaintyNote item={item} />
    </>
  );
}

/**
 * The honest caption under a prep quantity.
 *
 * The point estimate stays, because a chef cannot prep "115 to 150" — the plan
 * has to name a number. What it must not do is imply that number was measured
 * when it was borrowed or guessed from four days of history. So the range and
 * the provenance sit directly beneath it, at caption weight, and only when the
 * backend says a single number would overstate what we know.
 */
function UncertaintyNote({ item }: { item: PrepPlanItem }) {
  const { t } = useTranslation();
  const band = item.forecast_context.confidence_band;
  const coldStart = item.cold_start;

  if (!band?.lead_with_range && !coldStart) return null;

  return (
    <span className="mt-1 flex flex-col gap-0.5">
      {band?.lead_with_range ? (
        <span className="text-xs text-text-secondary">
          {t("today.table.likelyRange", {
            lower: band.lower,
            upper: band.upper,
          })}
        </span>
      ) : null}
      {coldStart ? (
        <span
          title={coldStart.explanation}
          className="inline-flex w-fit items-center rounded-full border border-surface-4 px-1.5 py-0.5 text-[10px] font-medium text-text-muted"
        >
          {coldStart.origin_label}
        </span>
      ) : null}
    </span>
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
  if (!onOverrideReason) return null;
  const suggested = netSuggestedQty(item);
  // Kept mounted rather than unmounted so the reveal can animate: dropping
  // the node on every keystroke is what made the row snap open and shut.
  const open =
    !disabled &&
    planned != null &&
    Math.abs(planned - suggested) / Math.max(suggested, 1) >= 0.15;
  const selected = item.override_reason || "";
  return (
    <div
      aria-hidden={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {t("today.override.why")}
          </span>
          {OVERRIDE_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() =>
                onOverrideReason(item.id, selected === reason ? "" : reason)
              }
              className={`inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold transition-all duration-150 active:scale-[0.98] ${
                selected === reason
                  ? "border-brand-gold/60 bg-brand-gold/15 text-brand-gold"
                  : "border-surface-4 text-text-muted hover:bg-surface-3"
              }`}
            >
              {t(`today.override.${reason.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>
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
  const { currency } = useMoney();
  const line = overrideImpactLine(
    t,
    impact,
    variance,
    suggestedQuantity,
    currency,
  );
  const precedent = overridePrecedentLine(
    t,
    impact?.historical_precedent,
    unit,
    currency,
  );
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
      {precedent ? (
        <p
          className={`mt-0.5 text-[11px] ${
            precedent.tone === "warning"
              ? "text-status-warning"
              : precedent.tone === "success"
                ? "text-status-success"
                : "text-text-muted"
          }`}
        >
          {precedent.text}
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
  planned = null,
}: {
  item: PrepPlanItem;
  value: number | "";
  disabled: boolean;
  onChange: (value: string) => void;
  widthClass: string;
  /** Resolved numeric value (null when empty) — pass when available so the
   * "still just a suggestion" styling can be derived without re-parsing. */
  planned?: number | null;
}) {
  const { t } = useTranslation();
  // Pre-filled with the AI's number but untouched: say so with a quieter,
  // dashed treatment rather than the solid "this is what you decided" look,
  // so it reads as editable rather than final.
  const isSuggested = isUnconfirmedSuggestion(
    item,
    planned ?? (value === "" ? null : Number(value)),
  );
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        {isSuggested ? (
          <Sparks
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-gold/60"
            strokeWidth={1.5}
          />
        ) : null}
        <input
          type="number"
          step={isDiscreteUnit(item.unit) ? 1 : 0.01}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          title={isSuggested ? t("today.table.prefilledHint") : undefined}
          className={`h-8 ${widthClass} rounded-lg border bg-surface-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 disabled:opacity-60 ${
            isSuggested
              ? "border-dashed border-brand-gold/40 pl-7 pr-2.5 text-text-secondary"
              : "border-surface-4 px-2.5 text-text-primary"
          }`}
        />
      </div>
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
  // Confirming "my quantity" is meaningless until a quantity exists — the
  // input starts empty by design, so gate the button on it being filled.
  const hasEnteredQuantity = planned != null && !Number.isNaN(planned);
  return (
    <>
      <button
        type="button"
        onClick={() => onAccept(item.id, netSuggestedQty(item), item.unit)}
        disabled={disabled}
        className={`inline-flex ${h} items-center justify-center rounded-full border border-status-success/40 bg-status-success/15 px-3 text-xs font-semibold text-status-success transition-all duration-150 hover:bg-status-success/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success/30`}
      >
        {t("today.table.accept")}
      </button>
      <button
        type="button"
        onClick={() => onKeep(item.id, planned, item.unit)}
        disabled={disabled || !hasEnteredQuantity}
        title={hasEnteredQuantity ? undefined : t("today.table.keepMineHint")}
        className={`inline-flex ${h} items-center justify-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-all duration-150 hover:bg-surface-3 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/20`}
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
  onMarkUnavailable?: (item: { id: string; title: string }) => void;
  whyLabelKey: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
      {isMorning && onMarkUnavailable ? (
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
  const { signedMoney } = useMoney();
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
        {signedMoney(impact.margin_impact_estimate)}
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
  const { money } = useMoney();
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
                revenue: money(financials.revenueIfSold),
                margin: money(financials.marginIfSold),
              })
            : t("today.table.ifSoldOut", {
                revenue: money(financials.revenueIfSold),
              })}
        </p>
      )}
      {financials.wasteIfAll != null && (
        <p>{t("today.table.ifWasted", { cost: money(financials.wasteIfAll) })}</p>
      )}
      {financials.lostMarginIfStockout != null && financials.shortfallQty > 0 && (
        <p>
          {t("today.table.stockoutWarning", {
            quantity: formatQuantity(financials.shortfallQty, financials.unit),
            margin: money(financials.lostMarginIfStockout),
          })}
        </p>
      )}
    </div>
  );
}

/** The plain-language headline, with the raw model lines kept underneath. */
function WhyNarrative({
  item,
  weekday,
}: {
  item: PrepPlanItem;
  weekday: string;
}) {
  const { t } = useTranslation();
  const { lead, details } = humanizeReasoning(t, item, weekday);
  return (
    <>
      <p className="text-xs leading-relaxed text-text-primary">{lead}</p>
      {details.length ? (
        <div className="mt-2 border-t border-surface-4/40 pt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.why.detailsHeading")}
          </p>
          <div className="space-y-0.5">
            {details.map((line) => (
              <p key={`r-${item.id}-${line}`}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Full "why this quantity" explainer: reasoning, constraints, signals, money. */
function WhyPanel({
  item,
  planned,
  impact,
  layout,
  weekday,
}: {
  item: PrepPlanItem;
  planned: number | null;
  impact: ImpactPreview | undefined;
  layout: "stack" | "grid";
  weekday: string;
}) {
  const { t } = useTranslation();
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-1 gap-4 pt-3 text-[11px] text-text-secondary md:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.table.whyThisQuantity")}
          </p>
          <WhyNarrative item={item} weekday={weekday} />
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
      <WhyNarrative item={item} weekday={weekday} />
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
// Stock levels — the STOCKED tier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bottled drinks and packaged goods.
 *
 * Deliberately a much thinner surface than a prep row. Everything dropped here
 * was meaningless for this tier and actively misleading in aggregate: there is
 * no recipe, so no "why this quantity" panel; a sealed bottle does not spoil,
 * so the waste-risk badge was noise; and an override reason for "I stocked 48
 * instead of 50" is not training data worth collecting. What remains is the
 * one useful question — how many will sell, and how many do you want on hand.
 */
function StockLevelsSection({
  rows,
  forecastRankById,
  plannedQtyByItem,
  onPlannedChange,
  onAcceptSuggestion,
  onKeepMyPlan,
  actionErrorByItem,
  editingDisabled,
  branchId,
  isMorning,
  onMarkUnavailable,
  readOnly,
}: {
  rows: PrepRow[];
  forecastRankById: Record<string, number>;
  plannedQtyByItem: PrepPlanSectionProps["plannedQtyByItem"];
  onPlannedChange: PrepPlanSectionProps["onPlannedChange"];
  onAcceptSuggestion: PrepPlanSectionProps["onAcceptSuggestion"];
  onKeepMyPlan: PrepPlanSectionProps["onKeepMyPlan"];
  actionErrorByItem: Record<string, string>;
  editingDisabled: boolean;
  branchId: string;
  isMorning: boolean;
  onMarkUnavailable: PrepPlanSectionProps["onMarkUnavailable"];
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  if (!rows.length) return null;

  return (
    <section className="mb-11">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
          {t("today.stock.title")}
        </p>
        <h3 className="font-display text-xl font-semibold text-text-primary sm:text-2xl">
          {t("today.stock.subtitle")}
        </h3>
        <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">
          {t("today.stock.explainer")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ item, planned }) => (
          <article
            key={`stock-${item.id}`}
            className="rounded-xl border border-surface-4 bg-surface-2 p-4"
          >
            <ItemIdentity
              item={item}
              rank={forecastRankById[item.id] ?? 999}
              size="lg"
            />

            <div className="mt-3 flex items-end justify-between gap-3 border-t border-surface-4/60 pt-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("today.stock.expectedToSell")}
                </p>
                <p className="mt-0.5 font-display text-lg font-semibold text-text-primary">
                  {formatQuantity(item.suggested_quantity, item.unit)}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("today.stock.haveOnHand")}
                </p>
                <PlannedInput
                  item={item}
                  value={plannedQtyByItem[item.id] ?? ""}
                  disabled={editingDisabled}
                  onChange={(value) => onPlannedChange(item.id, value, item.unit)}
                  widthClass="w-20"
                  planned={planned}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <AcceptKeepButtons
                item={item}
                planned={planned}
                disabled={editingDisabled}
                onAccept={onAcceptSuggestion}
                onKeep={onKeepMyPlan}
              />
              <Link
                href={`/workspace/items/${item.product_id}?branch=${branchId}`}
                className="ml-auto text-[11px] font-medium text-text-muted transition-colors hover:text-brand-gold"
              >
                {t("today.table.trackRecord")}
              </Link>
              {isMorning && !readOnly ? (
                <button
                  type="button"
                  onClick={() =>
                    onMarkUnavailable({
                      id: item.product_id,
                      title: item.product_title,
                    })
                  }
                  className="text-[11px] font-medium text-text-muted transition-colors hover:text-status-warning"
                >
                  {t("today.stock.markOutOfStock")}
                </button>
              ) : null}
            </div>

            <DecisionFeedback
              item={item}
              error={actionErrorByItem[item.id]}
              className="mt-2"
            />
          </article>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────────────────────

export function PrepPlanSection(props: PrepPlanSectionProps) {
  const { t, language } = useTranslation();
  const { money } = useMoney();
  const {
    branchDay,
    rows,
    stockRows = [],
    totalRowCount,
    forecastRankById,
    decisionSummary,
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
    readOnly = false,
  } = props;

  const editingDisabled = isPlanLocked || readOnly;

  // Named day, for the plain-language explanation ("recent Mondays…").
  const weekday = new Date(`${targetDate}T12:00:00`).toLocaleDateString(
    language === "fr" ? "fr-FR" : "en-US",
    { weekday: "long" },
  );

  const lockStartButtons = readOnly ? null : (
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
    <>
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
                  {money(branchDay.morning_overview?.projected_margin_total ?? 0)}
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
        <div className="flex flex-wrap items-center gap-2">{lockStartButtons}</div>
      </div>

      {!isPlanLocked ? (
        readOnly ? null : (
          <p className="mb-4 text-xs text-text-muted">
            {t("today.prepPlan.lockFirst")}
          </p>
        )
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
                  title={riskKindHint(t, planRiskBreakdown(item, planned, impact).kind)}
                  className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskTone(riskScore)}`}
                >
                  {qualifiedRiskLabel(
                    t,
                    riskScore,
                    planRiskBreakdown(item, planned, impact).kind,
                  )}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 divide-x divide-surface-4/60 border-y border-surface-4/60">
                <div className="min-w-0 px-4 py-2.5">
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
                <div className="min-w-0 px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {t("today.table.yourPlan")}
                  </p>
                  <div className="mt-1">
                    <PlannedInput
                      item={item}
                      value={plannedQtyByItem[item.id] ?? ""}
                      disabled={editingDisabled}
                      onChange={(value) => onPlannedChange(item.id, value, item.unit)}
                      widthClass="w-20"
                      planned={planned}
                    />
                  </div>
                  <VarianceLine
                    variance={variance}
                    unit={item.unit}
                    impact={impact}
                    suggestedQuantity={netSuggestedQty(item)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 px-4 py-3">
                <div className="grid grid-cols-2 gap-2">
                  <AcceptKeepButtons
                    item={item}
                    planned={planned}
                    disabled={editingDisabled}
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
                  onMarkUnavailable={readOnly ? undefined : onMarkUnavailable}
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
                disabled={editingDisabled}
                onOverrideReason={onOverrideReason}
                className="px-4 pb-3"
              />

              {isExpanded ? (
                <WhyPanel
                  item={item}
                  planned={planned}
                  impact={impact}
                  layout="stack"
                  weekday={weekday}
                />
              ) : null}
            </article>
          );
        })}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 lg:block scrollbar-thin">
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
                        title={riskKindHint(t, planRiskBreakdown(item, planned, impact).kind)}
                        className={`mt-1.5 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${riskTone(riskScore)}`}
                      >
                        {qualifiedRiskLabel(
                          t,
                          riskScore,
                          planRiskBreakdown(item, planned, impact).kind,
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <PlannedInput
                        item={item}
                        value={plannedQtyByItem[item.id] ?? ""}
                        disabled={editingDisabled}
                        onChange={(value) => onPlannedChange(item.id, value, item.unit)}
                        widthClass="w-24"
                        planned={planned}
                      />
                      <VarianceLine
                        variance={variance}
                        unit={item.unit}
                        impact={impact}
                        suggestedQuantity={netSuggestedQty(item)}
                      />
                      <DecisionFeedback
                        item={item}
                        error={actionErrorByItem[item.id]}
                        className="mt-1"
                      />
                      <OverrideReasonChips
                        item={item}
                        planned={planned}
                        disabled={editingDisabled}
                        onOverrideReason={onOverrideReason}
                        className="mt-1.5 max-w-65"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AcceptKeepButtons
                          item={item}
                          planned={planned}
                          disabled={editingDisabled}
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
                          onMarkUnavailable={readOnly ? undefined : onMarkUnavailable}
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
                          weekday={weekday}
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
          {!isPlanLocked && !readOnly && (
            <span className="ml-3 text-xs text-text-muted">
              {t("today.prepPlan.lockToStart")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">{lockStartButtons}</div>
      </div>
    </section>

    <StockLevelsSection
      rows={stockRows}
      forecastRankById={forecastRankById}
      plannedQtyByItem={plannedQtyByItem}
      onPlannedChange={onPlannedChange}
      onAcceptSuggestion={onAcceptSuggestion}
      onKeepMyPlan={onKeepMyPlan}
      actionErrorByItem={actionErrorByItem}
      editingDisabled={editingDisabled}
      branchId={branchId}
      isMorning={isMorning}
      onMarkUnavailable={onMarkUnavailable}
      readOnly={readOnly}
    />
    </>
  );
}
