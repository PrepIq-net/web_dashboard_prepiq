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
  is_primary: z.boolean(),
  is_active: z.boolean(),
  capacity: z.number().nullable().optional(),
  operating_hours: z.array(operatingHoursSchema).optional(),
  created_at: z.string(),
  updated_at: z.string(),
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
  is_primary: z.boolean().optional(),
  is_active: z.boolean().optional(),
  capacity: z.number().int().positive().optional(),
  /** GPS coordinates — sent to backend as separate fields */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  operating_hours: z.array(operatingHoursSchema).optional(),
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
// Staff roles — mirrors organizations/constants.py
// ─────────────────────────────────────────────────────────────────────────────
export const staffRoleEnum = z.enum([
  "OWNER",
  "ADMIN",
  "BRANCH_MANAGER",
  "STAFF",
  "AUDITOR",
]);
export type StaffRole = z.infer<typeof staffRoleEnum>;

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  BRANCH_MANAGER: "Branch Manager",
  STAFF: "Staff Operator",
  AUDITOR: "External Auditor",
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
  role: staffRoleEnum,
  /**
   * Required when role is BRANCH_MANAGER or STAFF.
   * Must NOT be provided for OWNER, ADMIN, AUDITOR.
   */
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
