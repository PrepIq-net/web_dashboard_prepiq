"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Calendar, ArrowLeft } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { ScenarioBarChart } from "@/components/dashboard/scenario-bar-chart";
import {
  useAdvancedForecast,
  useBranchDayToday,
  useChefSkillScore,
  useDataQualityReport,
  useForecastMetrics,
  useProductionIntelligenceAccessScope,
  useRealTimeVelocity,
} from "@/services/production-intelligence/hooks";
import { useCurrentUserProfile } from "@/services";

type VelocityEntry = {
  captured_at: string;
  comparison?: {
    status?: string;
    velocity_ratio?: number;
    deviation_pct?: number;
    recommendation?: string;
  };
  sales_velocity?: {
    velocity_units_per_hour?: number;
    time_span_minutes?: number;
  } | null;
};

const EMPTY_LIST: never[] = [];
const VELOCITY_POLL_INTERVAL_MS = 3 * 60 * 1000;
const VELOCITY_POLL_INTERVAL_MINUTES = Math.round(
  VELOCITY_POLL_INTERVAL_MS / 60000,
);

function percent(value: number) {
  const normalized = Math.max(0, Math.min(1, value));
  return `${(normalized * 100).toFixed(0)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatQuantity(value: number, unit: string) {
  const discrete = ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes(
    (unit || "").toUpperCase(),
  );
  return `${discrete ? Math.round(value) : value.toFixed(2)} ${unit}`;
}

function ForecastIntelligenceContent() {
  const router = useRouter();
  const params = useParams<{ itemId: string }>();
  const searchParams = useSearchParams();
  const { data: user } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();

  const itemId = String(params?.itemId ?? "");
  const branchId = searchParams.get("branch_id") ?? "";
  const initialDate =
    searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const [targetDate, setTargetDate] = useState(initialDate);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [velocityHistory, setVelocityHistory] = useState<VelocityEntry[]>([]);

  const allowedBranchIds = useMemo(
    () =>
      new Set((accessScope?.accessible_branches ?? []).map((row) => row.id)),
    [accessScope?.accessible_branches],
  );

  useEffect(() => {
    if (!branchId || !accessScope) return;
    if (!allowedBranchIds.has(branchId)) {
      router.replace("/workspace/overview");
    }
  }, [accessScope, allowedBranchIds, branchId, router]);

  const branchDayQuery = useBranchDayToday(
    { branch_id: branchId, date: targetDate },
    Boolean(branchId),
  );
  const branchDay = branchDayQuery.data;

  const item = useMemo(() => {
    return (
      branchDay?.prep_plan_items?.find((row) => row.product_id === itemId) ??
      null
    );
  }, [branchDay?.prep_plan_items, itemId]);

  const advancedQuery = useAdvancedForecast(
    {
      branch_id: branchId,
      item_id: itemId,
      target_date: targetDate,
    },
    Boolean(branchId && itemId),
  );
  const metricsQuery = useForecastMetrics(
    {
      branch_id: branchId,
      item_id: itemId,
      lookback_days: 60,
    },
    Boolean(branchId && itemId),
  );
  const dataQualityQuery = useDataQualityReport(
    { branch_id: branchId, days_window: 30 },
    Boolean(branchId),
  );
  const chefSkillQuery = useChefSkillScore(
    {
      user_id: user?.id ?? "",
      branch_id: branchId,
      days_window: 30,
    },
    Boolean(user?.id && branchId),
  );
  const velocityMutation = useRealTimeVelocity();

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };
    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const pollVelocity = useCallback(() => {
    if (!branchId || !itemId || velocityMutation.isPending) return;
    velocityMutation.mutate(
      { branch_id: branchId, item_id: itemId, window_minutes: 60 },
      {
        onSuccess: (data) => {
          setVelocityHistory((prev) => {
            const entry: VelocityEntry = {
              captured_at: new Date().toISOString(),
              comparison: data?.comparison,
              sales_velocity: data?.sales_velocity ?? null,
            };
            return [entry, ...prev].slice(0, 8);
          });
        },
      },
    );
  }, [branchId, itemId, velocityMutation]);

  useEffect(() => {
    if (!pollingEnabled || !isPageVisible) return;
    pollVelocity();
    const interval = setInterval(pollVelocity, VELOCITY_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pollingEnabled, pollVelocity, isPageVisible]);

  const branchName =
    branchDay?.branch_name ??
    accessScope?.accessible_branches?.find((row) => row.id === branchId)
      ?.name ??
    "Branch";

  const confidenceLabel = advancedQuery.data?.confidence_label ?? "—";
  const unit = item?.unit ?? "PCS";

  if (!branchId || !itemId) {
    return (
      <WorkspaceShell
        eyebrow="Forecast Intelligence"
        title="Missing Context"
        description="Select a branch and item to view the forecast intelligence drill-down."
        insight="This page expects a branch_id and item_id."
      >
        <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5 text-sm text-text-secondary">
          Provide a valid `branch_id` and `item_id` in the URL.
        </section>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow="Forecast Intelligence"
      title={item?.product_title ?? "Item Forecast Drill-Down"}
      description="Deep visibility into ensemble forecast logic, scenario impacts, and live demand velocity."
      insight="Use this view to validate model confidence, data quality, and chef alignment before acting."
    >
      <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/today?branch_id=${branchId}&date=${targetDate}`}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-surface-4 px-3 text-xs font-semibold text-text-secondary hover:border-brand-gold hover:text-brand-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Today
          </Link>
          <span className="text-xs text-text-muted">{branchName}</span>
        </div>
        <div className="relative w-full max-w-[220px]">
          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="h-10 w-full rounded-full border border-surface-4 bg-surface-2 pl-10 pr-3 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/30"
          />
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-[2fr,1fr]">
        <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            Ensemble Summary
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Ensemble Forecast
              </p>
              <p className="mt-1 text-lg font-semibold text-text-primary">
                {advancedQuery.data?.ensemble_forecast != null
                  ? formatQuantity(advancedQuery.data.ensemble_forecast, unit)
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Loss-Optimized
              </p>
              <p className="mt-1 text-lg font-semibold text-text-primary">
                {advancedQuery.data?.loss_optimized_qty != null
                  ? formatQuantity(advancedQuery.data.loss_optimized_qty, unit)
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Confidence
              </p>
              <p className="mt-1 text-lg font-semibold text-text-primary">
                {advancedQuery.data?.confidence != null
                  ? percent(advancedQuery.data.confidence)
                  : "—"}
              </p>
              <p className="text-xs text-text-secondary">{confidenceLabel}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3 text-sm text-text-secondary">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Model Agreement
              </p>
              <p className="mt-1 font-semibold text-text-primary">
                {advancedQuery.data?.model_agreement != null
                  ? percent(advancedQuery.data.model_agreement)
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Higher agreement means lower forecast variance across models.
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3 text-sm text-text-secondary">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Chef Signal
              </p>
              <p className="mt-1 font-semibold text-text-primary">
                {advancedQuery.data?.chef_recommendation ?? "—"}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Chef weight{" "}
                {advancedQuery.data?.chef_weight != null
                  ? percent(advancedQuery.data.chef_weight)
                  : "—"}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <ScenarioBarChart
              baseValue={advancedQuery.data?.ensemble_forecast ?? null}
              scenarios={advancedQuery.data?.scenarios ?? EMPTY_LIST}
              unitLabel={unit}
            />
          </div>
        </article>

        <div className="space-y-4">
          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Performance Metrics
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                  Accuracy
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {metricsQuery.data?.forecast_accuracy != null
                    ? `${metricsQuery.data.forecast_accuracy.toFixed(1)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                  MAPE
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {metricsQuery.data?.mape != null
                    ? `${metricsQuery.data.mape.toFixed(1)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                  Stockout
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {metricsQuery.data?.stockout_rate != null
                    ? `${metricsQuery.data.stockout_rate.toFixed(1)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                  Waste
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {metricsQuery.data?.waste_rate != null
                    ? `${metricsQuery.data.waste_rate.toFixed(1)}%`
                    : "—"}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Data Quality Gate
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">
              {dataQualityQuery.data?.overall_quality_score != null
                ? `${dataQualityQuery.data.overall_quality_score.toFixed(0)}%`
                : "—"}
            </p>
            <p className="text-sm text-text-secondary">
              {dataQualityQuery.data?.quality_label ?? "No quality score yet."}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {dataQualityQuery.data?.recommendation ??
                "Quality checks will appear once data is available."}
            </p>
          </article>

          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Chef Skill Signal
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">
              {chefSkillQuery.data?.overall_skill_score != null
                ? percent(chefSkillQuery.data.overall_skill_score)
                : "—"}
            </p>
            <p className="text-sm text-text-secondary">
              {chefSkillQuery.data?.recommendation ?? "No chef signal yet."}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Real-Time Velocity Feed
            </p>
            <p className="text-sm text-text-secondary">
              Live demand velocity vs forecast, refreshed every{" "}
              {VELOCITY_POLL_INTERVAL_MINUTES} minutes while this tab is
              visible.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPollingEnabled((prev) => !prev)}
              className="inline-flex h-9 items-center rounded-full border border-surface-4 px-3 text-xs font-semibold text-text-primary transition-all duration-200 hover:bg-surface-3"
            >
              {pollingEnabled ? "Pause feed" : "Resume feed"}
            </button>
            <button
              type="button"
              onClick={pollVelocity}
              className="inline-flex h-9 items-center rounded-full border border-brand-gold/40 px-3 text-xs font-semibold text-brand-gold transition-all duration-200 hover:bg-brand-gold/10"
              disabled={velocityMutation.isPending}
            >
              {velocityMutation.isPending ? "Updating..." : "Refresh now"}
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {velocityHistory.length ? (
            velocityHistory.map((entry) => (
              <article
                key={entry.captured_at}
                className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3 text-xs text-text-secondary"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-text-primary">
                    {entry.comparison?.status ?? "PENDING"}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {new Date(entry.captured_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="mt-2">
                  Velocity ratio{" "}
                  <span className="font-semibold text-text-primary">
                    {entry.comparison?.velocity_ratio != null
                      ? entry.comparison.velocity_ratio.toFixed(2)
                      : "—"}
                  </span>
                  {" · "}Last window{" "}
                  {entry.sales_velocity?.time_span_minutes != null
                    ? `${entry.sales_velocity.time_span_minutes.toFixed(0)}m`
                    : "—"}
                </p>
                <p className="mt-2 text-[11px] text-text-muted">
                  {entry.comparison?.recommendation ??
                    "Monitoring velocity feed."}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-6 text-xs text-text-muted">
              No velocity snapshots yet. The feed updates every{" "}
              {VELOCITY_POLL_INTERVAL_MINUTES} minutes.
            </div>
          )}
        </div>
      </section>
    </WorkspaceShell>
  );
}

export default function ForecastIntelligencePage() {
  return (
    <Suspense fallback={null}>
      <ForecastIntelligenceContent />
    </Suspense>
  );
}
