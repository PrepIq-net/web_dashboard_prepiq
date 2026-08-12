"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GraphDown, GraphUp, MoreHoriz, NavArrowDown, WarningTriangle } from "iconoir-react";
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
import { ServiceItemChart } from "./service-item-chart";
import { runoutPhrase, type LiveRow } from "./today-helpers";

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
  const isSurge = pos.status === "SURGE";
  const Icon = isSurge ? GraphUp : GraphDown;
  const iconTone = isSurge
    ? tone === "critical" && pos.alert_level === "CRITICAL"
      ? "text-status-critical"
      : "text-status-warning"
    : "text-status-info";
  return (
    <p
      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary"
      title={paceItem?.alert_reason}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconTone}`} strokeWidth={1.5} />
      {isSurge
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
    text = t("today.advisory.runoutSoon", {
      phrase: runoutPhrase(t, runoutMin),
      prepTimeMin,
    });
  } else {
    text = t("today.advisory.watchPace");
  }

  return (
    <div className="mt-3 rounded-r-lg border-l-4 border-status-warning bg-surface-3/50 px-3 py-2.5">
      <p className="flex items-start gap-2 text-xs leading-snug text-text-primary">
        <WarningTriangle
          className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-status-warning"
          strokeWidth={1.5}
        />
        <span>
          <span className="font-semibold">{t("today.live.advisoryPrefix")}:</span>{" "}
          {text}
        </span>
      </p>
      {confidence !== null ? (
        <p className="mt-1 pl-5.5 text-[10px] font-medium text-text-muted">
          {t("today.advisory.confidence", { confidence })}
        </p>
      ) : null}
    </div>
  );
}

// "Needs attention" is a warning, not an emergency: the kitchen is being
// asked to consider another batch, not told something has already failed.
// Critical red stays reserved for the runout countdown inside the card, so
// the grid doesn't read as a wall of alarms during a normal busy service.
const STATUS_STYLES: Record<
  RowStatus,
  { accent: string; chip: string; labelKey: string }
> = {
  action: {
    accent: "border-t-status-warning",
    chip: "border-status-warning/40 bg-status-warning/10 text-status-warning",
    labelKey: "today.live.needsAction",
  },
  watch: {
    accent: "border-t-status-warning/40",
    chip: "border-surface-4 bg-surface-3/60 text-text-secondary",
    labelKey: "today.live.keepEye",
  },
  ok: {
    accent: "border-t-surface-4",
    chip: "border-status-success/35 bg-status-success/8 text-status-success",
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
  onLogWaste: LiveMonitorSectionProps["onLogWaste"];
  branchId: string;
  targetDate: string;
  orgId: string;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const [chartOpen, setChartOpen] = useState(false);
  // Mounted once on first open, then kept mounted so close/reopen animate in
  // pure CSS — remounting Recharts on every toggle is what made the collapse
  // look like a jump-cut instead of a close.
  const [chartMounted, setChartMounted] = useState(false);
  const { item, monitor, planned, additional, sold, remaining } = row;
  const styles = STATUS_STYLES[status];
  const totalPrepared = planned + additional;
  // The POS-synced count. The live monitor aggregate is authoritative; the
  // timeline's hourly cumulative backfills it if the monitor lags a refresh.
  const soldDisplay = Math.max(sold, Math.round(timelineItem?.sold_so_far ?? 0));
  // Sold progress, not remaining stock: this sits right beside the "Sold so
  // far" count, so it needs to fill up as the day goes rather than track a
  // separate "stock remaining" fraction that starts full and empties —
  // paired with a different number, that read as broken/empty at a glance.
  const pctSold =
    totalPrepared > 0
      ? Math.round((Math.min(soldDisplay, totalPrepared) / totalPrepared) * 100)
      : 0;
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
    // The status signal stays a thin top-edge accent rather than a left bar
    // or full-color border — quieter at a glance, still scannable down a
    // dozen-plus cards. The photo now carries first-glance recognition
    // (identifying a dish by sight beats reading its name mid-rush), so it
    // leads the card full-bleed; everything operational stays below it in
    // the same dense, console-like block this grid always had.
    <article
      className={`flex flex-col overflow-hidden rounded-xl border border-surface-4 border-t-2 bg-surface-2 ${styles.accent}`}
    >
      <div className="h-32 w-full shrink-0 bg-surface-3">
        <ItemImage item={item} className="h-full w-full" iconClassName="h-10 w-10" />
      </div>

      <div className="flex flex-1 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/workspace/today/item/${item.id}?branch=${branchId}&date=${targetDate}&title=${encodeURIComponent(item.product_title)}&product_id=${item.product_id}&org=${orgId}`}
          className="min-w-0 truncate text-sm font-semibold text-text-primary transition-colors hover:text-brand-gold hover:underline"
        >
          {item.product_title}
        </Link>
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
          {/* "planned", not "prepared": this figure is the morning plan plus
              any logged batches, not proof the kitchen has cooked it all. */}
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
        {/* A single supporting glance indicator — the detailed curve lives
            one tap away in the toggle below, so this stays a plain neutral
            bar rather than a second, status-colored graph. Fills as sold
            climbs toward prepared, mirroring the count to its left. */}
        <div
          className="h-2 w-24 shrink-0 self-center rounded-full bg-surface-4"
          role="progressbar"
          aria-valuenow={pctSold}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("today.live.soldLabel")}
        >
          <div
            className="h-2 rounded-full bg-text-secondary/40 transition-all duration-500"
            style={{ width: `${pctSold}%` }}
          />
        </div>
      </div>

      {runoutMin !== null && status === "action" ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <WarningTriangle className="h-3.5 w-3.5 shrink-0 text-status-critical" strokeWidth={1.5} />
          {t("today.live.runoutIn", { phrase: runoutPhrase(t, runoutMin) })}
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

      {/* Progressive disclosure: the grid stays scannable, and the full
          curve is one tap away for whoever wants it. */}
      <div className="mt-3 border-t border-surface-4/50 pt-2">
        <button
          type="button"
          onClick={() => {
            setChartOpen((open) => !open);
            setChartMounted(true);
          }}
          aria-expanded={chartOpen}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-[11px] font-semibold text-text-secondary transition-colors hover:text-brand-gold"
        >
          <span>
            {chartOpen ? t("today.live.hideChart") : t("today.live.showChart")}
          </span>
          <NavArrowDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              chartOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            chartOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            {/* Mounted once on first open — a dozen live charts per grid is
                real work, and recharts measures on mount — then left mounted
                so it can fade/slide out instead of vanishing on close. */}
            {chartMounted ? (
              <div
                className={`pt-2 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  chartOpen ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0"
                }`}
              >
                <ServiceItemChart
                  timelineItem={timelineItem}
                  unit={item.unit}
                  plannedQty={planned || null}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* The item title link above is the way into details now — this row is
          just the remaining quick actions, right-aligned on their own. */}
      <div className="mt-auto flex items-center justify-end gap-2 pt-3">
        {readOnly ? null : (
          <div className="flex items-center gap-1.5">
            {/* Quick-tap "+1 Sold" lives on the item detail page now, not
                here: this grid is a glance surface, and a per-card sale
                counter competed with "Details" for the primary action.
                "Record what you cooked" is deliberately demoted too —
                production normally syncs from the POS, so manual entry
                lives behind a low-profile menu instead of posing as the
                page CTA. */}
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

  // Without operating hours the backend cannot say how much service is left,
  // so it withholds every prepare-more / hold call rather than guessing. Say
  // so once at the top instead of leaving the kitchen wondering why the
  // guidance went quiet.
  const operatingHoursMissing = useMemo(
    () =>
      orderedRows.some(
        ({ row }) => row.monitor?.risk_engine?.operating_hours_known === false,
      ),
    [orderedRows],
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

      {operatingHoursMissing ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-r-xl border-l-4 border-status-warning bg-surface-2 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              {t("today.live.hoursMissingTitle")}
            </p>
            <p className="mt-1 text-sm text-text-primary">
              {t("today.live.hoursMissingDescription")}
            </p>
          </div>
          <Link
            href={`/workspace/branches/${branchId}/edit`}
            className="shrink-0 text-xs font-semibold text-brand-gold hover:text-brand-gold-hover"
          >
            {t("today.live.hoursMissingAction")}
          </Link>
        </div>
      ) : null}

      {showCsvImportBanner ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-r-xl border-l-4 border-status-success bg-surface-2 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              {t("today.live.csvImportComplete")}
            </p>
            <p className="mt-1 text-sm text-text-primary">
              {t("today.live.csvImportDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissCsvBanner}
            className="text-xs font-semibold text-text-secondary hover:text-text-primary"
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
          className={`mb-5 flex items-center gap-3 rounded-r-xl border-l-4 bg-surface-2 px-4 py-3 ${
            branchDay.system_health.readiness === "RED"
              ? "border-status-critical"
              : "border-status-warning"
          }`}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              branchDay.system_health.readiness === "RED"
                ? "bg-status-critical"
                : "bg-status-warning animate-pulse"
            }`}
          />
          <p className="text-sm font-medium text-text-primary">
            {branchDay.system_health.note}
          </p>
        </div>
      ) : null}

      {/* Unified compact grid — how the floor is performing in one glance. */}
      {orderedRows.length > 0 ? (
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orderedRows.map(({ row, status }) => (
            <ServiceItemCard
              key={row.item.id}
              row={row}
              status={status}
              timelineItem={timelineByProductId.get(row.item.product_id)}
              paceItem={paceAlertByProductId.get(row.item.product_id)}
              onRecordProduction={onRecordProduction}
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
        <div className="mt-5 mb-7 flex items-center gap-3 rounded-r-xl border-l-4 border-status-success bg-surface-2 px-5 py-4">
          <span className="h-2 w-2 shrink-0 rounded-full bg-status-success" />
          <p className="text-sm text-text-primary">{t("today.live.allClear")}</p>
        </div>
      )}
    </section>
  );
}
