import { PERMISSIONS } from "@/services/organizations/types";
import type { UserProfile } from "@/services/users/types";

/**
 * Build a Set<string> of permission codes for a user.
 *
 * Uses the real permissions array returned by /users/me when available
 * (populated from the user's assigned Role). Falls back to approximating
 * from the role name string for users whose custom_role hasn't been set yet
 * or while the API response is still cached without the new field.
 */
export function resolvePermissions(
  user: UserProfile | null | undefined,
): Set<string> {
  if (!user) return new Set();

  // Real permissions from the API — always prefer these.
  if (user.permissions?.length) {
    return new Set(user.permissions);
  }

  // Fallback: approximate from role name so the UI doesn't break for existing
  // users who don't yet have a custom_role assigned on the backend.
  const name = (user.organization_role ?? "").toLowerCase();
  if (name.includes("super") || name === "admin") {
    return new Set(Object.values(PERMISSIONS));
  }
  if (name === "member") {
    return new Set([
      PERMISSIONS.VIEW_FORECASTS,
      PERMISSIONS.APPROVE_PREP_PLANS,
      PERMISSIONS.OVERRIDE_PREP_PLANS,
      PERMISSIONS.CREATE_PRODUCTION_BATCH,
      PERMISSIONS.LOG_WASTE,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.ADJUST_INVENTORY,
      PERMISSIONS.VIEW_POS_DATA,
      PERMISSIONS.RESPOND_TO_CUSTOMERS,
      PERMISSIONS.ACCESS_GLOBAL_CHAT,
      PERMISSIONS.VIEW_DONATION_HISTORY,
      PERMISSIONS.VIEW_PRODUCTION_REPORTS,
    ]);
  }
  return new Set();
}

/**
 * Management-level permissions that make the Dashboard meaningful. Holding any
 * one of them is enough.
 *
 * Exported so the nav registry filters the sidebar/palette entry on exactly the
 * same rule the page itself enforces — otherwise the link shows for people who
 * get bounced the moment they click it.
 */
export const DASHBOARD_ACCESS_PERMISSIONS: string[] = [
  PERMISSIONS.VIEW_ANALYTICS,
  PERMISSIONS.VIEW_FINANCIAL_DATA,
  PERMISSIONS.MANAGE_BRANCHES,
  PERMISSIONS.VIEW_ALL_BRANCHES,
  PERMISSIONS.VIEW_PRODUCTION_REPORTS,
  PERMISSIONS.MANAGE_TEAM,
  PERMISSIONS.VIEW_COMPLIANCE,
];

/**
 * True if the user has enough management-level permissions to use the
 * Dashboard. Users without any of these belong on the Today page instead.
 */
export function canAccessDashboard(perms: Set<string>): boolean {
  return DASHBOARD_ACCESS_PERMISSIONS.some((perm) => perms.has(perm));
}
