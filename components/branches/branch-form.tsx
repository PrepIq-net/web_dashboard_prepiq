"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Clock, ShieldCheck, Shop, SoccerBall } from "iconoir-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/ui/tag-input";
import { CurrencySelect } from "@/components/ui/currency-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { LocationPicker } from "@/components/ui/location-picker";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";
import { useBranchAssignments } from "@/services/branches/hooks";
import { useOrganizationRoles } from "@/services/organizations/hooks";
import { PERMISSIONS } from "@/services/organizations/types";
import type { Branch, UpdateBranchPayload } from "@/services/branches/types";

export const BRANCH_TIMEZONES = [
  { value: "UTC", label: "UTC — Coordinated Universal Time" },
  { value: "America/New_York", label: "ET — New York" },
  { value: "America/Chicago", label: "CT — Chicago" },
  { value: "America/Denver", label: "MT — Denver" },
  { value: "America/Los_Angeles", label: "PT — Los Angeles" },
  { value: "America/Sao_Paulo", label: "BRT — São Paulo" },
  { value: "Europe/London", label: "GMT — London" },
  { value: "Europe/Paris", label: "CET — Paris / Berlin" },
  { value: "Europe/Moscow", label: "MSK — Moscow" },
  { value: "Africa/Kampala", label: "EAT — Kampala" },
  { value: "Africa/Nairobi", label: "EAT — Nairobi" },
  { value: "Africa/Kigali", label: "CAT — Kigali" },
  { value: "Africa/Lagos", label: "WAT — Lagos" },
  { value: "Africa/Cairo", label: "EET — Cairo" },
  { value: "Asia/Dubai", label: "GST — Dubai" },
  { value: "Asia/Kolkata", label: "IST — Mumbai / Delhi" },
  { value: "Asia/Bangkok", label: "ICT — Bangkok" },
  { value: "Asia/Singapore", label: "SGT — Singapore" },
  { value: "Asia/Tokyo", label: "JST — Tokyo" },
  { value: "Australia/Sydney", label: "AEDT — Sydney" },
];

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

type DaySchedule = {
  day: DayKey;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
};

type BranchFormState = {
  name: string;
  code: string;
  address: string;
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
  capacity: string;
  averagePrepTimeMinutes: string;
  serviceStartTime: string;
  serviceEndTime: string;
  schedule: DaySchedule[];
  seasonalityProfile: string;
  nearbyEventVenues: string[];
  nearbyEventRadiusKm: string;
  showsLiveSports: boolean;
  sportsTeams: string[];
  sportsLeagueIds: string[];
  sportsKeywords: string[];
  minStockBuffer: string;
  wasteThresholdPct: string;
  reorderBuffer: string;
  branchManager: string;
};

const UNASSIGNED = "";

/** "08:00:00" → "08:00" — the API returns seconds no user types. */
function trimTime(value?: string | null): string {
  return value ? value.slice(0, 5) : "";
}

function toState(branch: Branch): BranchFormState {
  const hours = new Map(
    (branch.operating_hours ?? []).map((entry) => [entry.day_of_week, entry]),
  );
  return {
    name: branch.name ?? "",
    code: branch.code ?? "",
    address: branch.address ?? "",
    latitude: branch.latitude != null ? String(branch.latitude) : "",
    longitude: branch.longitude != null ? String(branch.longitude) : "",
    phone: branch.phone ?? "",
    email: branch.email ?? "",
    timezone: branch.timezone || "UTC",
    currency: branch.currency || "USD",
    capacity: branch.capacity != null ? String(branch.capacity) : "",
    averagePrepTimeMinutes: String(branch.average_prep_time_minutes ?? 15),
    serviceStartTime: trimTime(branch.service_start_time),
    serviceEndTime: trimTime(branch.service_end_time),
    schedule: DAY_ORDER.map((day) => {
      const entry = hours.get(day);
      return {
        day,
        isOpen: entry ? !entry.is_closed : false,
        opensAt: trimTime(entry?.opens_at) || "08:00",
        closesAt: trimTime(entry?.closes_at) || "18:00",
      };
    }),
    seasonalityProfile: branch.seasonality_profile ?? "",
    nearbyEventVenues: branch.nearby_event_venues ?? [],
    nearbyEventRadiusKm: String(branch.nearby_event_radius_km ?? 10),
    showsLiveSports: Boolean(branch.shows_live_sports),
    sportsTeams: branch.sports_profile?.teams ?? [],
    sportsLeagueIds: branch.sports_profile?.league_ids ?? [],
    sportsKeywords: branch.sports_profile?.big_match_keywords ?? [],
    minStockBuffer: String(branch.min_stock_buffer ?? 10),
    // Stored as a rate; edited as a percentage because that is how kitchens
    // talk about waste.
    wasteThresholdPct: String(
      Math.round((branch.waste_threshold ?? 0.05) * 1000) / 10,
    ),
    reorderBuffer: String(branch.reorder_buffer ?? 5),
    branchManager:
      branch.branch_manager != null ? String(branch.branch_manager) : UNASSIGNED,
  };
}

function toNumberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export type BranchFormProps = {
  branch: Branch;
  onSubmit: (payload: UpdateBranchPayload) => void;
  isSaving?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  /** Extra controls rendered next to save/cancel (e.g. a delete entry point). */
  footerExtra?: React.ReactNode;
};

/**
 * Every branch field a user can supply, in one place. Shared by the branch edit
 * page and the settings → branches tab so the two never drift into offering
 * different subsets of the same record.
 */
export function BranchForm({
  branch,
  onSubmit,
  isSaving = false,
  submitLabel,
  onCancel,
  footerExtra,
}: BranchFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<BranchFormState>(() => toState(branch));
  const [submitted, setSubmitted] = useState(false);

  // Branch-manager candidates. The backend only accepts someone who can manage
  // a team, so the picker offers exactly that set rather than letting the user
  // discover the rule through a 400.
  const orgId = branch.organization;
  const rolesQuery = useOrganizationRoles(orgId);
  const assignmentsQuery = useBranchAssignments(orgId);

  const managerOptions = useMemo(() => {
    const teamRoleSlugs = new Set(
      (rolesQuery.data ?? [])
        .filter((role) => role.permission_codes?.includes(PERMISSIONS.MANAGE_TEAM))
        .map((role) => role.slug),
    );
    const candidates = (assignmentsQuery.data ?? [])
      .filter(
        (row) =>
          row.branch === branch.id &&
          row.is_active &&
          row.role_slug != null &&
          teamRoleSlugs.has(row.role_slug),
      )
      .map((row) => ({
        value: String(row.user),
        label: `${row.user_name} — ${row.role_name ?? ""}`.trim().replace(/—\s*$/, ""),
      }));

    // Keep the current manager selectable even if their role changed since.
    if (
      branch.branch_manager != null &&
      !candidates.some((option) => option.value === String(branch.branch_manager))
    ) {
      candidates.unshift({
        value: String(branch.branch_manager),
        label: branch.branch_manager_name ?? String(branch.branch_manager),
      });
    }

    return [
      { value: UNASSIGNED, label: t("workspace.branches.form.managerUnassigned") },
      ...candidates,
    ];
  }, [
    rolesQuery.data,
    assignmentsQuery.data,
    branch.id,
    branch.branch_manager,
    branch.branch_manager_name,
    t,
  ]);

  // Re-seed when the caller switches to a different branch record.
  useEffect(() => {
    setForm(toState(branch));
    setSubmitted(false);
  }, [branch.id, branch.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof BranchFormState>(
    key: K,
    value: BranchFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateDay(day: DayKey, patch: Partial<DaySchedule>) {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((entry) =>
        entry.day === day ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = t("workspace.branches.new.branchNameRequired");
    if (!form.address.trim())
      next.address = t("workspace.branches.new.addressRequired");
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = t("workspace.branches.new.emailInvalid");

    const openDays = form.schedule.filter((day) => day.isOpen);
    if (openDays.length === 0)
      next.operating_hours = t("workspace.branches.new.operatingDayRequired");
    for (const day of openDays) {
      if (!day.opensAt || !day.closesAt) {
        next[`day_${day.day}`] = t("workspace.branches.new.dayTimesRequired", {
          day: t(DAY_LABEL_KEY[day.day]),
        });
      } else if (day.opensAt >= day.closesAt) {
        next[`day_${day.day}`] = t("workspace.branches.new.dayTimeOrderError", {
          day: t(DAY_LABEL_KEY[day.day]),
        });
      }
    }

    const wastePct = Number(form.wasteThresholdPct);
    if (form.wasteThresholdPct.trim() !== "" && (!Number.isFinite(wastePct) || wastePct < 0 || wastePct > 100)) {
      next.waste_threshold = t("workspace.branches.form.wasteThresholdRange");
    }

    const radius = Number(form.nearbyEventRadiusKm);
    if (form.nearbyEventRadiusKm.trim() !== "" && (!Number.isInteger(radius) || radius < 1 || radius > 200)) {
      next.nearby_event_radius_km = t("workspace.branches.form.radiusRange");
    }

    if (
      form.serviceStartTime &&
      form.serviceEndTime &&
      form.serviceStartTime >= form.serviceEndTime
    ) {
      next.service_window = t("workspace.branches.form.serviceWindowOrder");
    }

    return next;
  }, [form, t]);

  const isValid = Object.keys(errors).length === 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid) return;

    const wastePct = toNumberOrUndefined(form.wasteThresholdPct);

    onSubmit({
      name: form.name.trim(),
      address: form.address.trim(),
      code: form.code.trim() || undefined,
      phone: form.phone.trim(),
      email: form.email.trim(),
      timezone: form.timezone,
      currency: form.currency,
      latitude: toNumberOrUndefined(form.latitude),
      longitude: toNumberOrUndefined(form.longitude),
      capacity: toNumberOrUndefined(form.capacity),
      average_prep_time_minutes: toNumberOrUndefined(form.averagePrepTimeMinutes),
      service_start_time: form.serviceStartTime || null,
      service_end_time: form.serviceEndTime || null,
      operating_hours: form.schedule.map((day) => ({
        day_of_week: day.day,
        is_closed: !day.isOpen,
        opens_at: day.isOpen ? day.opensAt : null,
        closes_at: day.isOpen ? day.closesAt : null,
      })),
      seasonality_profile: form.seasonalityProfile.trim(),
      nearby_event_venues: form.nearbyEventVenues,
      nearby_event_radius_km: toNumberOrUndefined(form.nearbyEventRadiusKm),
      shows_live_sports: form.showsLiveSports,
      sports_profile: {
        teams: form.sportsTeams,
        league_ids: form.sportsLeagueIds,
        big_match_keywords: form.sportsKeywords,
      },
      min_stock_buffer: toNumberOrUndefined(form.minStockBuffer),
      // Percentage in the UI, rate on the wire.
      waste_threshold: wastePct != null ? wastePct / 100 : undefined,
      reorder_buffer: toNumberOrUndefined(form.reorderBuffer),
      branch_manager: form.branchManager === UNASSIGNED ? null : form.branchManager,
    });
  }

  const showError = (key: string) => (submitted ? errors[key] : undefined);

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* ── General ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b border-surface-4 pb-2">
          <Shop className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.branch.general")}
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Input
            label={t("settings.branch.branchName")}
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            error={showError("name")}
          />
          <Input
            label={t("workspace.branches.form.code")}
            value={form.code}
            onChange={(event) => set("code", event.target.value)}
            placeholder={t("workspace.branches.new.branchCodePlaceholder")}
          />
          <div className="md:col-span-2">
            <Input
              label={t("settings.branch.address")}
              value={form.address}
              onChange={(event) => set("address", event.target.value)}
              error={showError("address")}
            />
          </div>
          <div className="md:col-span-2">
            <LocationPicker
              latitude={form.latitude}
              longitude={form.longitude}
              address={form.address}
              onLocationChange={(lat, lng, resolvedAddress) => {
                setForm((prev) => ({
                  ...prev,
                  latitude: lat,
                  longitude: lng,
                  address: resolvedAddress || prev.address,
                }));
              }}
            />
          </div>
          <PhoneInput
            label={t("workspace.branches.form.phone")}
            value={form.phone}
            onChange={(value) => set("phone", value)}
          />
          <Input
            label={t("workspace.branches.form.email")}
            type="email"
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
            error={showError("email")}
          />
          <Select
            label={t("settings.branch.timezone")}
            value={form.timezone}
            onChange={(value) => set("timezone", value)}
            options={BRANCH_TIMEZONES}
          />
          <CurrencySelect
            label={t("workspace.branches.new.currencyLabel")}
            value={form.currency}
            onChange={(value) => set("currency", value)}
          />
          <div className="md:col-span-2">
            <Select
              label={t("workspace.branches.form.branchManager")}
              value={form.branchManager}
              onChange={(value) => set("branchManager", value)}
              options={managerOptions}
              placeholder={t("workspace.branches.form.managerUnassigned")}
            />
            <p className="mt-2 text-xs text-text-muted">
              {managerOptions.length > 1
                ? t("workspace.branches.form.branchManagerHint")
                : t("workspace.branches.form.branchManagerEmpty")}
            </p>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          {t("workspace.branches.form.currencyHint")}
        </p>
      </section>

      {/* ── Service window & kitchen capacity ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b border-surface-4 pb-2">
          <Clock className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.branch.kitchenConfiguration")}
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Input
            label={t("settings.branch.kitchenCapacity")}
            type="number"
            min={0}
            value={form.capacity}
            onChange={(event) => set("capacity", event.target.value)}
          />
          <Input
            label={t("settings.branch.avgPrepTime")}
            type="number"
            min={1}
            value={form.averagePrepTimeMinutes}
            onChange={(event) => set("averagePrepTimeMinutes", event.target.value)}
          />
          <Input
            label={t("settings.branch.serviceStartTime")}
            type="time"
            value={form.serviceStartTime}
            onChange={(event) => set("serviceStartTime", event.target.value)}
            error={showError("service_window")}
          />
          <Input
            label={t("settings.branch.serviceEndTime")}
            type="time"
            value={form.serviceEndTime}
            onChange={(event) => set("serviceEndTime", event.target.value)}
          />
        </div>

        {/* Operating hours */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text-secondary">
                {t("workspace.branches.new.operatingHours")}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {t("workspace.branches.form.operatingHoursHint")}
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-surface-4">
            <div className="hidden border-b border-surface-4/60 bg-surface-3/40 px-3 py-2 md:grid md:grid-cols-[120px_1fr_1fr_90px] md:gap-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                {t("workspace.branches.new.day")}
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                {t("workspace.branches.new.opens")}
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                {t("workspace.branches.new.closes")}
              </p>
              <p className="text-right text-[10px] uppercase tracking-[0.14em] text-text-muted">
                {t("workspace.branches.new.status")}
              </p>
            </div>
            {form.schedule.map((day) => {
              const dayError = showError(`day_${day.day}`);
              return (
                <div
                  key={day.day}
                  className="grid grid-cols-1 gap-3 border-b border-surface-4/40 bg-surface-2 p-3 last:border-b-0 md:grid-cols-[120px_1fr_1fr_90px]"
                >
                  <button
                    type="button"
                    onClick={() => updateDay(day.day, { isOpen: !day.isOpen })}
                    aria-pressed={day.isOpen}
                    className={`h-9 rounded-button border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                      day.isOpen
                        ? "border-brand-gold/60 bg-brand-gold/10 text-brand-gold"
                        : "border-surface-4 text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {t(DAY_LABEL_KEY[day.day])}
                  </button>
                  <input
                    type="time"
                    value={day.opensAt}
                    disabled={!day.isOpen}
                    step={1800}
                    aria-label={`${t(DAY_LABEL_KEY[day.day])} ${t("workspace.branches.new.opens")}`}
                    onChange={(event) =>
                      updateDay(day.day, { opensAt: event.target.value })
                    }
                    className="h-10 w-full rounded-button border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:border-brand-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                  />
                  <input
                    type="time"
                    value={day.closesAt}
                    disabled={!day.isOpen}
                    step={1800}
                    aria-label={`${t(DAY_LABEL_KEY[day.day])} ${t("workspace.branches.new.closes")}`}
                    onChange={(event) =>
                      updateDay(day.day, { closesAt: event.target.value })
                    }
                    className="h-10 w-full rounded-button border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:border-brand-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                  />
                  <div className="flex items-center justify-start md:justify-end">
                    <span
                      className={`text-xs ${day.isOpen ? "text-text-secondary" : "text-text-muted"}`}
                    >
                      {day.isOpen
                        ? t("workspace.branches.new.open")
                        : t("workspace.branches.new.closed")}
                    </span>
                  </div>
                  {dayError ? (
                    <p className="border-l-2 border-status-critical pl-2 text-xs text-text-primary md:col-span-4">
                      {dayError}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          {showError("operating_hours") ? (
            <p className="border-l-2 border-status-critical pl-2 text-xs text-text-primary">
              {errors.operating_hours}
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Demand context ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b border-surface-4 pb-2">
          <Brain className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.branch.demandContext")}
          </h3>
        </div>
        <p className="text-xs text-text-muted">
          {t("workspace.branches.form.demandContextHint")}
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Input
            label={t("settings.branch.seasonalityProfile")}
            value={form.seasonalityProfile}
            onChange={(event) => set("seasonalityProfile", event.target.value)}
            placeholder={t("settings.branch.seasonalityPlaceholder")}
          />
          <Input
            label={t("workspace.branches.form.eventRadius")}
            type="number"
            min={1}
            max={200}
            value={form.nearbyEventRadiusKm}
            onChange={(event) => set("nearbyEventRadiusKm", event.target.value)}
            error={showError("nearby_event_radius_km")}
          />
          <div className="md:col-span-2">
            <TagInput
              removeLabel={t("workspace.branches.form.removeTag")}
              label={t("workspace.branches.form.nearbyVenues")}
              value={form.nearbyEventVenues}
              onChange={(value) => set("nearbyEventVenues", value)}
              placeholder={t("workspace.branches.form.nearbyVenuesPlaceholder")}
              hint={t("workspace.branches.form.nearbyVenuesHint")}
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-surface-4/60 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2">
              <SoccerBall className="mt-0.5 h-4 w-4 text-text-muted" />
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  {t("workspace.branches.form.showsLiveSports")}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {t("workspace.branches.form.showsLiveSportsHint")}
                </p>
              </div>
            </div>
            <Switch
              checked={form.showsLiveSports}
              onCheckedChange={(checked) => set("showsLiveSports", checked)}
            />
          </div>

          {form.showsLiveSports ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <TagInput
                removeLabel={t("workspace.branches.form.removeTag")}
                label={t("workspace.branches.form.sportsTeams")}
                value={form.sportsTeams}
                onChange={(value) => set("sportsTeams", value)}
                placeholder={t("workspace.branches.form.sportsTeamsPlaceholder")}
              />
              <TagInput
                removeLabel={t("workspace.branches.form.removeTag")}
                label={t("workspace.branches.form.sportsLeagues")}
                value={form.sportsLeagueIds}
                onChange={(value) => set("sportsLeagueIds", value)}
                placeholder={t("workspace.branches.form.sportsLeaguesPlaceholder")}
              />
              <TagInput
                removeLabel={t("workspace.branches.form.removeTag")}
                label={t("workspace.branches.form.sportsKeywords")}
                value={form.sportsKeywords}
                onChange={(value) => set("sportsKeywords", value)}
                placeholder={t("workspace.branches.form.sportsKeywordsPlaceholder")}
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Inventory rules ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b border-surface-4 pb-2">
          <ShieldCheck className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.branch.inventoryRules")}
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Input
            label={t("settings.branch.minStockBuffer")}
            type="number"
            min={0}
            value={form.minStockBuffer}
            onChange={(event) => set("minStockBuffer", event.target.value)}
          />
          <Input
            label={t("workspace.branches.form.wasteThreshold")}
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={form.wasteThresholdPct}
            onChange={(event) => set("wasteThresholdPct", event.target.value)}
            error={showError("waste_threshold")}
          />
          <Input
            label={t("settings.branch.reorderBuffer")}
            type="number"
            min={0}
            value={form.reorderBuffer}
            onChange={(event) => set("reorderBuffer", event.target.value)}
          />
        </div>
      </section>

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-3 border-t border-surface-4/60 pt-6">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-gold px-6 text-sm font-semibold text-background transition-colors hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
        >
          {isSaving ? (
            <>
              <Spinner size="sm" color="#141416" />
              {t("settings.branch.saving")}
            </>
          ) : (
            (submitLabel ?? t("settings.branch.saveChanges"))
          )}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center rounded-full border border-surface-4 px-6 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            {t("common.cancel")}
          </button>
        ) : null}
        {submitted && !isValid ? (
          <p className="border-l-2 border-status-critical pl-2 text-xs text-text-primary">
            {t("workspace.branches.new.fixErrors")}
          </p>
        ) : null}
        {footerExtra ? <div className="ml-auto">{footerExtra}</div> : null}
      </div>
    </form>
  );
}
