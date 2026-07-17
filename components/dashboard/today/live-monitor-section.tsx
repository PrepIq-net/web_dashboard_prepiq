"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MoreHoriz } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { formatQuantity, isDiscreteUnit } from "@/lib/format";
import type {
  BranchDayToday,
  BranchPaceSummary,
  IntradayTimeline,
  IntradayTimelineItem,
} from "@/services/production-intelligence/types";
import { LivePaceBanner } from "./live-pace-banner";
import { CsvImportModal } from "./csv-import-modal";
import { ItemImage } from "./item-image";
import { Sparkline } from "./live-timeline-section";
import type { LiveRow } from "./today-helpers";

type PaceItem = BranchPaceSummary["items"][number];

type RowStatus = "action" | "watch" | "ok";

export type LiveMonitorSectionProps = {
  branchDay: BranchDayToday;
  criticalRows: LiveRow[];
  watchRows: LiveRow[];
  okRows: LiveRow[];
  paceSummary: BranchPaceSummary | null;
  paceAlertByProductId: Map<string, PaceItem>;
  /** Per-dish intraday curves — feeds the inline mini graphs. */
  timeline: IntradayTimeline | null | undefined;
  showCsvImportBanner: boolean;
  onDismissCsvBanner: () => void;
  closePending: boolean;
  onCloseDay: () => void;
  onRecordProduction: (item: {
    id: string;
    title: string;
    unit: string;
  }) => void;
  onQuickSale: (
    prepPlanItemId: string,
    item: { product_id: string; unit: string },
    quantitySold: number,
  ) => void;
  onLogWaste: (item: { id: string; title: string; unit: string }) => void;
  branchId: string;
  targetDate: string;
  orgId: string;
  /** View-only mode: the user lacks the live-operations permissions. */
  readOnly?: boolean;
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

/** Advisory sentence for an item that needs attention. Careful wording by
 * design: PrepIQ suggests and quantifies risk — the kitchen decides. What was
 * actually cooked arrives via POS/CSV/connector or the record modal, never
 * from tapping a suggestion. */
function LiveAdvisoryLine({
  unit,
  suggestedAdditional,
  runoutMin,
  prepTimeMin,
  startBatchNow,
  sellThrough,
}: {
  unit: string;
  suggestedAdditional: number;
  runoutMin: number | null;
  prepTimeMin: number;
  startBatchNow: boolean;
  sellThrough: number | undefined;
}) {
  const { t } = useTranslation();
  const windowMin =
    runoutMin !== null
      ? Math.max(5, Math.min(120, Math.round(runoutMin - prepTimeMin)))
      : null;
  const confidence =
    sellThrough !== undefined
      ? Math.round(Math.min(Math.max(sellThrough, 0.5), 0.97) * 100)
      : null;

  let text: string;
  if (suggestedAdditional > 0 && windowMin !== null) {
    text = t("today.advisory.surgeWindow", {
      quantity: formatQuantity(
        Math.max(1, isDiscreteUnit(unit) ? Math.round(suggestedAdditional) : suggestedAdditional),
        unit,
      ),
      window: windowMin,
    });
  } else if (suggestedAdditional > 0) {
    text = t("today.advisory.surge", {
      quantity: formatQuantity(
        Math.max(1, isDiscreteUnit(unit) ? Math.round(suggestedAdditional) : suggestedAdditional),
        unit,
      ),
    });
  } else if (startBatchNow && runoutMin !== null) {
    text = t("today.advisory.runoutSoon", { runoutMin, prepTimeMin });
  } else {
    text = t("today.advisory.watchPace");
  }

  return (
    <div className="mt-3 rounded-lg border border-status-warning/25 bg-status-warning/5 px-3 py-2">
      <p className="text-xs leading-snug text-text-primary">{text}</p>
      {confidence !== null ? (
        <p className="mt-0.5 text-[10px] font-medium text-text-muted">
          {t("today.advisory.confidence", { confidence })}
        </p>
      ) : null}
    </div>
  );
}

const STATUS_STYLES: Record<
  RowStatus,
  { border: string; chip: string; labelKey: string }
> = {
  action: {
    border: "border-status-critical/35",
    chip: "border-status-critical/40 bg-status-critical/10 text-status-critical",
    labelKey: "today.live.needsAction",
  },
  watch: {
    border: "border-status-warning/30",
    chip: "border-status-warning/40 bg-status-warning/10 text-status-warning",
    labelKey: "today.live.keepEye",
  },
  ok: {
    border: "border-surface-4",
    chip: "border-status-success/40 bg-status-success/10 text-status-success",
    labelKey: "today.live.onTrack",
  },
};

/** One compact metric box: identity, sold count, mini graph, drill-down. */
function ServiceItemCard({
  row,
  status,
  timelineItem,
  paceItem,
  onRecordProduction,
  onQuickSale,
  onLogWaste,
  branchId,
  targetDate,
  orgId,
  readOnly,
}: {
  row: LiveRow;
  status: RowStatus;
  timelineItem: IntradayTimelineItem | undefined;
  paceItem: PaceItem | undefined;
  onRecordProduction: LiveMonitorSectionProps["onRecordProduction"];
  onQuickSale: LiveMonitorSectionProps["onQuickSale"];
  onLogWaste: LiveMonitorSectionProps["onLogWaste"];
  branchId: string;
  targetDate: string;
  orgId: string;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const { item, monitor, planned, additional, sold, remaining } = row;
  const styles = STATUS_STYLES[status];
  const totalPrepared = planned + additional;
  // The POS-synced count. The live monitor aggregate is authoritative; the
  // timeline's hourly cumulative backfills it if the monitor lags a refresh.
  const soldDisplay = Math.max(sold, Math.round(timelineItem?.sold_so_far ?? 0));
  const pctRemaining =
    totalPrepared > 0 ? Math.round((remaining / totalPrepared) * 100) : 0;
  const runoutMin =
    typeof monitor?.risk_engine?.runout_minutes === "number"
      ? Math.round(monitor.risk_engine.runout_minutes)
      : null;
  const suggestedAdditional = Math.max(
    0,
    Number(
      monitor?.should_prepare_more_qty ?? monitor?.suggested_additional_qty ?? 0,
    ),
  );

  return (
    <article
      className={`flex flex-col rounded-xl border bg-surface-2 p-4 ${styles.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ItemImage
            src={item.product_image_url}
            title={item.product_title}
            className="h-9 w-9 shrink-0 rounded-lg border border-surface-4"
          />
          <p className="truncate text-sm font-semibold text-text-primary">
            {item.product_title}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${styles.chip}`}
        >
          {t(styles.labelKey)}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.live.soldLabel")}
          </p>
          <p className="mt-0.5 font-display text-2xl font-semibold leading-none text-text-primary">
            {formatQuantity(soldDisplay, item.unit)}
          </p>
          <p className="mt-1 text-[11px] text-text-muted">
            {t("today.live.ofPlanned", {
              quantity: formatQuantity(totalPrepared, item.unit),
            })}
            {" · "}
            {t("today.live.left", {
              quantity: formatQuantity(remaining, item.unit),
            })}
          </p>
        </div>
        {timelineItem ? (
          <Sparkline item={timelineItem} />
        ) : (
          <div className="h-2 w-24 shrink-0 self-center rounded-full bg-surface-4">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                status === "action"
                  ? "bg-status-critical"
                  : status === "watch"
                    ? "bg-status-warning"
                    : "bg-status-success/70"
              }`}
              style={{ width: `${pctRemaining}%` }}
            />
          </div>
        )}
      </div>

      {runoutMin !== null && status === "action" ? (
        <p className="mt-2 text-xs font-semibold text-status-critical">
          {t("today.live.runoutIn", { runoutMin })}
        </p>
      ) : null}
      <PaceLine
        paceItem={paceItem}
        tone={status === "action" ? "critical" : "warning"}
      />

      {status === "action" ? (
        <LiveAdvisoryLine
          unit={item.unit}
          suggestedAdditional={suggestedAdditional}
          runoutMin={runoutMin}
          prepTimeMin={Math.round(monitor?.risk_engine?.prep_time_minutes ?? 0)}
          startBatchNow={Boolean(monitor?.risk_engine?.start_new_batch_now)}
          sellThrough={monitor?.sell_through_probability}
        />
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <Link
          href={`/workspace/today/item/${item.id}?branch=${branchId}&date=${targetDate}&title=${encodeURIComponent(item.product_title)}&product_id=${item.product_id}&org=${orgId}`}
          className="inline-flex h-8 items-center rounded-full border border-brand-gold/40 px-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10"
        >
          {t("today.live.details")}
        </Link>
        {readOnly ? null : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onQuickSale(item.id, item, 1)}
              className="inline-flex h-8 items-center rounded-full border border-surface-4 px-2.5 text-[11px] font-medium text-text-secondary hover:bg-surface-3 active:scale-[0.97]"
            >
              {t("today.live.plusOneSold")}
            </button>
            {/* "Record what you cooked" is deliberately demoted: production
                normally syncs from the POS, so manual entry lives behind a
                low-profile menu instead of posing as the page CTA. */}
            <details className="group relative">
              <summary
                className="inline-flex h-8 cursor-pointer list-none items-center rounded-full border border-surface-4 px-2 text-text-muted hover:bg-surface-3 [&::-webkit-details-marker]:hidden"
                aria-label={t("today.live.moreActions")}
              >
                <MoreHoriz className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-surface-4 bg-surface-2 py-1 shadow-lg">
                <button
                  type="button"
                  onClick={(event) => {
                    (event.currentTarget.closest("details") as HTMLDetailsElement)?.removeAttribute("open");
                    onRecordProduction({
                      id: item.id,
                      title: item.product_title,
                      unit: item.unit,
                    });
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-surface-3"
                >
                  {t("today.live.recordCooked")}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    (event.currentTarget.closest("details") as HTMLDetailsElement)?.removeAttribute("open");
                    onLogWaste({
                      id: item.id,
                      title: item.product_title,
                      unit: item.unit,
                    });
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-surface-3"
                >
                  {t("today.live.logWaste")}
                </button>
              </div>
            </details>
          </div>
        )}
      </div>
    </article>
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
    timeline,
    showCsvImportBanner,
    onDismissCsvBanner,
    closePending,
    onCloseDay,
    onRecordProduction,
    onQuickSale,
    onLogWaste,
    branchId,
    targetDate,
    orgId,
    readOnly = false,
  } = props;

  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const timelineByProductId = useMemo(() => {
    const map = new Map<string, IntradayTimelineItem>();
    for (const timelineItem of timeline?.items ?? []) {
      map.set(timelineItem.item_id, timelineItem);
    }
    return map;
  }, [timeline]);

  // Needs-action bubbles to the top-left, then watch, then on-track.
  const orderedRows: Array<{ row: LiveRow; status: RowStatus }> = useMemo(
    () => [
      ...criticalRows.map((row) => ({ row, status: "action" as const })),
      ...watchRows.map((row) => ({ row, status: "watch" as const })),
      ...okRows.map((row) => ({ row, status: "ok" as const })),
    ],
    [criticalRows, watchRows, okRows],
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
        {readOnly ? null : (
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
        )}
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

      {/* System health banner — POS / data gap alert. Untouched: this is the
          "last sync" surface handled in a separate PR. */}
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

      {/* Unified compact grid — how the floor is performing in one glance. */}
      {orderedRows.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orderedRows.map(({ row, status }) => (
            <ServiceItemCard
              key={row.item.id}
              row={row}
              status={status}
              timelineItem={timelineByProductId.get(row.item.product_id)}
              paceItem={paceAlertByProductId.get(row.item.product_id)}
              onRecordProduction={onRecordProduction}
              onQuickSale={onQuickSale}
              onLogWaste={onLogWaste}
              branchId={branchId}
              targetDate={targetDate}
              orgId={orgId}
              readOnly={readOnly}
            />
          ))}
        </div>
      ) : null}

      {/* ── ALL CLEAR ── */}
      {criticalRows.length === 0 && watchRows.length === 0 && (
        <div className="mt-5 mb-7 flex items-center gap-3 rounded-xl border border-status-success/30 bg-status-success/5 px-5 py-4">
          <span className="h-2 w-2 shrink-0 rounded-full bg-status-success" />
          <p className="text-sm text-status-success">{t("today.live.allClear")}</p>
        </div>
      )}
    </section>
  );
}
