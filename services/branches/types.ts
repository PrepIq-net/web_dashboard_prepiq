import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// OperatingHours
// ─────────────────────────────────────────────────────────────────────────────
export const operatingHoursSchema = z.object({
  day_of_week: z.enum([
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ]),
  opens_at: z.string().nullable().optional(),
  closes_at: z.string().nullable().optional(),
  is_closed: z.boolean(),
});
export type OperatingHours = z.infer<typeof operatingHoursSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Branch (read — BranchSerializer)
// ─────────────────────────────────────────────────────────────────────────────
export const branchSchema = z.object({
  id: z.string().uuid(),
  organization: z.string().uuid(),
  organization_name: z.string(),
  name: z.string(),
  code: z.string(),
  address: z.string(),
  location_display: z
    .object({ latitude: z.number(), longitude: z.number() })
    .nullable()
    .optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  timezone: z.string().optional(),
  /** ISO 4217 currency the branch operates in (defaults USD). */
  currency: z.string().optional(),
  is_primary: z.boolean(),
  is_active: z.boolean(),
  capacity: z.number().nullable().optional(),
  operating_hours: z.array(operatingHoursSchema).optional(),
  created_at: z.string(),
  updated_at: z.string(),

  // Kitchen Configuration
  average_prep_time_minutes: z.number().optional(),
  service_start_time: z.string().nullable().optional(),
  service_end_time: z.string().nullable().optional(),

  // Demand Context
  nearby_event_venues: z.array(z.string()).optional(),
  seasonality_profile: z.string().nullable().optional(),
  local_demand_patterns: z.record(z.string(), z.any()).optional(),

  // Inventory Rules
  min_stock_buffer: z.number().optional(),
  waste_threshold: z.number().optional(),
  reorder_buffer: z.number().optional(),
});
export type Branch = z.infer<typeof branchSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CreateBranchPayload (write — CreateUpdateBranchSerializer)
// Required: name, address
// Optional: code, phone, email, timezone, is_primary, capacity, lat/lng
// ─────────────────────────────────────────────────────────────────────────────
export const createBranchPayloadSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  address: z.string().min(1, "Branch address is required"),
  code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  is_primary: z.boolean().optional(),
  is_active: z.boolean().optional(),
  capacity: z.number().int().positive().optional(),
  /** GPS coordinates — sent to backend as separate fields */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  operating_hours: z.array(operatingHoursSchema).optional(),

  // Kitchen Configuration
  average_prep_time_minutes: z.number().optional(),
  service_start_time: z.string().nullable().optional(),
  service_end_time: z.string().nullable().optional(),

  // Demand Context
  nearby_event_venues: z.array(z.string()).optional(),
  seasonality_profile: z.string().nullable().optional(),
  local_demand_patterns: z.record(z.string(), z.any()).optional(),

  // Inventory Rules
  min_stock_buffer: z.number().optional(),
  waste_threshold: z.number().optional(),
  reorder_buffer: z.number().optional(),
});
export type CreateBranchPayload = z.infer<typeof createBranchPayloadSchema>;
export type UpdateBranchPayload = Partial<CreateBranchPayload>;

