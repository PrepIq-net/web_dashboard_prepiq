"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  Clock,
  CreditCard,
  EditPencil,
  Globe,
  Group,
  MapPin,
  ShieldCheck,
  Shop,
  SoccerBall,
  Star,
} from "iconoir-react";

import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { useTranslation } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import { useCurrentUserProfile } from "@/services";
import {
  useBranch,
  useBranchAssignments,
  useSetPrimaryBranch,
} from "@/services/branches/hooks";
import { useSubscriptions } from "@/services/payment/hooks";
import {
  useDataQualityReport,
  useForecastMetrics,
} from "@/services/production-intelligence/hooks";
import type { OperatingHours } from "@/services/branches/types";

const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;
type DayKey = (typeof DAY_ORDER)[number];

const DAY_LABEL_KEY: Record<DayKey, string> = {
  MONDAY: "common.dayMon",
  TUESDAY: "common.dayTue",
  WEDNESDAY: "common.dayWed",
  THURSDAY: "common.dayThu",
  FRIDAY: "common.dayFri",
  SATURDAY: "common.daySat",
  SUNDAY: "common.daySun",
};

const EMPTY_LIST: never[] = [];

/** "08:00:00" → "08:00". The API returns seconds the user never needs. */
function trimTime(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

/** A labelled read-only value. Spacing-led — no card chrome per docs/DESIGN.md. */
function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        {label}
      </p>
      <div className="mt-1 text-sm text-text-primary">{value}</div>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

function Section({
  icon,
  title,
  eyebrow,
  actions,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-surface-4/60 pt-8">
      <SectionHeader
        eyebrow={eyebrow}
        title={
          <span className="flex items-center gap-2">
            {/* The eyebrow already carries the gold accent — a gold icon beside
                it would spend the scarce colour twice in one heading. */}
            <span className="text-text-muted">{icon}</span>
            {title}
          </span>
        }
        actions={actions}
      />
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function BranchDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ branchId: string }>();
  const branchId = String(params?.branchId ?? "");

  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const canManage = permissions.has(PERMISSIONS.MANAGE_BRANCHES);
  const canSeeBilling = permissions.has(PERMISSIONS.MANAGE_BILLING);
  const canSeeIntelligence =
    permissions.has(PERMISSIONS.VIEW_FORECASTS) ||
    permissions.has(PERMISSIONS.VIEW_ANALYTICS);
  const canSeeInventoryRules = permissions.has(PERMISSIONS.VIEW_INVENTORY);
  const canSeeTeam =
    permissions.has(PERMISSIONS.MANAGE_TEAM) ||
    permissions.has(PERMISSIONS.VIEW_ALL_BRANCHES);

  const orgId = user?.organization_id ?? "";
  const branchQuery = useBranch(orgId, branchId);
  const branch = branchQuery.data;

  const setPrimary = useSetPrimaryBranch(orgId);

  const subscriptionsQuery = useSubscriptions(
    branchId ? { branch_id: branchId } : undefined,
    canSeeBilling && Boolean(branchId),
  );
  const subscription = useMemo(() => {
    const rows = subscriptionsQuery.data ?? EMPTY_LIST;
    return rows.find((row) => row.is_currently_active) ?? rows[0] ?? null;
  }, [subscriptionsQuery.data]);

  const forecastQuery = useForecastMetrics(
    branchId ? { branch_id: branchId, lookback_days: 30 } : undefined,
    canSeeIntelligence && Boolean(branchId),
  );
  const dataQualityQuery = useDataQualityReport(
    branchId ? { branch_id: branchId } : undefined,
    canSeeIntelligence && Boolean(branchId),
  );

  const assignmentsQuery = useBranchAssignments(canSeeTeam ? orgId : "");
  const branchTeam = useMemo(
    () =>
      (assignmentsQuery.data ?? EMPTY_LIST).filter(
        (row) => row.branch === branchId && row.is_active,
      ),
    [assignmentsQuery.data, branchId],
  );

  const hoursByDay = useMemo(() => {
    const map = new Map<DayKey, OperatingHours>();
    for (const entry of branch?.operating_hours ?? []) {
      map.set(entry.day_of_week as DayKey, entry);
    }
    return map;
  }, [branch?.operating_hours]);

  const currency = branch?.currency ?? "USD";

  if (userLoading || branchQuery.isLoading) {
    return (
      <WorkspaceShell
        eyebrow={t("workspace.branches.eyebrow")}
        title={t("workspace.branches.detail.loadingTitle")}
        description={t("workspace.branches.detail.loadingDescription")}
        insight=""
      >
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-24 animate-pulse rounded-xl border border-surface-4 bg-surface-2"
            />
          ))}
        </div>
      </WorkspaceShell>
    );
  }

  if (branchQuery.isError || !branch) {
    return (
      <WorkspaceShell
        eyebrow={t("workspace.branches.eyebrow")}
        title={t("workspace.branches.detail.notFoundTitle")}
        description={t("workspace.branches.detail.notFoundDescription")}
        insight=""
      >
        <Link
          href="/workspace/branches"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-surface-4 px-6 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("workspace.branches.detail.backToBranches")}
        </Link>
      </WorkspaceShell>
    );
  }

  const serviceWindow =
    trimTime(branch.service_start_time) && trimTime(branch.service_end_time)
      ? `${trimTime(branch.service_start_time)} – ${trimTime(branch.service_end_time)}`
      : null;

  const coordinates =
    branch.latitude != null && branch.longitude != null
      ? `${branch.latitude.toFixed(5)}, ${branch.longitude.toFixed(5)}`
      : null;

  const trialDaysLeft = subscription?.is_trial
    ? daysUntil(subscription.trial_ends_at)
    : null;

  const sportsTeams = branch.sports_profile?.teams ?? [];
  const venues = branch.nearby_event_venues ?? [];
  const locationContextEntries = Object.entries(branch.location_context ?? {})
    .filter(([, value]) => typeof value === "number" && value > 0)
    .slice(0, 8);

  const forecastAccuracy = forecastQuery.data?.forecast_accuracy;
  const mape = forecastQuery.data?.mape;
  const qualityScore = dataQualityQuery.data?.overall_quality_score;

  return (
    <WorkspaceShell
      eyebrow={branch.code || t("workspace.branches.eyebrow")}
      title={branch.name}
      description={branch.address}
      insight={t("workspace.branches.detail.insight")}
    >
      {/* ── Back + actions ── */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/workspace/branches"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("workspace.branches.detail.backToBranches")}
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {branch.is_primary ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 text-xs font-semibold text-brand-gold">
              <Star className="h-3.5 w-3.5" />
              {t("workspace.branches.primary")}
            </span>
          ) : canManage ? (
            <button
              type="button"
              onClick={() => setPrimary.mutate(branchId)}
              disabled={setPrimary.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              <Star className="h-3.5 w-3.5" />
              {t("workspace.branches.detail.makePrimary")}
            </button>
          ) : null}
          <Link
            href={`/workspace/today?branch_id=${branch.id}`}
            className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            {t("workspace.branches.viewToday")}
          </Link>
          {canManage ? (
            <Link
              href={`/workspace/branches/${branch.id}/edit`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-gold px-6 text-xs font-semibold text-background transition-colors hover:bg-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              <EditPencil className="h-3.5 w-3.5" />
              {t("workspace.branches.detail.edit")}
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── At-a-glance facts ── */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 pb-8 md:grid-cols-4">
        <Fact
          label={t("workspace.branches.detail.timezone")}
          value={branch.timezone ?? "UTC"}
        />
        <Fact
          label={t("workspace.branches.detail.currency")}
          value={currency}
          hint={t("workspace.branches.detail.currencyHint")}
        />
        <Fact
          label={t("workspace.branches.detail.serviceWindow")}
          value={serviceWindow ?? t("workspace.branches.detail.notSet")}
        />
        <Fact
          label={t("workspace.branches.detail.branchManager")}
          value={
            branch.branch_manager_name ?? t("workspace.branches.detail.unassigned")
          }
        />
      </div>

      {/* ── Location & contact ── */}
      <Section
        icon={<MapPin className="h-4 w-4" />}
        eyebrow={t("workspace.branches.detail.section.locationEyebrow")}
        title={t("workspace.branches.detail.section.location")}
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-3">
          <Fact
            label={t("workspace.branches.detail.address")}
            value={branch.address || "—"}
          />
          <Fact
            label={t("workspace.branches.detail.coordinates")}
            value={
              coordinates ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${branch.latitude}&mlon=${branch.longitude}#map=16/${branch.latitude}/${branch.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-gold underline underline-offset-4 hover:text-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                >
                  {coordinates}
                </a>
              ) : (
                t("workspace.branches.detail.notSet")
              )
            }
            hint={
              coordinates
                ? undefined
                : t("workspace.branches.detail.coordinatesHint")
            }
          />
          <Fact
            label={t("workspace.branches.detail.contact")}
            value={
              <span className="space-y-0.5">
                <span className="block">{branch.phone || "—"}</span>
                <span className="block text-text-secondary">
                  {branch.email || "—"}
                </span>
              </span>
            }
          />
        </div>
      </Section>

      {/* ── Operating hours & kitchen ── */}
      <Section
        icon={<Clock className="h-4 w-4" />}
        eyebrow={t("workspace.branches.detail.section.hoursEyebrow")}
        title={t("workspace.branches.detail.section.hours")}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 scrollbar-thin">
            <table className="w-full min-w-[420px]">
              <thead className="border-b border-surface-4/80 bg-surface-3/40">
                <tr>
                  {[
                    t("workspace.branches.new.day"),
                    t("workspace.branches.new.opens"),
                    t("workspace.branches.new.closes"),
                    t("workspace.branches.new.status"),
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-4/50">
                {DAY_ORDER.map((day) => {
                  const entry = hoursByDay.get(day);
                  const isOpen = Boolean(entry) && !entry?.is_closed;
                  return (
                    <tr key={day} className="transition-colors hover:bg-surface-3/20">
                      <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                        {t(DAY_LABEL_KEY[day])}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {isOpen ? (trimTime(entry?.opens_at) ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {isOpen ? (trimTime(entry?.closes_at) ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            isOpen
                              ? "border-status-success/30 bg-status-success/10 text-text-primary"
                              : "border-surface-4 bg-surface-3/60 text-text-muted"
                          }`}
                        >
                          {isOpen
                            ? t("workspace.branches.new.open")
                            : t("workspace.branches.new.closed")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            <Fact
              label={t("workspace.branches.detail.capacity")}
              value={
                branch.capacity != null
                  ? String(branch.capacity)
                  : t("workspace.branches.detail.notSet")
              }
              hint={t("workspace.branches.detail.capacityHint")}
            />
            <Fact
              label={t("workspace.branches.detail.avgPrepTime")}
              value={t("workspace.branches.detail.minutes", {
                count: branch.average_prep_time_minutes ?? 15,
              })}
              hint={t("workspace.branches.detail.avgPrepTimeHint")}
            />
          </div>
        </div>
      </Section>

      {/* ── Plan & billing ── */}
      {canSeeBilling ? (
        <Section
          icon={<CreditCard className="h-4 w-4" />}
          eyebrow={t("workspace.branches.detail.section.planEyebrow")}
          title={t("workspace.branches.detail.section.plan")}
          actions={
            <Link
              href="/workspace/billing"
              className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              {t("workspace.branches.managePlan")}
            </Link>
          }
        >
          {subscription ? (
            <>
              {subscription.is_trial ? (
                <div className="mb-6 border-l-4 border-status-warning bg-surface-2 px-6 py-4">
                  <p className="text-sm font-semibold text-text-primary">
                    {trialDaysLeft != null
                      ? t("workspace.branches.detail.trialActiveDays", {
                          count: trialDaysLeft,
                        })
                      : t("workspace.branches.detail.trialActive")}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {t("workspace.branches.detail.trialExplainer", {
                      plan: subscription.plan_name ?? "",
                      date: formatDate(subscription.trial_ends_at) ?? "—",
                    })}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
                <Fact
                  label={t("workspace.branches.detail.plan")}
                  value={subscription.plan_name ?? "—"}
                />
                <Fact
                  label={t("workspace.branches.detail.planStatus")}
                  value={
                    subscription.is_trial
                      ? t("workspace.branches.plan.trial")
                      : subscription.is_currently_active
                        ? t("workspace.branches.plan.active")
                        : t("workspace.branches.plan.inactive")
                  }
                />
                <Fact
                  label={t("workspace.branches.detail.priceAfterTrial")}
                  value={
                    subscription.price_at_subscription != null
                      ? formatMoney(Number(subscription.price_at_subscription), "USD")
                      : "—"
                  }
                  hint={t("workspace.branches.detail.billedUsd")}
                />
                <Fact
                  label={t("workspace.branches.detail.nextBilling")}
                  value={
                    formatDate(subscription.next_billing_date) ??
                    t("workspace.branches.detail.notSet")
                  }
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-text-secondary">
              {t("workspace.branches.detail.noPlan")}
            </p>
          )}
        </Section>
      ) : null}

      {/* ── Intelligence & demand context ── */}
      {canSeeIntelligence ? (
        <Section
          icon={<Brain className="h-4 w-4" />}
          eyebrow={t("workspace.branches.detail.section.intelligenceEyebrow")}
          title={t("workspace.branches.detail.section.intelligence")}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
            <Fact
              label={t("workspace.branches.detail.forecastAccuracy")}
              value={
                forecastAccuracy != null ? (
                  <span className="font-display text-2xl font-semibold tracking-[-0.5px]">
                    {(forecastAccuracy * (forecastAccuracy <= 1 ? 100 : 1)).toFixed(0)}%
                  </span>
                ) : (
                  t("workspace.branches.detail.awaitingData")
                )
              }
              hint={t("workspace.branches.detail.last30Days")}
            />
            <Fact
              label={t("workspace.branches.detail.forecastError")}
              value={
                mape != null ? (
                  <span className="font-display text-2xl font-semibold tracking-[-0.5px]">
                    {mape.toFixed(1)}%
                  </span>
                ) : (
                  t("workspace.branches.detail.awaitingData")
                )
              }
              hint={t("workspace.branches.detail.mapeHint")}
            />
            <Fact
              label={t("workspace.branches.detail.dataQuality")}
              value={
                qualityScore != null ? (
                  <span className="font-display text-2xl font-semibold tracking-[-0.5px]">
                    {qualityScore.toFixed(0)}
                  </span>
                ) : (
                  t("workspace.branches.detail.awaitingData")
                )
              }
              hint={
                dataQualityQuery.data?.quality_label ??
                t("workspace.branches.detail.dataQualityHint")
              }
            />
            <Fact
              label={t("workspace.branches.detail.seasonality")}
              value={
                branch.seasonality_profile ||
                t("workspace.branches.detail.notSet")
              }
              hint={t("workspace.branches.detail.seasonalityHint")}
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-3">
            <Fact
              label={t("workspace.branches.detail.eventRadius")}
              value={t("workspace.branches.detail.km", {
                count: branch.nearby_event_radius_km ?? 10,
              })}
              hint={t("workspace.branches.detail.eventRadiusHint")}
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {t("workspace.branches.detail.nearbyVenues")}
              </p>
              {venues.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {venues.map((venue) => (
                    <span
                      key={venue}
                      className="inline-flex h-6 items-center rounded-full border border-surface-4 bg-surface-3/60 px-2.5 text-xs text-text-secondary"
                    >
                      {venue}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-text-muted">
                  {t("workspace.branches.detail.noVenues")}
                </p>
              )}
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                <SoccerBall className="h-3.5 w-3.5" />
                {t("workspace.branches.detail.sportsSignal")}
              </p>
              <p className="mt-1 text-sm text-text-primary">
                {branch.shows_live_sports
                  ? t("workspace.branches.detail.sportsOn")
                  : t("workspace.branches.detail.sportsOff")}
              </p>
              {branch.shows_live_sports && sportsTeams.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sportsTeams.map((team) => (
                    <span
                      key={team}
                      className="inline-flex h-6 items-center rounded-full border border-surface-4 bg-surface-3/60 px-2.5 text-xs text-text-secondary"
                    >
                      {team}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {locationContextEntries.length ? (
            <div className="mt-8">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                <Globe className="h-3.5 w-3.5" />
                {t("workspace.branches.detail.venueContext")}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {t("workspace.branches.detail.venueContextHint")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {locationContextEntries.map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-surface-4 bg-surface-3/60 px-3 text-xs text-text-secondary"
                  >
                    <span className="capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-text-primary">
                      {String(value)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* ── Inventory rules ── */}
      {canSeeInventoryRules ? (
        <Section
          icon={<ShieldCheck className="h-4 w-4" />}
          eyebrow={t("workspace.branches.detail.section.inventoryEyebrow")}
          title={t("workspace.branches.detail.section.inventory")}
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-3">
            <Fact
              label={t("settings.branch.minStockBuffer")}
              value={`${branch.min_stock_buffer ?? 10}%`}
              hint={t("workspace.branches.detail.minStockHint")}
            />
            <Fact
              label={t("settings.branch.wasteThreshold")}
              value={`${((branch.waste_threshold ?? 0.05) * 100).toFixed(1)}%`}
              hint={t("workspace.branches.detail.wasteThresholdHint")}
            />
            <Fact
              label={t("settings.branch.reorderBuffer")}
              value={t("workspace.branches.detail.days", {
                count: branch.reorder_buffer ?? 5,
              })}
              hint={t("workspace.branches.detail.reorderHint")}
            />
          </div>
        </Section>
      ) : null}

      {/* ── Team at this branch ── */}
      {canSeeTeam ? (
        <Section
          icon={<Group className="h-4 w-4" />}
          eyebrow={t("workspace.branches.detail.section.teamEyebrow")}
          title={t("workspace.branches.detail.section.team")}
          actions={
            permissions.has(PERMISSIONS.MANAGE_TEAM) ? (
              <Link
                href="/workspace/settings?tab=team"
                className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                {t("workspace.branches.detail.manageTeam")}
              </Link>
            ) : null
          }
        >
          {assignmentsQuery.isLoading ? (
            <div className="h-16 animate-pulse rounded-xl border border-surface-4 bg-surface-2" />
          ) : branchTeam.length === 0 ? (
            <p className="text-sm text-text-secondary">
              {t("workspace.branches.detail.noTeam")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 scrollbar-thin">
              <table className="w-full min-w-[480px]">
                <thead className="border-b border-surface-4/80 bg-surface-3/40">
                  <tr>
                    {[
                      t("workspace.branches.detail.teamMember"),
                      t("workspace.branches.detail.teamRole"),
                      t("workspace.branches.detail.teamHome"),
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4/50">
                  {branchTeam.map((member) => (
                    <tr
                      key={member.id}
                      className="transition-colors hover:bg-surface-3/20"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-text-primary">
                          {member.user_name}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {member.user_email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {member.role_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {member.is_primary_branch
                          ? t("common.yes")
                          : t("common.no")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      ) : null}

      {/* ── Where to go next ── */}
      <Section
        icon={<Shop className="h-4 w-4" />}
        eyebrow={t("workspace.branches.detail.section.linksEyebrow")}
        title={t("workspace.branches.detail.section.links")}
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/workspace/today?branch_id=${branch.id}`}
            className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            {t("workspace.branches.viewToday")}
          </Link>
          <Link
            href={`/workspace/risk?branch=${branch.id}`}
            className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            {t("workspace.branches.link.risk")}
          </Link>
          {permissions.has(PERMISSIONS.MANAGE_INTEGRATIONS) ? (
            <Link
              href={`/workspace/settings?tab=integrations&branch=${branch.id}`}
              className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              {t("workspace.branches.link.integration")}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => router.push(`/workspace/overview/branch/${branch.id}`)}
            className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            {t("workspace.branches.detail.dailySnapshot")}
          </button>
        </div>
      </Section>
    </WorkspaceShell>
  );
}
