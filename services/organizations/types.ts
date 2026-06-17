import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Business / industry enums
// ─────────────────────────────────────────────────────────────────────────────
export const businessTypeEnum = z.enum([
  "RESTAURANT",
  "HOTEL",
  "BAKERY",
  "CLOUD_KITCHEN",
  "CATERING",
  "INSTITUTIONAL",
]);
export type BusinessType = z.infer<typeof businessTypeEnum>;
export const industryTypeEnum = businessTypeEnum;
export type IndustryType = z.infer<typeof industryTypeEnum>;

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic RBAC — system role slugs (mirrors backend SYSTEM_ROLE_SLUG_* consts)
// ─────────────────────────────────────────────────────────────────────────────
export const SYSTEM_ROLE_SLUG = {
  SUPER_ADMIN: "system-super-admin",
  ADMIN: "system-admin",
  MEMBER: "system-member",
} as const;

export type SystemRoleSlug =
  (typeof SYSTEM_ROLE_SLUG)[keyof typeof SYSTEM_ROLE_SLUG];

/** Human-readable labels for the three system roles. */
export const SYSTEM_ROLE_LABELS: Record<string, string> = {
  [SYSTEM_ROLE_SLUG.SUPER_ADMIN]: "Super Admin",
  [SYSTEM_ROLE_SLUG.ADMIN]: "Admin",
  [SYSTEM_ROLE_SLUG.MEMBER]: "Member",
};

