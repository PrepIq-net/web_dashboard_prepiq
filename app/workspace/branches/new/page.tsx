"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMyOrganizations } from "@/services/organizations/hooks";
import { useCreateBranch } from "@/services/branches/hooks";
import { ArrowRight, Sparks } from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { LocationPicker } from "@/components/ui/location-picker";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useTranslation } from "@/lib/i18n";

const TIMEZONES = [
  { value: "UTC", label: "UTC — Coordinated Universal Time" },
  { value: "America/New_York", label: "ET — New York" },
  { value: "America/Chicago", label: "CT — Chicago" },
  { value: "America/Denver", label: "MT — Denver" },
  { value: "America/Los_Angeles", label: "PT — Los Angeles" },
  { value: "America/Sao_Paulo", label: "BRT — São Paulo" },
  { value: "Europe/London", label: "GMT — London" },
  { value: "Europe/Paris", label: "CET — Paris / Berlin" },
  { value: "Europe/Moscow", label: "MSK — Moscow" },
  { value: "Africa/Nairobi", label: "EAT — Nairobi" },
  { value: "Africa/Lagos", label: "WAT — Lagos" },
  { value: "Africa/Cairo", label: "EET — Cairo" },
  { value: "Asia/Dubai", label: "GST — Dubai" },
  { value: "Asia/Kolkata", label: "IST — Mumbai / Delhi" },
  { value: "Asia/Bangkok", label: "ICT — Bangkok" },
  { value: "Asia/Singapore", label: "SGT — Singapore" },
  { value: "Asia/Tokyo", label: "JST — Tokyo" },
  { value: "Australia/Sydney", label: "AEDT — Sydney" },
];

type OperatingDay =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

type DaySchedule = {
  day: OperatingDay;
  label: string;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
};

const INITIAL_SCHEDULE: DaySchedule[] = [
  { day: "MONDAY", label: "Mon", isOpen: true, opensAt: "08:00", closesAt: "18:00" },
  { day: "TUESDAY", label: "Tue", isOpen: true, opensAt: "08:00", closesAt: "18:00" },
  { day: "WEDNESDAY", label: "Wed", isOpen: true, opensAt: "08:00", closesAt: "18:00" },
  { day: "THURSDAY", label: "Thu", isOpen: true, opensAt: "08:00", closesAt: "18:00" },
  { day: "FRIDAY", label: "Fri", isOpen: true, opensAt: "08:00", closesAt: "18:00" },
  { day: "SATURDAY", label: "Sat", isOpen: false, opensAt: "08:00", closesAt: "18:00" },
  { day: "SUNDAY", label: "Sun", isOpen: false, opensAt: "08:00", closesAt: "18:00" },
];

