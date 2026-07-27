import { z } from "zod";

export const AVAILABILITY_STATUS = ["PENDING", "APPROVED", "REJECTED"] as const;
export const SCHEDULE_STATUS = ["DRAFT", "PUBLISHED"] as const;
export const COVERAGE_STATUS = ["UNDER", "OK", "OVER", "UNKNOWN"] as const;

export const userSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
});

export const shiftTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  sort_order: z.number(),
  is_active: z.boolean(),
  duration_hours: z.number(),
});

export const laborRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  sort_order: z.number(),
  is_active: z.boolean(),
});

export const availabilityEntrySchema = z.object({
  weekday: z.number(),
  shift_template_id: z.string(),
  shift_template_name: z.string(),
  is_available: z.boolean(),
});

export const employeeAvailabilitySchema = z.object({
  id: z.string(),
  user: userSummarySchema,
  week_start_date: z.string(),
  status: z.enum(AVAILABILITY_STATUS),
  note: z.string(),
  entries: z.array(availabilityEntrySchema),
  submitted_at: z.string().nullable(),
  reviewed_by: userSummarySchema.nullable(),
  reviewed_at: z.string().nullable(),
  review_note: z.string(),
});

// ── Employee self-service (mirrors backend labor `me/` endpoints) ───────────

export const contextWeekSchema = z.object({
  week_start_date: z.string(),
  status: z.enum(AVAILABILITY_STATUS).nullable(),
});

export const contextBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string(),
  shift_templates: z.array(shiftTemplateSchema),
  weeks: z.array(contextWeekSchema),
});

export const myContextSchema = z.object({
  branches: z.array(contextBranchSchema),
  current_week_start: z.string(),
  next_week_start: z.string().optional(),
});

export const myAvailabilityResponseSchema = z.object({
  week_start_date: z.string(),
  shift_templates: z.array(shiftTemplateSchema),
  availability: employeeAvailabilitySchema.nullable(),
});

export const availabilitySummarySchema = z.object({
  week_start_date: z.string(),
  submitted: z.number(),
  missing: z.number(),
  roster_size: z.number(),
  pending: z.number(),
  approved: z.number(),
  rejected: z.number(),
});

export const availabilityWeekSchema = z.object({
  week_start_date: z.string(),
  summary: availabilitySummarySchema,
  shift_templates: z.array(shiftTemplateSchema),
  submissions: z.array(employeeAvailabilitySchema),
  missing: z.array(userSummarySchema),
});

export const shiftSchema = z.object({
  id: z.string(),
  user: userSummarySchema,
  date: z.string(),
  shift_template: z.string().nullable(),
  shift_template_name: z.string().optional().nullable(),
  start_time: z.string(),
  end_time: z.string(),
  labor_role: z.string().nullable(),
  labor_role_name: z.string().optional().nullable(),
  notes: z.string(),
  duration_hours: z.number(),
});

export const generationMetadataSchema = z.object({
  source: z.string().optional(),
  summary: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  rejected_swaps: z.array(z.string()).optional(),
  stats: z.record(z.string(), z.unknown()).optional(),
});

export const weeklyScheduleSchema = z.object({
  id: z.string(),
  branch: z.string(),
  week_start_date: z.string(),
  week_end_date: z.string(),
  status: z.enum(SCHEDULE_STATUS),
  generation_source: z.string(),
  generation_metadata: generationMetadataSchema.passthrough().default({}),
  shifts: z.array(shiftSchema),
  created_by: userSummarySchema.nullable(),
  published_by: userSummarySchema.nullable(),
  published_at: z.string().nullable(),
});

export const roleCoverageSchema = z.object({
  name: z.string(),
  required_headcount: z.number(),
  scheduled_headcount: z.number(),
  required_hours: z.number(),
  scheduled_hours: z.number(),
  coverage_pct: z.number().nullable(),
  status: z.enum(COVERAGE_STATUS),
});

