"use client";

import { WarningTriangle } from "iconoir-react";
import type { BranchDayToday } from "@/services/production-intelligence/types";

/**
 * Surfaces `branchDay.system_health` — already fully typed and returned on
 * every `branchDayToday` response, but never rendered on web until now (see
 * the mobile port at `mobile-app/src/components/today/system-health-banner.tsx`,
 * which has carried this since it shipped). Silent when POS data is flowing
 * normally; only speaks up once readiness drops below GREEN.
 *
 * Not a card — a left accent rule, matching `intelligence-journey-banner.tsx`
 * per DESIGN.md's no-card-in-card rule.
 */
export function SystemHealthBanner({
  systemHealth,
}: {
  systemHealth?: BranchDayToday["system_health"];
}) {
  if (!systemHealth || systemHealth.readiness === "GREEN") return null;

  const isRed = systemHealth.readiness === "RED";

  // Tailwind's JIT scanner needs full class strings, not interpolated ones —
  // hence the branch rather than building the class from `toneClass`.
  return isRed ? (
    <div className="mb-6 flex items-start gap-2.5 border-l-4 border-l-status-critical bg-status-critical/8 px-4 py-3">
      <WarningTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-status-critical"
        strokeWidth={1.75}
      />
      <p className="text-sm text-status-critical">{systemHealth.note}</p>
    </div>
  ) : (
    <div className="mb-6 flex items-start gap-2.5 border-l-4 border-l-status-warning bg-status-warning/8 px-4 py-3">
      <WarningTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-status-warning"
        strokeWidth={1.75}
      />
      <p className="text-sm text-status-warning">{systemHealth.note}</p>
    </div>
  );
}
