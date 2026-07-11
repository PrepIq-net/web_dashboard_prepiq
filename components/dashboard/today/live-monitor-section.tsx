"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { formatQuantity, isDiscreteUnit } from "@/lib/format";
import type {
  BranchDayToday,
  BranchPaceSummary,
  PrepPlanItem,
} from "@/services/production-intelligence/types";
import { LivePaceBanner } from "./live-pace-banner";
import { CsvImportModal } from "./csv-import-modal";
import type { LiveRow } from "./today-helpers";

type PaceItem = BranchPaceSummary["items"][number];

export type LiveMonitorSectionProps = {
  branchDay: BranchDayToday;
  criticalRows: LiveRow[];
  watchRows: LiveRow[];
  okRows: LiveRow[];
  paceSummary: BranchPaceSummary | null;
  paceAlertByProductId: Map<string, PaceItem>;
  showCsvImportBanner: boolean;
  onDismissCsvBanner: () => void;
  closePending: boolean;
  onCloseDay: () => void;
  onLogProduction: (
    prepPlanItemId: string,
    quantityProduced: number,
    reason?: string,
  ) => void;
  onQuickSale: (
    prepPlanItemId: string,
    item: { product_id: string; unit: string },
    quantitySold: number,
  ) => void;
  onLogWaste: (item: { id: string; title: string; unit: string }) => void;
  branchId: string;
  targetDate: string;
};

/** Item-level pace note vs the branch's typical curve. */
function PaceLine({
  paceItem,
  tone,
}: {
  paceItem: PaceItem | undefined;
  tone: "critical" | "warning";
}) {
  const { t } = useTranslation();
  const pos = paceItem?.cumulative_position;
  if (!pos) return null;
  const pctVsTypical = Math.round((pos.cumulative_ratio - 1) * 100);
  const surgeClass =
    tone === "critical"
      ? pos.alert_level === "CRITICAL"
        ? "text-status-critical"
        : "text-status-warning"
      : "text-status-warning";
  return (
    <p
      className={`mt-1.5 text-xs font-medium ${
        pos.status === "SURGE" ? surgeClass : "text-status-info"
      }`}
      title={paceItem?.alert_reason}
    >
      {pos.status === "SURGE"
        ? t("today.pace.itemSurge", {
            pct: `+${pctVsTypical}%`,
            projected: Math.round(pos.projected_total_at_close),
          })
        : t("today.pace.itemSlowdown", {
            pct: `${pctVsTypical}%`,
            projected: Math.round(pos.projected_total_at_close),
          })}
    </p>
  );
}

