"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useOperationsHistorySnapshot,
} from "@/services";
import { useTranslation } from "@/lib/i18n";

const EMPTY_LIST: never[] = [];

const REACTION_DISPLAY: Record<string, { emoji: string; label: string }> = {
  FIRED_UP: { emoji: "🔥", label: "Fired up" },
  GOOD:     { emoji: "😊", label: "Good" },
  MEH:      { emoji: "😐", label: "Meh" },
  ROUGH:    { emoji: "😮‍💨", label: "Rough one" },
};

const PATTERN_ICON: Record<string, string> = {
  ACCURACY_IMPROVING: "↑",
  ACCURACY_DECLINING: "↓",
  WASTE_TRENDING_UP:  "↑",
  WASTE_DECLINING:    "↓",
  REPEAT_STOCKOUT:    "⚡",
  REPEAT_WASTE:       "○",
  STRONG_STREAK:      "✓",
};

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatShortDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatLongDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function computeGrade(accuracy: number, stockouts: number) {
  if (accuracy >= 85 && stockouts === 0) return { label: "Great day", cls: "text-status-success" };
  if (accuracy >= 75 && stockouts <= 1)  return { label: "Good day",  cls: "text-status-success" };
  if (accuracy >= 60)                     return { label: "Solid day", cls: "text-status-warning" };
  return { label: "Tough one", cls: "text-status-critical" };
}

function fmtQty(v: number, unit: string) {
  return `${v % 1 === 0 ? v : v.toFixed(1)} ${unit}`;
}

function HistoryContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();

  const canAccess = Boolean(user?.has_organization);
  const canViewAllBranches = Boolean(accessScope?.can_view_all_branches);
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const scopedBranchIds = new Set(accessibleBranches.map((b) => b.id));

  const branchOptions = useMemo(() => {
    if (canViewAllBranches) return branches;
    if (accessibleBranches.length) {
      if (!branches.length) return accessibleBranches;
      return branches.filter((b) => scopedBranchIds.has(b.id));
    }
    return [];
  }, [accessibleBranches, branches, canViewAllBranches, scopedBranchIds]);

  const defaultBranch =
    branchOptions.find((b) => b.id === accessScope?.default_branch_id) ??
    branchOptions.find((b) => b.is_primary) ??
    branchOptions[0] ??
    null;

  const [selectedBranchId, setSelectedBranchId] = useState(
    searchParams.get("branch") ?? (defaultBranch?.id ?? ""),
  );
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") ?? "");
  const [windowDays, setWindowDays] = useState(30);

  useEffect(() => {
    if (!selectedBranchId && defaultBranch?.id) setSelectedBranchId(defaultBranch.id);
  }, [defaultBranch?.id, selectedBranchId]);

  useEffect(() => {
    if (!branchOptions.length || !selectedBranchId) return;
    if (!branchOptions.some((b) => b.id === selectedBranchId) && defaultBranch?.id)
      setSelectedBranchId(defaultBranch.id);
  }, [branchOptions, defaultBranch?.id, selectedBranchId]);

  useEffect(() => {
    if (!isLoading && !canAccess) router.replace("/");
  }, [isLoading, canAccess, router]);

  // Chart query — never includes target_date so clicking bars never shifts the window
  const timelineQuery = useOperationsHistorySnapshot({
    branch_id: selectedBranchId,
    window_days: windowDays,
  });

  // Day-detail query — separate request, only changes the summary/items/patterns below
  const dayDetailQuery = useOperationsHistorySnapshot({
    branch_id: selectedBranchId,
    target_date: selectedDate || undefined,
    window_days: windowDays,
  });

  const summary   = dayDetailQuery.data?.summary ?? null;
  const items     = dayDetailQuery.data?.items ?? EMPTY_LIST;
  const patterns  = timelineQuery.data?.patterns ?? EMPTY_LIST;

  // Timeline bars always come from the stable (no-target_date) query
  const chronoTimeline = useMemo(
    () => [...(timelineQuery.data?.timeline ?? [])].reverse(),
    [timelineQuery.data?.timeline],
  );

  // Auto-select the most recent date when the chart first loads
  useEffect(() => {
    if (!selectedDate && timelineQuery.data?.anchor_date) {
      setSelectedDate(timelineQuery.data.anchor_date);
    }
  }, [timelineQuery.data?.anchor_date, selectedDate]);

  const grade = summary ? computeGrade(summary.forecast_accuracy, summary.stockout_count) : null;

  // Split items into outcome buckets
  const { cleanItems, wasteItems, stockoutItems, overrideItems } = useMemo(() => {
    const clean: typeof items = [];
    const waste: typeof items = [];
    const out: typeof items = [];
    const overrides: typeof items = [];
    for (const item of items) {
      const prepared = item.planned_qty + item.additional_qty;
      const wasteRatio = prepared > 0 ? item.waste_qty / prepared : 0;
      if (item.stockout_flag) out.push(item);
      else if (wasteRatio > 0.08) waste.push(item);
      else clean.push(item);
      if (item.decision === "CHEF_OVERRIDE" || item.decision === "OVERRIDE") {
        overrides.push(item);
      }
    }
    return { cleanItems: clean, wasteItems: waste, stockoutItems: out, overrideItems: overrides };
  }, [items]);

  const gradeLabelMap: Record<string, string> = useMemo(() => ({
    "Great day": t("workspace.history.gradeGreat"),
    "Good day": t("workspace.history.gradeGood"),
    "Solid day": t("workspace.history.gradeSolid"),
    "Tough one": t("workspace.history.gradeTough"),
  }), [t]);

  return (
    <WorkspaceShell
      eyebrow={t("workspace.history.eyebrow")}
      title={t("workspace.history.title")}
      description={t("workspace.history.description")}
      insight={t("workspace.history.insight")}
    >
      {/* ── CONTROLS ── */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-50 flex-1">
          <label className="block text-xs font-medium text-text-muted mb-1.5">{t("workspace.history.branchLabel")}</label>
          <Select
            value={selectedBranchId}
            onChange={(value) => { setSelectedBranchId(value); setSelectedDate(""); }}
            options={branchOptions.map((b) => ({ label: b.name, value: b.id }))}
            placeholder={t("workspace.history.selectBranch")}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">{t("workspace.history.windowLabel")}</label>
          <div className="flex h-12 items-center gap-1 rounded-button border border-border-default bg-surface-3 px-2">
            {[7, 14, 30].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindowDays(w)}
                className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
                  windowDays === w
                    ? "bg-brand-gold/20 text-brand-gold"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-40">
          <label className="block text-xs font-medium text-text-muted mb-1.5">{t("workspace.history.jumpToDate")}</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-12 w-full rounded-button border border-border-default bg-surface-3 px-4 text-sm text-text-secondary"
          />
        </div>
      </div>

      {/* ── BAR CHART TIMELINE ── */}
      <section className="mt-8 rounded-2xl border border-surface-4 bg-surface-2 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("workspace.history.forecastAccuracyTimeline", { days: timelineQuery.data?.window_days ?? windowDays })}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-status-success/70" /> {t("workspace.history.legendClean")}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-status-warning/70" /> {t("workspace.history.legendWaste")}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-status-critical/70" /> {t("workspace.history.legendStockout")}</span>
          </div>
        </div>
        {chronoTimeline.length ? (
          <div className="flex items-end gap-0.5 overflow-x-auto pb-1">
            {chronoTimeline.map((day) => {
              const isActive = day.date === selectedDate;
              const barHeight = Math.max(4, Math.round((day.forecast_accuracy / 100) * 64));
              const barColor = isActive
                ? "bg-brand-gold"
                : day.stockout_count > 0
                  ? "bg-status-critical/60 hover:bg-status-critical/80"
                  : day.waste_cost > 50
                    ? "bg-status-warning/60 hover:bg-status-warning/80"
                    : "bg-status-success/50 hover:bg-status-success/70";
              const reaction = day.day_reaction ? REACTION_DISPLAY[day.day_reaction] : null;
              const weekday = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
              return (
                <button
                  key={day.date}
                  type="button"
                  title={day.stockout_count
                    ? t("workspace.history.barTitleWithStockouts", { date: formatShortDate(day.date), accuracy: day.forecast_accuracy.toFixed(0), count: day.stockout_count })
                    : t("workspace.history.barTitle", { date: formatShortDate(day.date), accuracy: day.forecast_accuracy.toFixed(0) })
                  }
                  onClick={() => setSelectedDate(day.date)}
                  className="group flex w-8 shrink-0 flex-col items-center"
                >
                  {/* Emoji slot — fixed height so bars never shift */}
                  <span
                    aria-hidden="true"
                    className={`block h-4 text-center text-[9px] leading-4 transition-opacity duration-150 ${reaction ? "opacity-0 group-hover:opacity-100" : "invisible"}`}
                  >
                    {reaction?.emoji ?? "·"}
                  </span>
                  {/* Bar column — fixed 72px height, bar grows from bottom */}
                  <div className="flex h-18 w-full items-end justify-center">
                    <div
                      style={{ height: barHeight }}
                      className={`w-4 rounded-t-sm transition-colors ${barColor}`}
                    />
                  </div>
                  {/* Selection dot */}
                  <div className={`mt-0.5 h-1 w-1 rounded-full transition-colors ${isActive ? "bg-brand-gold" : "bg-transparent"}`} />
                  {/* Label */}
                  <p className={`mt-0.5 text-[9px] transition-colors ${isActive ? "font-semibold text-brand-gold" : "text-text-muted"}`}>
                    {weekday}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-text-muted py-6 text-center">
            {timelineQuery.isLoading ? t("workspace.history.loadingHistory") : t("workspace.history.noServiceDays")}
          </p>
        )}
      </section>

      {/* ── PATTERNS ── */}
      {patterns.length > 0 && (
        <section className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-3">
            {t("workspace.history.patternsSpotted")}
          </p>
          <div className="space-y-2">
            {patterns.map((p, i) => {
              const icon = PATTERN_ICON[p.type] ?? "·";
              const cls =
                p.severity === "positive"
                  ? "border-status-success/30 bg-status-success/6 text-status-success"
                  : p.severity === "critical"
                    ? "border-status-critical/30 bg-status-critical/6 text-status-critical"
                    : "border-status-warning/30 bg-status-warning/6 text-status-warning";
              return (
                <div key={i} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cls}`}>
                  <span className="shrink-0 font-semibold w-4 text-center">{icon}</span>
                  <p className="text-sm">{p.message}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── SELECTED DAY ── */}
      {summary ? (
        <section className="mt-8 space-y-6">
          {/* Grade + headline */}
          <div className="flex flex-col gap-1 border-b border-surface-4/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {formatLongDate(summary.date)}
              </p>
              <h3 className={`mt-1 font-display text-3xl font-semibold ${grade?.cls}`}>
                {grade?.label ? gradeLabelMap[grade.label] ?? grade.label : ""}
              </h3>
            </div>
            <div className="flex gap-6 text-sm text-text-muted">
              <span>
                <span className="font-semibold text-text-primary">{summary.forecast_accuracy.toFixed(0)}%</span> {t("workspace.history.accuracy")}
              </span>
              <span>
                <span className="font-semibold text-text-primary">{toCurrency(summary.waste_cost)}</span> {t("workspace.history.waste")}
              </span>
              <span>
                <span className={`font-semibold ${summary.stockout_count > 0 ? "text-status-critical" : "text-status-success"}`}>
                  {summary.stockout_count === 0 ? t("workspace.history.noStockouts") : summary.stockout_count}
                </span> {summary.stockout_count !== 1 ? t("workspace.history.stockouts") : t("workspace.history.stockout")}
              </span>
              {summary.revenue > 0 && (
                <span>
                  <span className="font-semibold text-text-primary">{toCurrency(summary.revenue)}</span> {t("workspace.history.revenue")}
                </span>
              )}
            </div>
          </div>

          {/* Reaction + note */}
          {(summary.day_reaction || summary.session_notes) && (
            <div className="flex items-start gap-3 rounded-xl border border-surface-4 bg-surface-3 px-4 py-3">
              {summary.day_reaction && REACTION_DISPLAY[summary.day_reaction] && (
                <div className="shrink-0 text-center">
                  <span className="text-2xl">{REACTION_DISPLAY[summary.day_reaction].emoji}</span>
                  <p className="mt-0.5 text-[10px] text-text-muted">{t(`workspace.history.reaction${summary.day_reaction}`)}</p>
                </div>
              )}
              {summary.session_notes && (
                <p className="text-sm text-text-secondary italic">"{summary.session_notes}"</p>
              )}
            </div>
          )}

          {/* KPI row */}
          {(summary.decision_support_rate !== undefined || summary.estimated_net_impact !== undefined || summary.lost_revenue_estimate > 0) && (
            <div className="grid grid-cols-2 gap-px bg-surface-4/40 rounded-xl overflow-hidden sm:grid-cols-4">
              {[
                summary.decision_support_rate !== undefined && {
                  label: t("workspace.history.kpiAiPlanFollowed"),
                  value: `${summary.decision_support_rate.toFixed(0)}%`,
                  sub: t("workspace.history.kpiItemsAccepted"),
                },
                summary.estimated_net_impact !== undefined && summary.estimated_net_impact !== 0 && {
                  label: t("workspace.history.kpiNetImpact"),
                  value: toCurrency(Math.abs(summary.estimated_net_impact)),
                  sub: summary.estimated_net_impact >= 0 ? t("workspace.history.kpiProtected") : t("workspace.history.kpiLostExposure"),
                },
                summary.lost_revenue_estimate > 0 && {
                  label: t("workspace.history.kpiLostRevenue"),
                  value: toCurrency(summary.lost_revenue_estimate),
                  sub: t("workspace.history.kpiFromStockouts"),
                },
                {
                  label: t("workspace.history.kpiItemsPlanned"),
                  value: summary.prep_items_planned,
                  sub: t("workspace.history.kpiOnPrepList"),
                },
              ]
                .filter(Boolean)
                .slice(0, 4)
                .map((k) => {
                  if (!k) return null;
                  return (
                    <div key={k.label as string} className="bg-surface-2 px-5 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{k.label}</p>
                      <p className="mt-2 font-display text-2xl font-semibold text-text-primary">{k.value}</p>
                      <p className="mt-0.5 text-[11px] text-text-muted">{k.sub}</p>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Item scorecard */}
          {items.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-3">
                {t("workspace.history.howEachItemDid")}
              </p>
              <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
                {/* Stockouts first, then waste, then clean */}
                {[...stockoutItems, ...wasteItems, ...cleanItems].map((item) => {
                  const prepared = item.planned_qty + item.additional_qty;
                  const isStockout = item.stockout_flag;
                  const wasteRatio = prepared > 0 ? item.waste_qty / prepared : 0;
                  const hasWaste = !isStockout && wasteRatio > 0.08;
                  const outcome = isStockout
                    ? { icon: "⚡", label: t("workspace.history.ranShort"),  cls: "text-status-critical" }
                    : hasWaste
                      ? { icon: "○", label: t("workspace.history.hadWaste"),  cls: "text-status-warning" }
                      : { icon: "✓", label: t("workspace.history.soldClean"), cls: "text-status-success" };
                  return (
                    <div key={item.item_id} className="flex items-center gap-4 px-5 py-3">
                      <span className={`shrink-0 w-5 text-center font-semibold ${outcome.cls}`}>{outcome.icon}</span>
                      <Link
                        href={`/workspace/items/${item.item_id}?branch=${selectedBranchId}`}
                        className="flex-1 min-w-0 text-sm font-medium text-text-primary truncate hover:text-brand-gold transition-colors"
                      >
                        {item.item_title ?? t("workspace.history.unknown")}
                      </Link>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-text-muted">
                          {t("workspace.history.soldCount", { qty: fmtQty(item.actual_sales, item.unit) })}
                        </p>
                        {isStockout && item.lost_revenue_estimate > 0 && (
                          <p className="text-xs text-status-critical">{t("workspace.history.missedRevenue", { amount: toCurrency(item.lost_revenue_estimate) })}</p>
                        )}
                        {hasWaste && (
                          <p className="text-xs text-status-warning">{t("workspace.history.wasteCount", { qty: fmtQty(item.waste_qty, item.unit) })}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chef vs AI */}
          {overrideItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-3">
                {t("workspace.history.changedAiPlan")}
              </p>
              <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
                {overrideItems.map((item) => {
                  const aiQty   = item.forecast_qty;
                  const chefQty = item.planned_qty + item.additional_qty;
                  const actual  = item.actual_sales;
                  const aiErr   = Math.abs(aiQty - actual);
                  const chefErr = Math.abs(chefQty - actual);
                  const verdict =
                    chefErr < aiErr * 0.9  ? { label: t("workspace.history.yourCallPaidOff"), cls: "text-status-success" }
                    : aiErr < chefErr * 0.9 ? { label: t("workspace.history.aiWasCloser"),      cls: "text-status-warning" }
                    :                          { label: t("workspace.history.aboutEven"),          cls: "text-text-muted" };
                  return (
                    <div key={item.item_id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3">
                      <Link href={`/workspace/items/${item.item_id}?branch=${selectedBranchId}`} className="min-w-35 text-sm font-medium text-text-primary hover:text-brand-gold transition-colors">{item.item_title ?? "—"}</Link>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>{t("workspace.history.ai")}: <span className="font-medium text-text-secondary">{fmtQty(aiQty, item.unit)}</span></span>
                        <span>→</span>
                        <span>{t("workspace.history.you")}: <span className="font-medium text-text-secondary">{fmtQty(chefQty, item.unit)}</span></span>
                        <span>→</span>
                        <span>{t("workspace.history.sold")}: <span className="font-semibold text-text-primary">{fmtQty(actual, item.unit)}</span></span>
                      </div>
                      <span className={`ml-auto text-xs font-semibold ${verdict.cls}`}>{verdict.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      ) : (
        !dayDetailQuery.isLoading && (
          <div className="mt-10 py-12 text-center">
            <p className="text-sm text-text-muted">
              {dayDetailQuery.data?.data_note ?? t("workspace.history.selectDay")}
            </p>
          </div>
        )
      )}

      {dayDetailQuery.data?.data_note && summary && (
        <div className="mt-4 rounded-xl border border-surface-4 bg-surface-2 px-4 py-3 text-xs text-text-muted">
          {dayDetailQuery.data.data_note}
        </div>
      )}
    </WorkspaceShell>
  );
}

export default function HistoryPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          {t("workspace.history.loadingFallback")}
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
