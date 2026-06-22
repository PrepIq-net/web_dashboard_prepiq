/**
 * Role resolution helpers for the new 3-tier RBAC system.
 *
 * organization_role from the profile API is the custom_role.name string:
 *   "Super Admin"  — full org ownership (was: OWNER, OPS_DIRECTOR, ADMIN)
 *   "Admin"        — management access (was: GM, BRANCH_MANAGER)
 *   "Member"       — day-to-day operations (was: STAFF_OPERATOR)
 *
 * Use these helpers instead of hardcoded old role strings in pages.
 */

type OrgRole = string | null | undefined;

/** Normalise to lowercase for stable comparison. */
function norm(role: OrgRole): string {
  return (role ?? "").toLowerCase();
}

/** Super Admin — full org ownership and billing. */
export function isOrgLeadership(role: OrgRole): boolean {
  return norm(role).includes("super");
}

/** Admin or Super Admin — branch management, team, financial data. */
export function isOrgManagement(role: OrgRole): boolean {
  const n = norm(role);
  return n.includes("super") || n === "admin";
}

/** Member — operational day-to-day execution. */
export function isOrgMember(role: OrgRole): boolean {
  return norm(role) === "member";
}

/** Any authenticated org member (all tiers). */
export function hasOrgRole(role: OrgRole): boolean {
  return isOrgLeadership(role) || isOrgManagement(role) || isOrgMember(role);
}