export function LiveMonitorSection(props: LiveMonitorSectionProps) {
  const { t } = useTranslation();
  const {
    branchDay,
    criticalRows,
    watchRows,
    okRows,
    paceSummary,
    paceAlertByProductId,
    showCsvImportBanner,
    onDismissCsvBanner,
    closePending,
    onCloseDay,
    onLogProduction,
    onQuickSale,
    onLogWaste,
    branchId,
    targetDate,
  } = props;

  const [showOkRows, setShowOkRows] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const wasteButton = (item: PrepPlanItem, compact = false) => (
    <button
      type="button"
      onClick={() =>
        onLogWaste({ id: item.id, title: item.product_title, unit: item.unit })
      }
      className={
        compact
          ? "inline-flex h-7 items-center rounded-full border border-surface-4 px-2.5 text-[11px] text-text-muted hover:border-status-warning/50 hover:text-status-warning active:scale-[0.97]"
          : "inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted hover:border-status-warning/50 hover:text-status-warning active:scale-[0.97]"
      }
    >
      {t("today.live.logWaste")}
    </button>
  );

  return (
    <section className="mt-8">
      {/* Live header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-status-success animate-pulse" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-success">
              {t("today.live.status")}
            </p>
            <h3 className="font-display text-2xl font-semibold text-text-primary">
              {t("today.live.monitor")}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCsvModalOpen(true)}
            className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary hover:border-brand-gold/50 hover:text-brand-gold"
          >
            {t("today.live.csvImport")}
          </button>
          <button
            type="button"
            onClick={onCloseDay}
            disabled={closePending}
            className="inline-flex h-9 items-center justify-center rounded-full border border-surface-4 px-5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-status-critical/60 hover:text-status-critical active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {closePending ? t("today.live.closing") : t("today.live.closeDay")}
          </button>
        </div>
      </div>
      <LivePaceBanner pace={paceSummary} />

      {showCsvImportBanner ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-status-success/35 bg-status-success/10 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-status-success">
              {t("today.live.csvImportComplete")}
            </p>
            <p className="mt-1 text-sm text-text-primary">
              {t("today.live.csvImportDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissCsvBanner}
            className="text-xs font-semibold text-status-success hover:text-status-success/80"
          >
            {t("today.live.dismiss")}
          </button>
        </div>
      ) : null}

      <CsvImportModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        branchId={branchId}
        targetDate={targetDate}
      />

      {/* System health banner — POS / data gap alert */}
      {branchDay.system_health && branchDay.system_health.readiness !== "GREEN" ? (
        <div
          className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 ${
            branchDay.system_health.readiness === "RED"
              ? "border-status-critical/35 bg-status-critical/8"
              : "border-status-warning/35 bg-status-warning/8"
          }`}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              branchDay.system_health.readiness === "RED"
                ? "bg-status-critical"
                : "bg-status-warning animate-pulse"
            }`}
          />
          <p
            className={`text-sm font-medium ${
              branchDay.system_health.readiness === "RED"
                ? "text-status-critical"
                : "text-status-warning"
            }`}
          >
            {branchDay.system_health.note}
          </p>
        </div>
      ) : null}

      {/* ── TIER 1: NEEDS ACTION ── */}
      {criticalRows.length > 0 ? (
        <div className="mb-7">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-status-critical animate-pulse" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-status-critical">
              {t("today.live.needsAction")} · {criticalRows.length}
            </p>
          </div>
          <div className="space-y-3">
            {criticalRows.map(
              ({ item, monitor, planned, additional, sold, remaining }) => {
                const totalPrepared = planned + additional;
                const pctRemaining =
                  totalPrepared > 0
                    ? Math.round((remaining / totalPrepared) * 100)
                    : 0;
                const runoutMin =
                  typeof monitor?.risk_engine?.runout_minutes === "number"
                    ? Math.round(monitor.risk_engine.runout_minutes)
                    : null;
                const prepTimeMin = Math.round(
                  monitor?.risk_engine?.prep_time_minutes ?? 0,
                );
                const startBatchNow = Boolean(
                  monitor?.risk_engine?.start_new_batch_now,
                );
                const suggestedAdditional = Math.max(
                  0,
                  Number(
                    monitor?.should_prepare_more_qty ??
                      monitor?.suggested_additional_qty ??
                      0,
                  ),
                );

                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-status-critical/35 bg-surface-2 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-xl font-semibold text-text-primary">
                          {item.product_title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm text-text-muted">
                          <span>
                            {t("today.live.sold", {
                              quantity: formatQuantity(sold, item.unit),
                            })}
                          </span>
                          <span>
                            {t("today.live.prepared", {
                              quantity: formatQuantity(totalPrepared, item.unit),
                            })}
                          </span>
                        </div>
                        <PaceLine
                          paceItem={paceAlertByProductId.get(item.product_id)}
                          tone="critical"
                        />
                      </div>
                      {runoutMin !== null && (
                        <div className="shrink-0 rounded-xl border border-status-critical/40 bg-status-critical/10 px-4 py-2.5 text-center">
                          <p className="font-display text-3xl font-semibold tabular-nums text-status-critical leading-none">
                            {runoutMin}
                          </p>
                          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-status-critical/70">
                            {t("today.live.minLeft")}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">
                          {t("today.live.remaining", {
                            quantity: formatQuantity(remaining, item.unit),
                          })}
                        </span>
                        <span className="font-semibold text-status-critical">
                          {t("today.live.pctLeft", { pct: pctRemaining })}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-4">
                        <div
                          className="h-2 rounded-full bg-status-critical transition-all duration-500"
                          style={{ width: `${pctRemaining}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-status-critical">
                        {startBatchNow && runoutMin !== null
                          ? t("today.live.startBatchNow", {
                              runoutMin,
                              prepTimeMin,
                            })
                          : runoutMin !== null
                            ? t("today.live.cookMoreRunout", { runoutMin })
                            : t("today.live.cookMoreNow")}
                      </p>
                      <div className="flex items-center gap-2">
                        {suggestedAdditional > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              onLogProduction(
                                item.id,
                                Math.max(
                                  1,
                                  isDiscreteUnit(item.unit)
                                    ? Math.round(suggestedAdditional)
                                    : suggestedAdditional,
                                ),
                                t("today.reason.demandSpike"),
                              )
                            }
                            className="inline-flex h-10 items-center rounded-full border border-status-success/50 bg-status-success/15 px-4 text-sm font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98]"
                          >
                            {t("today.live.prepare", {
                              quantity: formatQuantity(
                                Math.max(1, suggestedAdditional),
                                item.unit,
                              ),
                            })}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onLogProduction(
                                item.id,
                                1,
                                t("today.reason.demandSpike"),
                              )
                            }
                            className="inline-flex h-10 items-center rounded-full border border-status-success/50 bg-status-success/15 px-4 text-sm font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98]"
                          >
                            {t("today.live.cookMore")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onQuickSale(item.id, item, 1)}
                          className="inline-flex h-10 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary hover:bg-surface-3"
                        >
                          {t("today.live.plusOneSold")}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </div>
      ) : null}

      {/* ── TIER 2: KEEP AN EYE ON ── */}
      {watchRows.length > 0 ? (
        <div className="mb-7">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-status-warning" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-status-warning">
              {t("today.live.keepEye")} · {watchRows.length}
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4">
            {watchRows.map(
              ({ item, monitor, planned, additional, sold: _sold, remaining }) => {
                const totalPrepared = planned + additional;
                const pctRemaining =
                  totalPrepared > 0
                    ? Math.round((remaining / totalPrepared) * 100)
                    : 0;
                const wasteRisk = monitor?.risk_engine?.waste_risk ?? "LOW";
                const runoutMin =
                  typeof monitor?.risk_engine?.runout_minutes === "number"
                    ? Math.round(monitor.risk_engine.runout_minutes)
                    : null;
                const note =
                  wasteRisk === "HIGH"
                    ? t("today.live.slowSales")
                    : runoutMin !== null && runoutMin < 45
                      ? t("today.live.mayNeedMore", { runoutMin })
                      : t("today.live.runningSteady");

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 border-l-[3px] border-l-status-warning/60 pl-4 pr-4 py-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary leading-tight">
                        {item.product_title}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-24 shrink-0 rounded-full bg-surface-4">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${pctRemaining < 25 ? "bg-status-critical" : "bg-status-warning"}`}
                            style={{ width: `${pctRemaining}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted">
                          {t("today.live.left", {
                            quantity: formatQuantity(remaining, item.unit),
                          })}
                        </span>
                      </div>
                      <PaceLine
                        paceItem={paceAlertByProductId.get(item.product_id)}
                        tone="warning"
                      />
                    </div>

                    <p className="hidden sm:block text-xs text-status-warning max-w-[180px] text-right leading-tight">
                      {note}
                    </p>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onQuickSale(item.id, item, 1)}
                        className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary hover:bg-surface-3 active:scale-[0.97]"
                      >
                        {t("today.live.plusOneSold")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onLogProduction(item.id, 1)}
                        className="inline-flex h-8 items-center rounded-full border border-brand-gold/40 px-3 text-xs font-medium text-brand-gold hover:bg-brand-gold/10 active:scale-[0.97]"
                      >
                        {t("today.live.plusBatch")}
                      </button>
                      {wasteButton(item)}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      ) : null}

      {/* ── TIER 3: ON TRACK (collapsed) ── */}
      {okRows.length > 0 ? (
        <div className="mb-7">
          <button
            type="button"
            onClick={() => setShowOkRows((p) => !p)}
            className="flex w-full items-center justify-between rounded-xl border border-surface-4/60 bg-surface-2 px-5 py-3.5 text-left transition-colors hover:border-surface-4"
          >
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {t("today.live.onTrack")} · {okRows.length} {t("today.live.items")}
              </span>
            </div>
            <span className="text-xs text-text-muted">
              {showOkRows ? t("today.live.hide") : t("today.live.showAll")}
            </span>
          </button>

          {showOkRows && (
            <div className="mt-1 overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
              {okRows.map(({ item, planned, additional, remaining }) => {
                const totalPrepared = planned + additional;
                const pctRemaining =
                  totalPrepared > 0
                    ? Math.round((remaining / totalPrepared) * 100)
                    : 0;
                return (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                    <p className="flex-1 min-w-0 truncate text-sm text-text-secondary">
                      {item.product_title}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-16 shrink-0 rounded-full bg-surface-4">
                        <div
                          className="h-1 rounded-full bg-surface-4/60 transition-all duration-500"
                          style={{ width: `${pctRemaining}%` }}
                        />
                      </div>
                      <span className="w-14 text-right text-xs text-text-muted">
                        {formatQuantity(remaining, item.unit)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onQuickSale(item.id, item, 1)}
                        className="inline-flex h-7 items-center rounded-full border border-surface-4 px-2.5 text-[11px] text-text-muted hover:bg-surface-3 active:scale-[0.97]"
                      >
                        {t("today.live.plusOne")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onLogProduction(item.id, 1)}
                        className="inline-flex h-7 items-center rounded-full border border-surface-4 px-2.5 text-[11px] text-text-muted hover:bg-surface-3 active:scale-[0.97]"
                      >
                        {t("today.live.plusBatch")}
                      </button>
                      {wasteButton(item, true)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ── ALL CLEAR ── */}
      {criticalRows.length === 0 && watchRows.length === 0 && (
        <div className="mb-7 flex items-center gap-3 rounded-xl border border-status-success/30 bg-status-success/5 px-5 py-4">
          <span className="h-2 w-2 shrink-0 rounded-full bg-status-success" />
          <p className="text-sm text-status-success">{t("today.live.allClear")}</p>
        </div>
      )}
    </section>
  );
}
