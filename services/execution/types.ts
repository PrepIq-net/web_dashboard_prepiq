import { z } from "zod";

// ── Vocabulary (mirrors backend/execution/constants.py) ─────────────────────

export const TASK_STATUSES = [
  "SUGGESTED",
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** The three columns. SUGGESTED lives in the review tray, CANCELLED nowhere. */
export const BOARD_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const TASK_CATEGORIES = [
  "PREP",
  "SETUP",
  "SERVICE",
  "CLEANING",
  "OTHER",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

// ── Schemas ──────────────────────────────────────────────────────────────────

const personSchema = z
  .object({ id: z.string(), name: z.string() })
  .nullable();

export const kitchenTaskLinkSchema = z.object({
  prep_plan_item_id: z.string(),
  product_title: z.string(),
  planned_quantity: z.number(),
  unit: z.string(),
});
export type KitchenTaskLink = z.infer<typeof kitchenTaskLinkSchema>;

export const kitchenTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(TASK_CATEGORIES),
  status: z.enum(TASK_STATUSES),
  source: z.enum(["AI_PLAN", "AI_LIVE", "MANUAL"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]),
  sort_order: z.number(),
  assigned_to: personSchema,
  suggested_assignee: personSchema,
  // True when the assignee claimed the task themselves — drives the board's
  // "release" affordance (you can only drop a claim you made yourself).
  self_assigned: z.boolean().optional().default(false),
  estimated_minutes: z.number().nullable(),
  rationale: z.string(),
  links: z.array(kitchenTaskLinkSchema),
  generated_by: z.string(),
  confirmed_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
});
export type KitchenTask = z.infer<typeof kitchenTaskSchema>;

/** An on-shift candidate for assignment, with their current load. */
export const boardAssigneeSchema = z.object({
  id: z.string(),
  name: z.string(),
  shifts: z.array(
    z.object({
      start_time: z.string(),
      end_time: z.string(),
      role: z.string().nullable(),
    }),
  ),
  assigned_count: z.number(),
});
export type BoardAssignee = z.infer<typeof boardAssigneeSchema>;

export const taskBoardSchema = z.object({
  branch_id: z.string(),
  date: z.string(),
  suggestions: z.array(kitchenTaskSchema),
  columns: z.record(z.string(), z.array(kitchenTaskSchema)),
  assignees: z.array(boardAssigneeSchema).optional().default([]),
  summary: z.record(z.string(), z.number()),
});
export type TaskBoard = z.infer<typeof taskBoardSchema>;

export const generateResponseSchema = z.object({
  generated_by: z.string(),
  tasks: z.array(kitchenTaskSchema),
});

export const confirmResponseSchema = z.object({
  tasks: z.array(kitchenTaskSchema),
  warnings: z.array(z.string()),
});

export const taskMutationResponseSchema = z.object({
  task: kitchenTaskSchema,
  warnings: z.array(z.string()).optional(),
});

// ── Payloads ─────────────────────────────────────────────────────────────────

export type CreateTaskPayload = {
  branch_id: string;
  date: string;
  title: string;
  description?: string;
  category?: TaskCategory;
  priority?: "LOW" | "NORMAL" | "HIGH";
  estimated_minutes?: number;
  user_id?: string | null;
  prep_plan_item_ids?: string[];
};

export type UpdateTaskPayload = {
  title?: string;
  description?: string;
  category?: TaskCategory;
  priority?: "LOW" | "NORMAL" | "HIGH";
  estimated_minutes?: number;
};