export const dayCoverageSchema = z.object({
  date: z.string(),
  status: z.enum(COVERAGE_STATUS),
  coverage_pct: z.number().nullable(),
  required_hours: z.number(),
  scheduled_hours: z.number(),
  required_headcount: z.number(),
  scheduled_headcount: z.number(),
  estimated_meals: z.number().nullable(),
  standard_provenance: z.string().nullable(),
  rationale: z.string(),
  roles: z.array(roleCoverageSchema),
  has_requirement: z.boolean(),
});

export const weekCoverageSchema = z.object({
  week_start_date: z.string(),
  coverage_pct: z.number().nullable(),
  status: z.enum(COVERAGE_STATUS),
  understaffed_days: z.array(z.string()),
  days: z.array(dayCoverageSchema),
});

export const laborStandardSchema = z.object({
  meals_per_labor_hour: z.number(),
  provenance: z.string(),
  provenance_label: z.string(),
  sample_size: z.number(),
});

export const coverageResponseSchema = weekCoverageSchema.extend({
  standard: laborStandardSchema,
});

export const scheduleWeekSchema = z.object({
  week_start_date: z.string(),
  schedule: weeklyScheduleSchema.nullable(),
  roster: z.array(userSummarySchema),
  shift_templates: z.array(shiftTemplateSchema),
  labor_roles: z.array(laborRoleSchema),
  availability_summary: availabilitySummarySchema,
  coverage: weekCoverageSchema,
});

export const generateResponseSchema = z.object({
  schedule: weeklyScheduleSchema,
  warnings: z.array(z.string()),
  coverage: weekCoverageSchema,
});

export const shiftMutationResponseSchema = z.object({
  shift: shiftSchema,
  warnings: z.array(z.string()),
});

export const historyWeekSchema = z.object({
  week_start_date: z.string(),
  coverage_pct: z.number().nullable(),
  forecast_accuracy: z.number().nullable(),
  scheduled_hours: z.number(),
  required_hours: z.number(),
  understaffed_days: z.number(),
});

export const historyResponseSchema = z.object({
  weeks: z.array(historyWeekSchema),
});

export type UserSummary = z.infer<typeof userSummarySchema>;
export type ShiftTemplate = z.infer<typeof shiftTemplateSchema>;
export type LaborRole = z.infer<typeof laborRoleSchema>;
export type EmployeeAvailability = z.infer<typeof employeeAvailabilitySchema>;
export type AvailabilityWeek = z.infer<typeof availabilityWeekSchema>;
export type ContextBranch = z.infer<typeof contextBranchSchema>;
export type MyContext = z.infer<typeof myContextSchema>;
export type MyAvailabilityResponse = z.infer<typeof myAvailabilityResponseSchema>;
export type AvailabilitySummary = z.infer<typeof availabilitySummarySchema>;
export type Shift = z.infer<typeof shiftSchema>;
export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>;
export type ScheduleWeek = z.infer<typeof scheduleWeekSchema>;
export type DayCoverage = z.infer<typeof dayCoverageSchema>;
export type WeekCoverage = z.infer<typeof weekCoverageSchema>;
export type CoverageResponse = z.infer<typeof coverageResponseSchema>;
export type RoleCoverage = z.infer<typeof roleCoverageSchema>;
export type GenerateResponse = z.infer<typeof generateResponseSchema>;
export type HistoryWeek = z.infer<typeof historyWeekSchema>;
export type CoverageStatus = (typeof COVERAGE_STATUS)[number];
export type AvailabilityStatus = (typeof AVAILABILITY_STATUS)[number];

export interface CreateShiftPayload {
  branch_id: string;
  week_start_date: string;
  user_id: string;
  date: string;
  shift_template_id?: string | null;
  labor_role_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string;
}

export interface UpdateShiftPayload {
  shift_template_id?: string | null;
  labor_role_id?: string | null;
  date?: string;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string;
}

export interface ReviewAvailabilityPayload {
  status: "APPROVED" | "REJECTED";
  review_note?: string;
}

export interface AvailabilityEntryInput {
  weekday: number;
  shift_template_id: string;
  is_available: boolean;
}

export interface SubmitAvailabilityPayload {
  branch_id: string;
  week_start_date: string;
  note?: string;
  entries: AvailabilityEntryInput[];
}
