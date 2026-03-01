"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMyOrganizations } from "@/services/organizations/hooks";
import { useCreateBranch } from "@/services/branches/hooks";
import { Building, ArrowRight } from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";

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

export default function CreateBranchPage() {
  const router = useRouter();
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
  const [schedule, setSchedule] = useState<DaySchedule[]>(INITIAL_SCHEDULE);
  const [submitError, setSubmitError] = useState("");
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
      router.push("/setup/sales");
    }
  }, [createBranch.isSuccess, router]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Branch name is required.";
    if (!address.trim()) e.address = "Address is required.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = "Please enter a valid email.";
    }

    const openDays = schedule.filter((day) => day.isOpen);
    if (openDays.length === 0) {
      e.operating_hours = "At least one operating day is required.";
    }
    for (const day of openDays) {
      if (!day.opensAt || !day.closesAt) {
        e[`day_${day.day}`] = `${day.label}: opening and closing times are required.`;
        continue;
      }
      if (day.opensAt >= day.closesAt) {
        e[`day_${day.day}`] = `${day.label}: opening time must be earlier than closing time.`;
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
      prev.map((d) =>
        d.day === dayKey
          ? { ...d, isOpen: !d.isOpen }
          : d,
      ),
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
    setSubmitted(true);

    if (!isValid) {
      setSubmitError("Please fix the errors before continuing.");
      return;
    }

    if (isOrgsLoading) {
      setSubmitError("Resolving organization context. Please try again.");
      return;
    }

    if (orgsError) {
      setSubmitError(
        orgsError instanceof Error
          ? orgsError.message
          : "Failed to load organization context.",
      );
      return;
    }

    if (!orgId) {
      setSubmitError(
        "No organization found for this account. Create or join an organization first.",
      );
      return;
    }

    try {
      await createBranch.mutateAsync({
        name: name.trim(),
        address: address.trim(),
        timezone,
        code: code.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        operating_hours: schedule.map((d) => ({
          day_of_week: d.day,
          is_closed: !d.isOpen,
          opens_at: d.isOpen ? d.opensAt : null,
          closes_at: d.isOpen ? d.closesAt : null,
        })),
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create branch.",
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-2 mb-10">
          <Building className="h-4 w-4 text-[#A8821F]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Step 1 — Branch Setup
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-2">
          Create your first branch
        </h1>
        <p className="text-[14px] text-[#8E8E93] mb-10">
          Define your branch profile and operating schedule. You can update this later.
        </p>

        {isOrgsLoading && (
          <div className="mb-6 p-3 rounded-[8px] bg-[#3A6EA5]/10 border border-[#3A6EA5]/20">
            <p className="text-xs text-[#C7C7CC]">
              Loading organization context...
            </p>
          </div>
        )}

        {!isOrgsLoading && orgsError && (
          <div className="mb-6 p-3 rounded-[8px] bg-[#C44949]/10 border border-[#C44949]/20">
            <p className="text-xs text-[#C44949]">
              {orgsError instanceof Error
                ? orgsError.message
                : "Failed to load organizations."}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
                Branch name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => markTouched("name")}
                placeholder="e.g. Downtown Kitchen"
                className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] px-4 text-sm text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
              />
              {shouldShowFieldError("name") && errors.name ? (
                <p className="text-xs text-[#C44949]">{errors.name}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
                Branch code <span className="text-[#5A5A60]">(optional)</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. BR001"
                className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] px-4 text-sm text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => markTouched("address")}
                placeholder="e.g. 42 Market St, Nairobi"
                className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] px-4 text-sm text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
              />
              {shouldShowFieldError("address") && errors.address ? (
                <p className="text-xs text-[#C44949]">{errors.address}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
                Phone <span className="text-[#5A5A60]">(optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +254 700 000 000"
                className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] px-4 text-sm text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
                Email <span className="text-[#5A5A60]">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => markTouched("email")}
                placeholder="e.g. manager@branch.com"
                className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] px-4 text-sm text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
              />
              {shouldShowFieldError("email") && errors.email ? (
                <p className="text-xs text-[#C44949]">{errors.email}</p>
              ) : null}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Select
                label="Time zone"
                value={timezone}
                onChange={setTimezone}
                options={TIMEZONES}
              />
            </div>
          </div>

          <div className="h-px bg-[#2E2E33]" />

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
                  Operating schedule
                </label>
                <p className="mt-1 text-xs text-[#5A5A60]">
                  Toggle open days and set hours for each day.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyWeekdayTemplate}
                  className="h-8 rounded-[8px] border border-[#2E2E33] px-3 text-xs text-[#C7C7CC] hover:border-[#3A3A40] hover:text-[#F5F5F7] transition-colors"
                >
                  Weekday template
                </button>
                <button
                  type="button"
                  onClick={() => setTimeForAllOpenDays("opensAt", "08:00")}
                  className="h-8 rounded-[8px] border border-[#2E2E33] px-3 text-xs text-[#C7C7CC] hover:border-[#3A3A40] hover:text-[#F5F5F7] transition-colors"
                >
                  Open all @ 08:00
                </button>
                <button
                  type="button"
                  onClick={() => setTimeForAllOpenDays("closesAt", "18:00")}
                  className="h-8 rounded-[8px] border border-[#2E2E33] px-3 text-xs text-[#C7C7CC] hover:border-[#3A3A40] hover:text-[#F5F5F7] transition-colors"
                >
                  Close all @ 18:00
                </button>
              </div>
            </div>

            <div className="rounded-[10px] border border-[#2E2E33] overflow-hidden">
              <div className="hidden md:grid md:grid-cols-[120px_1fr_1fr_90px] md:gap-3 md:border-b md:border-[#232327] md:bg-[#18181A] md:px-3 md:py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Day</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Opens</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Closes</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#8E8E93] text-right">Status</p>
              </div>
              {schedule.map((day) => {
                const dayError = errors[`day_${day.day}`];
                return (
                  <div
                    key={day.day}
                    className="grid grid-cols-1 gap-3 border-b border-[#232327] bg-[#1C1C1F] p-3 md:grid-cols-[120px_1fr_1fr_90px]"
                  >
                    <button
                      type="button"
                      onClick={() => toggleOpen(day.day)}
                      className={`h-9 rounded-[8px] border text-xs font-semibold transition-colors ${
                        day.isOpen
                          ? "border-[#A8821F] bg-[#A8821F]/15 text-[#A8821F]"
                          : "border-[#2E2E33] text-[#8E8E93] hover:text-[#C7C7CC]"
                      }`}
                    >
                      {day.label}
                    </button>

                    <div className="space-y-1 md:space-y-0">
                      <label className="md:hidden text-[10px] uppercase tracking-[0.12em] text-[#8E8E93]">Opens</label>
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
                        className="h-10 w-full rounded-[8px] border border-[#2E2E33] bg-[#141416] px-3 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#A8821F] disabled:opacity-45 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-0">
                      <label className="md:hidden text-[10px] uppercase tracking-[0.12em] text-[#8E8E93]">Closes</label>
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
                        className="h-10 w-full rounded-[8px] border border-[#2E2E33] bg-[#141416] px-3 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#A8821F] disabled:opacity-45 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex items-center justify-start md:justify-end">
                      <span className={`text-xs ${day.isOpen ? "text-[#3F8F68]" : "text-[#8E8E93]"}`}>
                        {day.isOpen ? "Open" : "Closed"}
                      </span>
                    </div>
                    
                    {shouldShowDayError(day.day) && dayError ? (
                      <p className="md:col-span-4 text-xs text-[#C44949]">{dayError}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {shouldShowFieldError("operating_hours") && errors.operating_hours ? (
              <p className="text-xs text-[#C44949]">{errors.operating_hours}</p>
            ) : null}
          </section>

          {submitError && (
            <div className="p-3 rounded-[8px] bg-[#C44949]/10 border border-[#C44949]/20">
              <p className="text-xs text-[#C44949]">{submitError}</p>
            </div>
          )}

          {!isOrgsLoading && !orgsError && !orgId && (
            <div className="p-3 rounded-[8px] bg-[#C48B2A]/10 border border-[#C48B2A]/20">
              <p className="text-xs text-[#C7C7CC]">
                This account is not linked to an organization yet. Branches can
                only be created inside an organization.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={createBranch.isPending || isOrgsLoading || !!orgsError || !orgId}
            className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-50 disabled:cursor-not-allowed text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
          >
            {createBranch.isPending ? (
              <>
                <Spinner size="sm" color="#141416" />
                Creating branch…
              </>
            ) : (
              <>
                Create Branch
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full text-center text-sm text-[#5A5A60] hover:text-[#8E8E93] transition-colors duration-150"
          >
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}