/** Default options for role-picker dropdowns. */
export const SYSTEM_ROLE_OPTIONS = [
  { value: SYSTEM_ROLE_SLUG.SUPER_ADMIN, label: "Super Admin" },
  { value: SYSTEM_ROLE_SLUG.ADMIN, label: "Admin" },
  { value: SYSTEM_ROLE_SLUG.MEMBER, label: "Member" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Granular permission codes (mirrors backend ALL_PERMISSIONS)
// ─────────────────────────────────────────────────────────────────────────────
export const PERMISSIONS = {
  // Org & team
  MANAGE_ORG_SETTINGS: "MANAGE_ORG_SETTINGS",
  MANAGE_BILLING: "MANAGE_BILLING",
  MANAGE_BRANCHES: "MANAGE_BRANCHES",
  MANAGE_TEAM: "MANAGE_TEAM",
  VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG",
  // Production & forecasting
  VIEW_FORECASTS: "VIEW_FORECASTS",
  APPROVE_PREP_PLANS: "APPROVE_PREP_PLANS",
  OVERRIDE_PREP_PLANS: "OVERRIDE_PREP_PLANS",
  CREATE_PRODUCTION_BATCH: "CREATE_PRODUCTION_BATCH",
  LOG_WASTE: "LOG_WASTE",
  VIEW_PRODUCTION_REPORTS: "VIEW_PRODUCTION_REPORTS",
  // Inventory
  VIEW_INVENTORY: "VIEW_INVENTORY",
  MANAGE_INVENTORY: "MANAGE_INVENTORY",
  ADJUST_INVENTORY: "ADJUST_INVENTORY",
  // Financial & reporting
  VIEW_FINANCIAL_DATA: "VIEW_FINANCIAL_DATA",
  VIEW_ESG_METRICS: "VIEW_ESG_METRICS",
  DOWNLOAD_REPORTS: "DOWNLOAD_REPORTS",
  VIEW_COMPLIANCE: "VIEW_COMPLIANCE",
  // Integrations & POS
  MANAGE_INTEGRATIONS: "MANAGE_INTEGRATIONS",
  VIEW_POS_DATA: "VIEW_POS_DATA",
  // Customer & chat
  RESPOND_TO_CUSTOMERS: "RESPOND_TO_CUSTOMERS",
  ACCESS_GLOBAL_CHAT: "ACCESS_GLOBAL_CHAT",
  // Donations / ESG
  APPROVE_DONATIONS: "APPROVE_DONATIONS",
  VIEW_DONATION_HISTORY: "VIEW_DONATION_HISTORY",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Human-readable labels for every permission code. */
export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  MANAGE_ORG_SETTINGS: "Manage Organization Settings",
  MANAGE_BILLING: "Manage Billing & Subscriptions",
  MANAGE_BRANCHES: "Manage Branches",
  MANAGE_TEAM: "Manage Team Members",
  VIEW_AUDIT_LOG: "View Audit Log",
  VIEW_FORECASTS: "View Forecasts",
  APPROVE_PREP_PLANS: "Approve Prep Plans",
  OVERRIDE_PREP_PLANS: "Override Prep Plans",
  CREATE_PRODUCTION_BATCH: "Create Production Batches",
  LOG_WASTE: "Log Waste",
  VIEW_PRODUCTION_REPORTS: "View Production Reports",
  VIEW_INVENTORY: "View Inventory",
  MANAGE_INVENTORY: "Manage Inventory",
  ADJUST_INVENTORY: "Adjust Inventory Quantities",
  VIEW_FINANCIAL_DATA: "View Financial Data",
  VIEW_ESG_METRICS: "View ESG Metrics",
  DOWNLOAD_REPORTS: "Download Reports",
  VIEW_COMPLIANCE: "View Compliance Dashboards",
  MANAGE_INTEGRATIONS: "Manage Integrations",
  VIEW_POS_DATA: "View POS Data",
  RESPOND_TO_CUSTOMERS: "Respond to Customers",
  ACCESS_GLOBAL_CHAT: "Access Global Chat",
  APPROVE_DONATIONS: "Approve Donations",
  VIEW_DONATION_HISTORY: "View Donation History",
};

// ─────────────────────────────────────────────────────────────────────────────
// OrganizationMember — now carries custom_role_name / custom_role_slug
// The legacy `role` CharField is kept as an optional passthrough so existing
// data still parses; new code should read custom_role_slug / custom_role_name.
// ─────────────────────────────────────────────────────────────────────────────
export const organizationMemberSchema = z.object({
  id: z.string().uuid(),
  user: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  profile_picture: z.string().url().nullable(),
  /** Legacy field — still returned by API; prefer custom_role_name for display. */
  role: z.string().optional(),
  /** Dynamic RBAC role name (e.g. "Super Admin", "Admin", "Member"). */
  custom_role_name: z.string().nullable().optional(),
  /** Dynamic RBAC role slug used to update roles (e.g. "system-admin"). */
  custom_role_slug: z.string().nullable().optional(),
  is_active: z.boolean(),
  joined_at: z.string().datetime(),
  branch_name: z.string().nullable(),
  branch_id: z.string().uuid().nullable(),
});
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

/** Returns the best display name for a member's role. */
export function resolveMemberRoleLabel(member: OrganizationMember): string {
  if (member.custom_role_name) return member.custom_role_name;
  if (member.custom_role_slug && SYSTEM_ROLE_LABELS[member.custom_role_slug]) {
    return SYSTEM_ROLE_LABELS[member.custom_role_slug];
  }
  return member.role ?? "Member";
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / update member payloads — role-agnostic, slug-based
// ─────────────────────────────────────────────────────────────────────────────
export const addOrganizationMemberPayloadSchema = z.object({
  user_email: z.string().email("A valid user email is required"),
  /** Slug of the role to assign. Omit to default to system Member. */
  custom_role_slug: z.string().optional().nullable(),
});
export type AddOrganizationMemberPayload = z.infer<
  typeof addOrganizationMemberPayloadSchema
>;

export const updateOrganizationMemberPayloadSchema = z.object({
  custom_role_slug: z.string().min(1, "Role slug is required"),
});
export type UpdateOrganizationMemberPayload = z.infer<
  typeof updateOrganizationMemberPayloadSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Organization
// ─────────────────────────────────────────────────────────────────────────────
export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  business_type: businessTypeEnum.nullable().optional(),
  industry_type: industryTypeEnum.nullable().optional(),
  logo: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  banner_image: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  website: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  phone: z.string().nullable().optional(),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  is_verified: z.boolean().optional(),
  capacity: z.number().nullable().optional(),
  created_at: z.string().optional(),
  member_count: z.number().optional(),
  slug: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  country: z.string().nullable().optional(),
  brand_color: z.string().optional(),
  receipt_name: z.string().nullable().optional(),
  default_service_hours: z.record(z.string(), z.any()).optional(),
  default_prep_buffer_minutes: z.number().optional(),
  forecast_horizon_days: z.number().optional(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const organizationRegisterPayloadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  business_type: businessTypeEnum,
  industry_type: industryTypeEnum.optional(),
  capacity: z.number().optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  logo: z.any().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  country: z.string().optional(),
  brand_color: z.string().optional(),
  receipt_name: z.string().optional(),
  default_service_hours: z.record(z.string(), z.any()).optional(),
  default_prep_buffer_minutes: z.number().optional(),
  forecast_horizon_days: z.number().optional(),
});
export type OrganizationRegisterPayload = z.infer<
  typeof organizationRegisterPayloadSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Financial overview
// ─────────────────────────────────────────────────────────────────────────────
export const financialOverviewSummarySchema = z.object({
  revenue: z.number(),
  food_cost: z.number(),
  waste_cost: z.number(),
  gross_margin: z.number(),
  margin_pct: z.number(),
  revenue_delta_pct: z.number().nullable().optional(),
  food_cost_delta_pct: z.number().nullable().optional(),
  waste_cost_delta_pct: z.number().nullable().optional(),
  gross_margin_delta_pct: z.number().nullable().optional(),
  margin_pct_delta: z.number().nullable().optional(),
});

export const financialOverviewBranchSchema = z.object({
  branch_id: z.string(),
  branch_name: z.string(),
  revenue: z.number(),
  food_cost: z.number(),
  waste_cost: z.number(),
  gross_margin: z.number(),
  margin_pct: z.number(),
  revenue_delta_pct: z.number().nullable().optional(),
  food_cost_delta_pct: z.number().nullable().optional(),
  waste_cost_delta_pct: z.number().nullable().optional(),
  gross_margin_delta_pct: z.number().nullable().optional(),
  margin_pct_delta: z.number().nullable().optional(),
});

export const organizationFinancialOverviewSchema = z.object({
  organization_id: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  previous_start_date: z.string(),
  previous_end_date: z.string(),
  scope: z.enum(["ORGANIZATION", "BRANCH"]),
  branch_id: z.string().nullable(),
  branch_name: z.string().nullable(),
  summary: financialOverviewSummarySchema,
  branches: z.array(financialOverviewBranchSchema),
  waste_analysis: z.object({
    total_waste_cost: z.number(),
    waste_rate_pct: z.number(),
    top_items: z.array(
      z.object({ item_id: z.string(), item_title: z.string(), waste_cost: z.number() }),
    ),
  }),
  stockout_impact: z.object({
    lost_revenue: z.number(),
    stockout_events: z.number(),
    top_items: z.array(
      z.object({ item_id: z.string(), item_title: z.string(), lost_revenue: z.number() }),
    ),
    revenue_protected: z.number(),
    lost_revenue_delta_pct: z.number().nullable().optional(),
    revenue_protected_delta_pct: z.number().nullable().optional(),
  }),
  forecast_accuracy_impact: z.object({
    accuracy_pct: z.number(),
    waste_prevented: z.number(),
    stockouts_avoided: z.number(),
  }),
  impact_report: z.object({
    accuracy_pct: z.number(),
    waste_reduced: z.number(),
    stockouts_avoided: z.number(),
    revenue_protected: z.number(),
  }),
  item_profitability: z.array(
    z.object({
      item_id: z.string(),
      item_title: z.string(),
      revenue: z.number(),
      food_cost: z.number(),
      gross_margin: z.number(),
      margin_pct: z.number(),
    }),
  ),
  cost_trends: z.array(
    z.object({
      date: z.string(),
      revenue: z.number(),
      food_cost: z.number(),
      waste_cost: z.number(),
      margin: z.number(),
    }),
  ),
});
export type OrganizationFinancialOverview = z.infer<
  typeof organizationFinancialOverviewSchema
>;

export type OrganizationFinancialOverviewQuery = {
  timeframe?: "7d" | "30d" | "90d";
  start_date?: string;
  end_date?: string;
  branch_id?: string;
};
