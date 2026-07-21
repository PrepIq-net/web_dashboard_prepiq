import type { ComponentType } from "react";
import {
  Bell,
  Calendar,
  Cart,
  ChatBubble,
  Clock,
  ClockRotateRight,
  Coins,
  Community,
  CreditCard,
  GraphUp,
  Group,
  HelpCircle,
  Home,
  Package,
  ProfileCircle,
  Settings,
  ShieldAlert,
  Shop,
  Sparks,
  StatsReport,
  TaskList,
} from "iconoir-react";
import { PERMISSIONS } from "@/services/organizations/types";
import { DASHBOARD_ACCESS_PERMISSIONS } from "@/lib/permissions";

/**
 * Canonical registry of navigable workspace pages.
 *
 * Single client-side source of truth: the sidebar derives its sections from
 * it and the command palette filters it. Mirrored by
 * `backend/ai_assistant/command/pages.py` (LLM enum + server-side matcher) —
 * keep `id` values identical on both sides.
 */

export type NavPageId =
  | "dashboard"
  | "today"
  | "planning"
  | "schedule"
  | "tasks"
  | "production"
  | "inventory"
  | "history"
  | "analysis"
  | "sales-waste"
  | "financial"
  | "staff-performance"
  | "branches"
  | "purchasing"
  | "risk"
  | "billing"
  | "chat"
  | "settings"
  | "notifications"
  | "profile"
  | "support";

export type NavSectionKey = "operations" | "analytics" | "management" | "workspace";

export interface NavPage {
  id: NavPageId;
  href: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  permission?: string;
  /**
   * Page is visible when the user holds ANY of these. For pages whose access
   * rule is a union rather than a single permission (the Dashboard). Combined
   * with `permission` as AND if both are set.
   */
  anyPermission?: string[];
  /** Sidebar section; pages without one are palette/deep-link only. */
  sectionKey?: NavSectionKey;
  /** Lowercase search terms for palette filtering (labels match too). */
  keywords: string[];
}

export const NAV_SECTION_TITLES: { key: NavSectionKey; titleKey: string }[] = [
  { key: "operations", titleKey: "dashboard.sidebar.operations" },
  { key: "analytics", titleKey: "sidebar.section.analytics" },
  { key: "management", titleKey: "sidebar.section.management" },
  { key: "workspace", titleKey: "sidebar.section.workspace" },
];

