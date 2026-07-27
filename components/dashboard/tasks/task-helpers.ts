import { Bell, Box, Cutlery, Droplet, Table } from "iconoir-react";
import type { ComponentType, SVGProps } from "react";
import type { TaskCategory } from "@/services/execution/types";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Task-type presentation, in one place.
 *
 * Modelled on COVERAGE_TONE in ../schedule/schedule-helpers.ts: exported maps,
 * exhaustively keyed, so adding a category to TASK_CATEGORIES is a type error
 * here rather than a silent fallback to a neutral chip.
 *
 * The same five glyphs exist in iconoir-react-native, so the mobile board can
 * speak the same visual language without a second vocabulary.
 */
export const TASK_CATEGORY_ICON: Record<TaskCategory, IconComponent> = {
  PREP: Cutlery,
  SETUP: Table,
  SERVICE: Bell,
  CLEANING: Droplet,
  OTHER: Box,
};

/**
 * Tint and border only — never the label colour.
 *
 * docs/DESIGN.md §8: status-critical (3.6:1) and status-info (3.2:1) fail AA
 * for anything under 18.66px, and a category chip is 10-12px. So the colour
 * identifies the category through the icon and the edge, and the text stays
 * text-primary where it is readable.
 *
 * Gold is absent deliberately. §2 reserves it for the single most important
 * actionable thing on screen, and this page already spends it on the Add
 * button, the AI badge and the in-progress column.
 */
export const TASK_CATEGORY_TONE: Record<TaskCategory, string> = {
  PREP: "border-status-info/40 bg-status-info/10",
  SETUP: "border-status-warning/40 bg-status-warning/10",
  SERVICE: "border-status-critical/40 bg-status-critical/10",
  CLEANING: "border-status-success/40 bg-status-success/10",
  OTHER: "border-surface-4 bg-surface-3/60",
};

/** Icon colour: carries the category, and is exempt from the small-text rule. */
export const TASK_CATEGORY_ICON_TONE: Record<TaskCategory, string> = {
  PREP: "text-status-info",
  SETUP: "text-status-warning",
  SERVICE: "text-status-critical",
  CLEANING: "text-status-success",
  OTHER: "text-text-muted",
};

export const TASK_CATEGORY_LABEL_KEY: Record<TaskCategory, string> = {
  PREP: "tasks.category.prep",
  SETUP: "tasks.category.setup",
  SERVICE: "tasks.category.service",
  CLEANING: "tasks.category.cleaning",
  OTHER: "tasks.category.other",
};

/** Narrow an unvalidated category string onto the known set. */
export function asTaskCategory(value: string): TaskCategory {
  return value in TASK_CATEGORY_TONE ? (value as TaskCategory) : "OTHER";
}

/**
 * How far through its estimate an in-progress task is.
 *
 * Returns null when there is nothing honest to show — a task that has not
 * started, or one with no estimate to measure against. Values above 1 are
 * returned as-is so the caller can render overtime rather than a ring that
 * silently pins at full and stops meaning anything.
 */
export function taskProgress(
  startedAt: string | null,
  estimatedMinutes: number | null,
  now: number,
): number | null {
  if (!startedAt || !estimatedMinutes || estimatedMinutes <= 0) return null;

  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) return null;

  const elapsedMinutes = (now - started) / 60_000;
  if (elapsedMinutes < 0) return null;

  return elapsedMinutes / estimatedMinutes;
}

/** Whole minutes left on the estimate; negative once it is overrun. */
export function minutesRemaining(
  startedAt: string | null,
  estimatedMinutes: number | null,
  now: number,
): number | null {
  if (!startedAt || !estimatedMinutes || estimatedMinutes <= 0) return null;

  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) return null;

  return Math.round(estimatedMinutes - (now - started) / 60_000);
}
