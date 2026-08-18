import {
  canSeeNavPage,
  getNavPage,
  type NavPageId,
} from "@/lib/command/navigation";
import type { Notification } from "@/services/notifications/types";

/**
 * Where a notification tap should land.
 *
 * Routes are a client concern — the backend tells us what a notification IS
 * (its `code`) and what it is about (`branch`, `related_model`/`related_id`,
 * `metadata`); this module decides which screen answers that. Keeping the
 * decision here means the in-app list, the bell dropdown, and the push
 * service worker cannot disagree about where a given alert leads.
 *
 * Mirrored on mobile by `src/services/notifications/destinations.ts` — the
 * codes are shared, the routes are not.
 */

/** Which workspace page answers each notification code. */
const PAGE_BY_CODE: Record<string, NavPageId> = {
  // Integrations — a dead connector is fixed in Settings, not in the feed.
  CONNECTOR_OFFLINE: "settings",
  CONNECTOR_SYNC_FAILURE: "settings",
  CONNECTOR_SCHEMA_CHANGED: "settings",
  POS_IMPORTED: "settings",

  // Labor — every one of these is answered on the schedule.
  SCHEDULE_PUBLISHED: "schedule",
  SHIFT_CHANGED: "schedule",
  SHIFT_REMINDER: "schedule",
  AVAILABILITY_REMINDER: "schedule",
  AVAILABILITY_PENDING: "schedule",
  COVERAGE_LOW: "schedule",

  // Execution — the board is where a task is picked up.
  KITCHEN_TASK_ASSIGNED: "tasks",
  KITCHEN_TASK_SUGGESTED: "tasks",
  PREP_TASK_ASSIGNED: "tasks",

  // Planning — tomorrow's shape, decided on the calendar.
  PLANNING_PROMOTION_UPCOMING: "planning",
  PLANNING_LARGE_RESERVATION_UPCOMING: "planning",
  PLANNING_CLOSURE_UPCOMING: "planning",
  PLANNING_DEMAND_SPIKE_EXPECTED: "planning",
  PLANNING_AI_EVENT_DISCOVERED: "planning",

  // Live service — happening now, so the day's plan is the answer.
  LIVE_DEMAND_SPIKE: "today",

  // Stock — the item is on the inventory page.
  STOCKOUT_ALERT: "inventory",
  STOCKOUT_WARNING: "inventory",
  "risk.stockout": "inventory",

  // Money and variance.
  //
  // MARGIN_RISK_ALERT, PURCHASE_ANOMALY_DETECTED, PRODUCTION_VARIANCE_ALERT
  // and EXECUTIVE_SUMMARY_DIGEST used to live here too — routes for the
  // backend's "Decision Queue" alert flows, which had zero callers and were
  // removed (see notifications/smart_notifications.py). No code path can
  // produce those codes anymore; re-add if that alerting is rebuilt.
  TAX_PACKAGE_OPPORTUNITY: "financial",

  // Everything else with an obvious home.
  HUB_TEAM_PING: "chat",
  SUBSCRIPTION_ACTIVATION_REQUESTED: "billing",
  WELCOME: "today",
  PREP_TARGETS_READY: "today",
  KITCHEN_READINESS_SCORE: "today",
  SALES_DATA_MISSING: "settings",
  POS_MAPPING_NEEDED: "settings",
  OWNERSHIP_TRANSFERRED: "settings",
  INVITE_ACCEPTED: "settings",

  // ACCOUNT_SUSPENDED and ORG_CLOSED have no better home than the feed
  // itself — nothing in the app answers "your account is suspended" or
  // "this org no longer exists" — so they're deliberately left unmapped.
};

/** Codes whose page carries a `?tab=` the alert is specifically about. */
const TAB_BY_CODE: Record<string, string> = {
  CONNECTOR_OFFLINE: "integrations",
  CONNECTOR_SYNC_FAILURE: "integrations",
  CONNECTOR_SCHEMA_CHANGED: "integrations",
  POS_IMPORTED: "integrations",
  SALES_DATA_MISSING: "integrations",
  POS_MAPPING_NEEDED: "integrations",
  OWNERSHIP_TRANSFERRED: "organization",
  INVITE_ACCEPTED: "users-roles",
  STOCKOUT_ALERT: "stock",
  STOCKOUT_WARNING: "stock",
  "risk.stockout": "stock",
};

/**
 * How each page names its branch parameter. Pages disagree (`branch` vs
 * `branch_id`), and sending the wrong one silently drops the branch — which is
 * worse than sending none, because the page then answers about the wrong site.
 */
const BRANCH_PARAM_BY_PAGE: Partial<Record<NavPageId, string>> = {
  today: "branch_id",
  tasks: "branch",
  inventory: "branch",
};

function metadataString(
  notification: Notification,
  key: string,
): string | undefined {
  const value = notification.metadata?.[key];
  return typeof value === "string" && value ? value : undefined;
}

export interface NotificationDestination {
  href: string;
  /** i18n key for the destination page's name, for "Open <page>" affordances. */
  labelKey: string;
}

/**
 * Where a notification should open, or `null` when it has no better home than
 * the feed it is already in (or the user cannot see the page it wants).
 *
 * `permissions` comes from `resolvePermissions(user)`; routing someone to a
 * page their role hides would bounce them, so we leave those alerts inert
 * rather than promising a destination that rejects them.
 */
export function notificationDestination(
  notification: Notification,
  permissions: Set<string>,
): NotificationDestination | null {
  const code = notification.code;
  const pageId = code ? PAGE_BY_CODE[code] : undefined;
  if (!pageId) return null;

  const page = getNavPage(pageId);
  if (!page || !canSeeNavPage(page, permissions)) return null;

  const params = new URLSearchParams();

  const tab = code ? TAB_BY_CODE[code] : undefined;
  if (tab) params.set("tab", tab);

  const branchParam = BRANCH_PARAM_BY_PAGE[pageId];
  const branchId = notification.branch ?? metadataString(notification, "branch_id");
  if (branchParam && branchId) params.set(branchParam, branchId);

  // Today reads the date it should open on; an alert about yesterday's service
  // is useless pointed at today.
  if (pageId === "today") {
    const targetDate = metadataString(notification, "target_date");
    if (targetDate) params.set("date", targetDate);
  }

  // A team ping is about one conversation, not the whole hub.
  if (pageId === "chat" && notification.related_model === "HubConversation") {
    if (notification.related_id) params.set("conversation", notification.related_id);
  }

  const query = params.toString();
  return {
    href: query ? `${page.href}?${query}` : page.href,
    labelKey: page.labelKey,
  };
}