export const NAV_PAGES: NavPage[] = [
  {
    id: "dashboard",
    href: "/workspace/dashboard",
    labelKey: "sidebar.dashboard",
    icon: Home,
    // The page redirects anyone without one of these to Today, so showing the
    // link to them was an invitation to a bounce.
    anyPermission: DASHBOARD_ACCESS_PERMISSIONS,
    sectionKey: "operations",
    keywords: ["home", "overview", "main", "control tower"],
  },
  {
    id: "today",
    href: "/workspace/today",
    labelKey: "sidebar.today",
    icon: Clock,
    permission: PERMISSIONS.VIEW_FORECASTS,
    sectionKey: "operations",
    keywords: ["today's plan", "day plan", "prep plan", "forecast"],
  },
  {
    id: "planning",
    href: "/workspace/planning",
    labelKey: "sidebar.planning",
    icon: Calendar,
    permission: PERMISSIONS.VIEW_CALENDAR,
    // "schedule" now belongs to the Schedule page below; leaving it here would
    // make the deterministic router send "open the schedule" to the calendar.
    keywords: ["calendar", "planner", "events"],
    sectionKey: "operations",
  },
  {
    id: "schedule",
    href: "/workspace/schedule",
    labelKey: "sidebar.schedule",
    icon: Community,
    permission: PERMISSIONS.VIEW_TEAM_SCHEDULE,
    sectionKey: "operations",
    keywords: [
      "schedule",
      "team schedule",
      "staff schedule",
      "shifts",
      "roster",
      "rota",
      "staffing",
      "availability",
      "coverage",
      "labor",
      "who works",
    ],
  },
  {
    id: "tasks",
    href: "/workspace/tasks",
    labelKey: "sidebar.tasks",
    icon: TaskList,
    permission: PERMISSIONS.VIEW_TASK_BOARD,
    sectionKey: "operations",
    // "prep plan" stays with Today: the plan is quantities, the board is
    // who is doing what. Mirrors backend ai_assistant/command/pages.py.
    keywords: [
      "tasks",
      "task board",
      "board",
      "kanban",
      "kitchen tasks",
      "prep tasks",
      "to do",
      "todo list",
      "what needs doing",
    ],
  },
  {
    id: "production",
    href: "/workspace/production",
    labelKey: "sidebar.production",
    icon: GraphUp,
    permission: PERMISSIONS.CREATE_PRODUCTION_BATCH,
    sectionKey: "operations",
    keywords: ["production batches", "batches", "kitchen production"],
  },
  {
    id: "inventory",
    href: "/workspace/inventory",
    labelKey: "sidebar.inventory",
    icon: Package,
    permission: PERMISSIONS.VIEW_INVENTORY,
    sectionKey: "operations",
    keywords: ["stock", "items", "recipes", "menu items"],
  },
  {
    id: "history",
    href: "/workspace/history",
    labelKey: "sidebar.history",
    icon: ClockRotateRight,
    permission: PERMISSIONS.VIEW_PRODUCTION_REPORTS,
    sectionKey: "operations",
    keywords: ["past days", "operations history", "day history"],
  },
  {
    id: "analysis",
    href: "/workspace/analysis",
    labelKey: "sidebar.analysis",
    icon: Sparks,
    // The union the API itself enforces (insights/views.py::_require_analytics).
    // A single `permission` here would hide the link from someone the endpoint
    // would happily serve.
    anyPermission: [
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_PRODUCTION_REPORTS,
    ],
    sectionKey: "analytics",
    keywords: [
      "analyst",
      "prepiq analyst",
      "analysis",
      "insights",
      "intelligence",
      "opportunities",
      "savings",
      "root cause",
      "why",
      "health score",
      "what should i know",
    ],
  },
  {
    id: "sales-waste",
    href: "/workspace/sales-waste",
    labelKey: "sidebar.salesWaste",
    icon: StatsReport,
    permission: PERMISSIONS.VIEW_PRODUCTION_REPORTS,
    sectionKey: "analytics",
    keywords: ["sales", "waste", "sales report", "waste report"],
  },
  {
    id: "financial",
    href: "/workspace/financial",
    labelKey: "sidebar.financial",
    icon: Coins,
    permission: PERMISSIONS.VIEW_FINANCIAL_DATA,
    sectionKey: "analytics",
    keywords: ["finance", "financials", "money", "revenue"],
  },
  {
    id: "staff-performance",
    href: "/workspace/staff-performance",
    labelKey: "sidebar.staff",
    icon: Group,
    permission: PERMISSIONS.MANAGE_TEAM,
    sectionKey: "analytics",
    keywords: ["staff performance", "team performance", "team", "employees"],
  },
  {
    id: "branches",
    href: "/workspace/branches",
    labelKey: "sidebar.branches",
    icon: Shop,
    permission: PERMISSIONS.MANAGE_BRANCHES,
    sectionKey: "management",
    keywords: ["locations", "stores", "sites", "branch list"],
  },
  {
    id: "purchasing",
    href: "/workspace/purchasing",
    labelKey: "sidebar.purchasing",
    icon: Cart,
    permission: PERMISSIONS.MANAGE_INVENTORY,
    sectionKey: "management",
    keywords: ["procurement", "purchase orders", "buying", "suppliers"],
  },
  {
    id: "risk",
    href: "/workspace/risk",
    labelKey: "sidebar.risk",
    icon: ShieldAlert,
    permission: PERMISSIONS.VIEW_COMPLIANCE,
    sectionKey: "management",
    keywords: ["risks", "alerts", "risk center", "compliance"],
  },
  {
    id: "billing",
    href: "/workspace/billing",
    labelKey: "sidebar.billing",
    icon: CreditCard,
    permission: PERMISSIONS.MANAGE_BILLING,
    sectionKey: "management",
    keywords: ["billing settings", "subscription", "plan", "payment", "invoices", "upgrade"],
  },
  {
    id: "chat",
    href: "/workspace/chat",
    labelKey: "sidebar.chat",
    icon: ChatBubble,
    permission: PERMISSIONS.ACCESS_GLOBAL_CHAT,
    sectionKey: "workspace",
    keywords: ["operations hub", "hub", "messages", "team chat"],
  },
  {
    id: "settings",
    href: "/workspace/settings",
    labelKey: "sidebar.settings",
    icon: Settings,
    sectionKey: "workspace",
    keywords: ["workspace settings", "preferences", "configuration", "security"],
  },
  {
    id: "notifications",
    href: "/workspace/notifications",
    labelKey: "sidebar.notifications",
    icon: Bell,
    keywords: ["alerts inbox", "notification center"],
  },
  {
    id: "profile",
    href: "/workspace/profile",
    labelKey: "sidebar.profile",
    icon: ProfileCircle,
    keywords: ["my profile", "account", "my account"],
  },
  {
    id: "support",
    href: "/workspace/support",
    labelKey: "sidebar.support",
    icon: HelpCircle,
    keywords: ["help", "contact us", "contact support", "feedback"],
  },
];

const PAGES_BY_ID = new Map(NAV_PAGES.map((page) => [page.id, page]));

export function getNavPage(id: string): NavPage | undefined {
  return PAGES_BY_ID.get(id as NavPageId);
}

/** The one visibility rule — sidebar, command palette, and deep links agree. */
export function canSeeNavPage(page: NavPage, permissions: Set<string>): boolean {
  if (page.permission && !permissions.has(page.permission)) return false;
  if (page.anyPermission && !page.anyPermission.some((perm) => permissions.has(perm))) {
    return false;
  }
  return true;
}

export function visibleNavPages(permissions: Set<string>): NavPage[] {
  return NAV_PAGES.filter((page) => canSeeNavPage(page, permissions));
}

/** Case-insensitive palette filter over translated labels + keywords. */
export function filterNavPages(
  query: string,
  permissions: Set<string>,
  t: (key: string) => string,
): NavPage[] {
  const needle = query.trim().toLowerCase();
  const pages = visibleNavPages(permissions);
  if (!needle) return pages.filter((page) => page.sectionKey);
  return pages.filter((page) => {
    const label = t(page.labelKey).toLowerCase();
    return (
      label.includes(needle) ||
      page.id.includes(needle) ||
      page.keywords.some((keyword) => keyword.includes(needle))
    );
  });
}