export default function NewBranchPage() {
  const { t } = useTranslation();
  const router = useRouter();

  function dayLabel(day: OperatingDay): string {
    const map: Record<OperatingDay, string> = {
      MONDAY: t("common.dayMon"),
      TUESDAY: t("common.dayTue"),
      WEDNESDAY: t("common.dayWed"),
      THURSDAY: t("common.dayThu"),
      FRIDAY: t("common.dayFri"),
      SATURDAY: t("common.daySat"),
      SUNDAY: t("common.daySun"),
    };
    return map[day];
  }

  const {
    data: orgs,
    isLoading: isOrgsLoading,
    error: orgsError,
  } = useMyOrganizations();

  const orgId = orgs?.[0]?.id ?? "";
  const createBranch = useCreateBranch(orgId);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [schedule, setSchedule] = useState<DaySchedule[]>(INITIAL_SCHEDULE);
  const [submitError, setSubmitError] = useState("");
  const [showUpgradeCta, setShowUpgradeCta] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [touchedDays, setTouchedDays] = useState<Record<OperatingDay, boolean>>({
    MONDAY: false,
    TUESDAY: false,
    WEDNESDAY: false,
    THURSDAY: false,
    FRIDAY: false,
    SATURDAY: false,
    SUNDAY: false,
  });

  useEffect(() => {
    if (createBranch.isSuccess) {
      router.push("/workspace/branches");
    }
  }, [createBranch.isSuccess, router]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t("workspace.branches.new.branchNameRequired");
    if (!address.trim()) e.address = t("workspace.branches.new.addressRequired");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = t("workspace.branches.new.emailInvalid");
    }
    const openDays = schedule.filter((day) => day.isOpen);
    if (openDays.length === 0) {
      e.operating_hours = t("workspace.branches.new.operatingDayRequired");
    }
    for (const day of openDays) {
      if (!day.opensAt || !day.closesAt) {
        e[`day_${day.day}`] = t("workspace.branches.new.dayTimesRequired", { day: dayLabel(day.day) });
        continue;
      }
      if (day.opensAt >= day.closesAt) {
        e[`day_${day.day}`] = t("workspace.branches.new.dayTimeOrderError", { day: dayLabel(day.day) });
      }
    }
    return e;
  }, [name, address, email, schedule]);

  const isValid = Object.keys(errors).length === 0;
  const shouldShowFieldError = (field: string) => submitted || touched[field];
  const shouldShowDayError = (day: OperatingDay) => submitted || touchedDays[day];

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function markDayTouched(day: OperatingDay) {
    setTouchedDays((prev) => ({ ...prev, [day]: true }));
  }

  function updateDay(dayKey: OperatingDay, patch: Partial<DaySchedule>) {
    setSchedule((prev) =>
      prev.map((d) => (d.day === dayKey ? { ...d, ...patch } : d)),
    );
  }

  function toggleOpen(dayKey: OperatingDay) {
    markTouched("operating_hours");
    markDayTouched(dayKey);
    setSchedule((prev) =>
      prev.map((d) => (d.day === dayKey ? { ...d, isOpen: !d.isOpen } : d)),
    );
  }

  function applyWeekdayTemplate() {
    markTouched("operating_hours");
    setSchedule((prev) =>
      prev.map((d) =>
        ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].includes(d.day)
          ? { ...d, isOpen: true, opensAt: "08:00", closesAt: "18:00" }
          : { ...d, isOpen: false },
      ),
    );
  }

  function setTimeForAllOpenDays(target: "opensAt" | "closesAt", value: string) {
    markTouched("operating_hours");
    setSchedule((prev) =>
      prev.map((d) => (d.isOpen ? { ...d, [target]: value } : d)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setShowUpgradeCta(false);
    setSubmitted(true);

    if (!isValid) {
      setSubmitError(t("workspace.branches.new.fixErrors"));
      return;
    }

    if (isOrgsLoading) {
      setSubmitError(t("workspace.branches.new.resolvingOrg"));
      return;
    }

    if (orgsError) {
      setSubmitError(
        orgsError instanceof Error ? orgsError.message : t("workspace.branches.new.loadOrgFailed"),
      );
      return;
    }

    if (!orgId) {
      setSubmitError(t("workspace.branches.new.noOrg"));
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        timezone,
        operating_hours: schedule.map((d) => ({
          day_of_week: d.day,
          is_closed: !d.isOpen,
          opens_at: d.isOpen ? d.opensAt : null,
          closes_at: d.isOpen ? d.closesAt : null,
        })),
        ...(code.trim() ? { code: code.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(latitude ? { latitude: parseFloat(latitude) } : {}),
        ...(longitude ? { longitude: parseFloat(longitude) } : {}),
      };

      await createBranch.mutateAsync(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("workspace.branches.new.createFailed");
      const isBranchLimitError =
        message.toLowerCase().includes("maximum of") &&
        message.toLowerCase().includes("branch");

      setSubmitError(message);
      if (isBranchLimitError) setShowUpgradeCta(true);
    }
  }

  return (
    <WorkspaceShell
      eyebrow={t("workspace.branches.new.eyebrow")}
      title={t("workspace.branches.new.title")}
      description={t("workspace.branches.new.description")}
      insight=""
    >
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-4 py-3.5">
        <Sparks className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
        <div>
          <p className="text-[13px] font-semibold text-text-primary">
            {t("workspace.branches.new.trialNoticeTitle")}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-text-muted">
            {t("workspace.branches.new.trialNoticeDescription")}
          </p>
        </div>
      </div>

      {isOrgsLoading && (
        <div className="mb-6 rounded-xl border border-surface-4 bg-surface-2/60 px-4 py-3">
          <p className="text-xs text-text-muted">{t("workspace.branches.new.loadingOrg")}</p>
        </div>
      )}

      {!isOrgsLoading && orgsError && (
        <div className="mb-6 rounded-xl border border-status-critical/20 bg-status-critical/8 px-4 py-3">
          <p className="text-xs text-status-critical">
            {orgsError instanceof Error ? orgsError.message : t("workspace.branches.new.loadOrgsFailed")}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* ── Core details ── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.branches.new.branchNameLabel")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => markTouched("name")}
              placeholder={t("workspace.branches.new.branchNamePlaceholder")}
              className="h-11 w-full rounded-[8px] border border-surface-4 bg-surface-2 px-4 text-sm text-text-primary placeholder-text-muted/50 transition-colors focus:border-brand-gold focus:outline-none"
            />
            {shouldShowFieldError("name") && errors.name ? (
              <p className="text-xs text-status-critical">{errors.name}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.branches.new.branchCodeLabel")} <span className="normal-case text-text-muted/50">{t("common.optional")}</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("workspace.branches.new.branchCodePlaceholder")}
              className="h-11 w-full rounded-[8px] border border-surface-4 bg-surface-2 px-4 text-sm text-text-primary placeholder-text-muted/50 transition-colors focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.branches.new.addressLabel")}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => markTouched("address")}
              placeholder={t("workspace.branches.new.addressPlaceholder")}
              className="h-11 w-full rounded-[8px] border border-surface-4 bg-surface-2 px-4 text-sm text-text-primary placeholder-text-muted/50 transition-colors focus:border-brand-gold focus:outline-none"
            />
            {shouldShowFieldError("address") && errors.address ? (
              <p className="text-xs text-status-critical">{errors.address}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              address={address}
              onLocationChange={(lat, lng, resolvedAddress) => {
                setLatitude(lat);
                setLongitude(lng);
                if (resolvedAddress) {
                  setAddress(resolvedAddress);
                  markTouched("address");
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <PhoneInput
              label={`${t("workspace.branches.new.phoneLabel")} ${t("common.optional")}`}
              value={phone}
              onChange={setPhone}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.branches.new.emailLabel")} <span className="normal-case text-text-muted/50">{t("common.optional")}</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched("email")}
              placeholder={t("workspace.branches.new.emailPlaceholder")}
              className="h-11 w-full rounded-[8px] border border-surface-4 bg-surface-2 px-4 text-sm text-text-primary placeholder-text-muted/50 transition-colors focus:border-brand-gold focus:outline-none"
            />
            {shouldShowFieldError("email") && errors.email ? (
              <p className="text-xs text-status-critical">{errors.email}</p>
            ) : null}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Select
              label={t("workspace.branches.new.timezoneLabel")}
              value={timezone}
              onChange={setTimezone}
              options={TIMEZONES}
            />
          </div>
        </div>

        <div className="h-px bg-surface-4/60" />

        {/* ── Operating hours ── */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.branches.new.operatingHours")}
            </p>
            <p className="mt-1 text-xs text-text-muted/60">
              {t("workspace.branches.new.operatingHoursDescription")}
            </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyWeekdayTemplate}
                className="h-8 rounded-[8px] border border-surface-4 px-3 text-xs text-text-secondary transition-colors hover:border-surface-4 hover:text-text-primary"
              >
                {t("workspace.branches.new.weekdaysOnly")}
              </button>
              <button
                type="button"
                onClick={() => setTimeForAllOpenDays("opensAt", "08:00")}
                className="h-8 rounded-[8px] border border-surface-4 px-3 text-xs text-text-secondary transition-colors hover:text-text-primary"
              >
                {t("workspace.branches.new.openAllAt", { time: "08:00" })}
              </button>
              <button
                type="button"
                onClick={() => setTimeForAllOpenDays("closesAt", "18:00")}
                className="h-8 rounded-[8px] border border-surface-4 px-3 text-xs text-text-secondary transition-colors hover:text-text-primary"
              >
                {t("workspace.branches.new.closeAllAt", { time: "18:00" })}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-surface-4">
            <div className="hidden border-b border-surface-4/60 bg-surface-3/40 px-3 py-2 md:grid md:grid-cols-[120px_1fr_1fr_90px] md:gap-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.branches.new.day")}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.branches.new.opens")}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.branches.new.closes")}</p>
              <p className="text-right text-[10px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.branches.new.status")}</p>
            </div>
            {schedule.map((day) => {
              const dayError = errors[`day_${day.day}`];
              return (
                <div
                  key={day.day}
                  className="grid grid-cols-1 gap-3 border-b border-surface-4/40 bg-surface-2 p-3 last:border-b-0 md:grid-cols-[120px_1fr_1fr_90px]"
                >
                  <button
                    type="button"
                    onClick={() => toggleOpen(day.day)}
                    className={`h-9 rounded-[8px] border text-xs font-semibold transition-colors ${
                      day.isOpen
                        ? "border-brand-gold/60 bg-brand-gold/10 text-brand-gold"
                        : "border-surface-4 text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {dayLabel(day.day)}
                  </button>

                  <div className="space-y-1 md:space-y-0">
                    <label className="text-[10px] uppercase tracking-[0.12em] text-text-muted md:hidden">
                      {t("workspace.branches.new.opens")}
                    </label>
                    <input
                      type="time"
                      value={day.opensAt}
                      disabled={!day.isOpen}
                      step={1800}
                      onBlur={() => markDayTouched(day.day)}
                      onChange={(e) => {
                        markTouched("operating_hours");
                        markDayTouched(day.day);
                        updateDay(day.day, { opensAt: e.target.value });
                      }}
                      className="h-10 w-full rounded-[8px] border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:border-brand-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                    />
                  </div>

                  <div className="space-y-1 md:space-y-0">
                    <label className="text-[10px] uppercase tracking-[0.12em] text-text-muted md:hidden">
                      {t("workspace.branches.new.closes")}
                    </label>
                    <input
                      type="time"
                      value={day.closesAt}
                      disabled={!day.isOpen}
                      step={1800}
                      onBlur={() => markDayTouched(day.day)}
                      onChange={(e) => {
                        markTouched("operating_hours");
                        markDayTouched(day.day);
                        updateDay(day.day, { closesAt: e.target.value });
                      }}
                      className="h-10 w-full rounded-[8px] border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:border-brand-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                    />
                  </div>

                  <div className="flex items-center justify-start md:justify-end">
                    <span className={`text-xs ${day.isOpen ? "text-status-success" : "text-text-muted"}`}>
                      {day.isOpen ? t("workspace.branches.new.open") : t("workspace.branches.new.closed")}
                    </span>
                  </div>

                  {shouldShowDayError(day.day) && dayError ? (
                    <p className="text-xs text-status-critical md:col-span-4">{dayError}</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {shouldShowFieldError("operating_hours") && errors.operating_hours ? (
            <p className="text-xs text-status-critical">{errors.operating_hours}</p>
          ) : null}
        </section>

        {/* ── Errors ── */}
        {submitError && (
          <div className="rounded-xl border border-status-critical/20 bg-status-critical/8 px-4 py-3">
            <p className="text-xs text-status-critical">{submitError}</p>
            {showUpgradeCta ? (
              <Link
                href="/workspace/billing"
                className="mt-2 block text-xs text-brand-gold underline hover:text-brand-gold/80"
              >
                {t("workspace.branches.new.managePlan")}
              </Link>
            ) : null}
          </div>
        )}

        {!isOrgsLoading && !orgsError && !orgId && (
          <div className="rounded-xl border border-status-warning/20 bg-status-warning/8 px-4 py-3">
            <p className="text-xs text-text-secondary">
              {t("workspace.branches.new.noOrgWarning")}
            </p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={createBranch.isPending || isOrgsLoading || !!orgsError || !orgId}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-gold px-6 text-sm font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createBranch.isPending ? (
              <>
                <Spinner size="sm" color="#141416" />
                {t("workspace.branches.new.creating")}
              </>
            ) : (
              <>
                {t("workspace.branches.new.submit")}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          <Link
            href="/workspace/branches"
            className="inline-flex h-11 items-center rounded-full border border-surface-4 px-5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </WorkspaceShell>
  );
}
