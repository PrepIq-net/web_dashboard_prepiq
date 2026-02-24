"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMyOrganizations } from "@/services/organizations/hooks";
import { useCreateBranch } from "@/services/branches/hooks";
import { Building, ArrowRight } from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";

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

const DAYS = [
  { key: "MON", label: "Mon" },
  { key: "TUE", label: "Tue" },
  { key: "WED", label: "Wed" },
  { key: "THU", label: "Thu" },
  { key: "FRI", label: "Fri" },
  { key: "SAT", label: "Sat" },
  { key: "SUN", label: "Sun" },
];

export default function CreateBranchPage() {
  const router = useRouter();
  const { data: orgs } = useMyOrganizations();

  // Use the first org the user owns
  const orgId = orgs?.[0]?.id ?? "";
  const createBranch = useCreateBranch(orgId);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [operatingDays, setOperatingDays] = useState<string[]>([
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
  ]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Branch name is required.";
    if (!address.trim()) e.address = "Address is required.";
    return e;
  }, [name, address]);

  const isValid = Object.keys(errors).length === 0;

  function toggleDay(day: string) {
    setOperatingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !orgId) return;

    await createBranch.mutateAsync(
      { name, address, timezone },
      {
        onSuccess: () => {
          router.push("/setup/sales");
        },
      },
    );
  }

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Step label */}
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
          This is where your operations live. You can add more branches later.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Branch name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              Branch name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Downtown Kitchen"
              className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] px-4 text-sm text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
            />
            {errors.name && (
              <p className="text-xs text-[#C44949]">{errors.name}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 42 Market St, Nairobi"
              className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] px-4 text-sm text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
            />
            {errors.address && (
              <p className="text-xs text-[#C44949]">{errors.address}</p>
            )}
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              Time zone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] px-4 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#A8821F] transition-colors duration-150 appearance-none cursor-pointer"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Operating days */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              Operating days
            </label>
            <div className="flex gap-2">
              {DAYS.map((day) => {
                const active = operatingDays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleDay(day.key)}
                    className={`flex-1 h-10 rounded-[8px] text-xs font-semibold transition-all duration-150
                      ${
                        active
                          ? "bg-[#A8821F]/15 border border-[#A8821F] text-[#A8821F]"
                          : "bg-[#1C1C1F] border border-[#2E2E33] text-[#5A5A60] hover:border-[#3A3A3F] hover:text-[#8E8E93]"
                      }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            {operatingDays.length === 0 && (
              <p className="text-xs text-[#C44949]">
                Select at least one operating day.
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-[#2E2E33]" />

          {/* Submit */}
          <button
            type="submit"
            disabled={
              !isValid || createBranch.isPending || operatingDays.length === 0
            }
            onClick={() => {
              // navigate to "/sales"
              router.push("/setup/sales");
            }}
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