// ─────────────────────────────────────────────────────────────────────────────
// Department (DepartmentSerializer)
// ─────────────────────────────────────────────────────────────────────────────
export const departmentSchema = z.object({
  id: z.string().uuid(),
  organization: z.string().uuid(),
  organization_name: z.string(),
  branch: z.string().uuid().nullable().optional(),
  branch_name: z.string().nullable().optional(),
  name: z.string(),
  code: z.string().optional(),
  is_active: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Department = z.infer<typeof departmentSchema>;

export const createDepartmentPayloadSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  branch: z.string().uuid().optional(),
  code: z.string().optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateDepartmentPayload = z.infer<
  typeof createDepartmentPayloadSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Staff roles — backend ORG_MEMBER_ROLE values from branches/models.py
// ─────────────────────────────────────────────────────────────────────────────
export const staffRoleEnum = z.enum([
  "OWNER",
  "OPS_DIRECTOR",
  "ADMIN",
  "GM",
  "BRANCH_MANAGER",
  "STAFF",
  "AUDITOR",
]);
export type StaffRole = z.infer<typeof staffRoleEnum>;

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  OWNER: "Owner",
  OPS_DIRECTOR: "Operations Director",
  ADMIN: "Admin",
  GM: "General Manager",
  BRANCH_MANAGER: "Branch Manager",
  STAFF: "Staff",
  AUDITOR: "Auditor",
};

// ─────────────────────────────────────────────────────────────────────────────
// StaffInvite (StaffInviteSerializer — __all__)
// ─────────────────────────────────────────────────────────────────────────────
export const inviteStatusEnum = z.enum([
  "PENDING",
  "ACCEPTED",
  "REVOKED",
  "EXPIRED",
]);
export type InviteStatus = z.infer<typeof inviteStatusEnum>;

export const staffInviteSchema = z.object({
  id: z.string().uuid(),
  organization: z.string().uuid(),
  organization_name: z.string().optional(),
  email: z.string().email(),
  role: staffRoleEnum,
  branch: z.string().uuid().nullable().optional(),
  branch_name: z.string().nullable().optional(),
  status: inviteStatusEnum,
  invited_by: z.string().uuid().optional(),
  invited_by_name: z.string().optional(),
  token: z.string().optional(),
  created_at: z.string(),
  revoked_at: z.string().nullable().optional(),
  revocation_reason: z.string().nullable().optional(),
});
export type StaffInvite = z.infer<typeof staffInviteSchema>;

/** POST /<org_id>/invites/ */
export const createStaffInvitePayloadSchema = z.object({
  email: z.string().email("Valid email required"),
  /** Legacy label. The backend derives it from custom_role_slug when omitted. */
  role: z.string().optional(),
  /**
   * The RBAC role to grant: a system role slug or an org custom-role slug.
   * Org-level roles (system-admin) must NOT carry a branch; every other role
   * is branch-level and requires one.
   */
  custom_role_slug: z.string().optional(),
  branch: z.string().uuid().optional(),
});
export type CreateStaffInvitePayload = z.infer<
  typeof createStaffInvitePayloadSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// AcceptInvitePayload (AcceptStaffInviteSerializer)
// ─────────────────────────────────────────────────────────────────────────────
export const acceptInvitePayloadSchema = z.object({
  token: z.string().min(1, "Token is required"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  /** Required only if the email is not already registered */
  password: z.string().min(8).optional(),
  phone: z.string().optional(),
});
export type AcceptInvitePayload = z.infer<typeof acceptInvitePayloadSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// StaffAssignment (StaffAssignmentSerializer)
// Source: OrganizationMember + BranchStaff join
// ─────────────────────────────────────────────────────────────────────────────
export const staffAssignmentSchema = z.object({
  id: z.string().uuid(),
  user: z.string().uuid(),
  role: z.string(),
  is_active: z.boolean(),
  branch: z.string().uuid().nullable().optional(),
  user_details: z.object({
    id: z.union([z.string(), z.number()]),
    email: z.string().email(),
    first_name: z.string(),
    last_name: z.string(),
    profile_picture: z.string().nullable().optional(),
  }),
  branch_details: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      address: z.string(),
    })
    .nullable()
    .optional(),
  created_at: z.string(),
});
export type StaffAssignment = z.infer<typeof staffAssignmentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// BranchStaffAssignment — one person's role at one branch.
// A user has one row per branch they work at, so the same person can be a
// Manager at one location and hold a custom role at another.
// ─────────────────────────────────────────────────────────────────────────────
export const branchStaffAssignmentSchema = z.object({
  id: z.string().uuid(),
  user: z.union([z.string(), z.number()]),
  user_email: z.string().email(),
  user_name: z.string(),
  branch: z.string().uuid(),
  branch_name: z.string(),
  /** Falls back to the org-level role when no per-branch override is set. */
  role_name: z.string().nullable().optional(),
  role_slug: z.string().nullable().optional(),
  is_primary_branch: z.boolean(),
  is_active: z.boolean(),
  assigned_at: z.string(),
});
export type BranchStaffAssignment = z.infer<typeof branchStaffAssignmentSchema>;

export type UpsertBranchAssignmentPayload = {
  user_id: string;
  branch_id: string;
  /** Omit to fall back to the member's org-level role. */
  custom_role_slug?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Invite validation — token look-up response (GET /invites/accept/?token=...)
// ─────────────────────────────────────────────────────────────────────────────
export const inviteValidationSchema = z.object({
  valid: z.boolean(),
  email: z.string().email().optional(),
  organization: z.string().optional(),
  role: z.string().optional(),
  branch: z.string().nullable().optional(),
  error: z.string().optional(),
});
export type InviteValidation = z.infer<typeof inviteValidationSchema>;

export const staffInviteContextRoleSchema = z.object({
  /** Real RBAC role slug (system role or org custom role), not a legacy label. */
  role: z.string(),
  slug: z.string(),
  name: z.string(),
  label: z.string(),
  is_system: z.boolean(),
  requires_branch: z.boolean(),
  capabilities: z.array(z.string()),
  permission_hints: z.array(z.string()),
  plan_required_capability: z.string().nullable().optional(),
});
export type StaffInviteContextRole = z.infer<
  typeof staffInviteContextRoleSchema
>;

export const staffInviteContextBranchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  is_primary: z.boolean(),
});
export type StaffInviteContextBranch = z.infer<
  typeof staffInviteContextBranchSchema
>;

export const staffInviteContextSchema = z.object({
  inviter: z.object({
    user_id: z.string().uuid(),
    // Null when the inviter has no custom_role assigned — see branches/views.py.
    role: z.string().nullable(),
    has_global_staff_mgmt: z.boolean(),
    has_branch_staff_mgmt: z.boolean(),
    managed_branch_id: z.string().uuid().nullable().optional(),
  }),
  allowed_branches: z.array(staffInviteContextBranchSchema),
  roles: z.array(staffInviteContextRoleSchema),
  /**
   * Branches are unmetered and there is no org-wide staff cap — the only limit
   * is per branch, from that branch's own plan (`per_branch[].max_staff`,
   * null = unlimited).
   */
  limits: z.object({
    current_staff_total: z.number(),
    pending_invites_total: z.number(),
    per_branch: z.array(
      z.object({
        branch_id: z.string().uuid(),
        branch_name: z.string(),
        plan_name: z.string().nullable().optional(),
        max_staff: z.number().nullable().optional(),
        current_staff: z.number(),
        pending_invites: z.number(),
      }),
    ),
  }),
});
export type StaffInviteContext = z.infer<typeof staffInviteContextSchema>;
