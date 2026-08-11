import type { ComponentType } from "react";
import {
  Bell,
  Brain,
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
  | "intelligence-journey"
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

// "operations" used to be one 8-item bucket covering everything from the
// daily prep plan to staff rosters to inventory — busy enough that new items
// kept landing in it by default. Split by how the page is actually used:
// `execution` is "working the floor right now", `planningResources` is
// "setting up for a day that hasn't happened yet". `overview` is unlabeled
// visual weight for the two pages that double as someone's landing page
// (see `homeHref` in the sidebar).
export type NavSectionKey =
  | "overview"
  | "execution"
  | "planningResources"
  | "analytics"
  | "management";

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
  /**
   * One-line "what is this" shown as a hover tooltip in the sidebar. Optional
   * on purpose — only worth writing for pages whose purpose or name isn't
   * self-evident; skip it rather than pad every entry with filler.
   */
  descriptionKey?: string;
  /** Lowercase search terms for palette filtering (labels match too). */
  keywords: string[];
}

export const NAV_SECTION_TITLES: { key: NavSectionKey; titleKey: string }[] = [
  { key: "overview", titleKey: "sidebar.section.overview" },
  { key: "execution", titleKey: "sidebar.section.execution" },
  { key: "planningResources", titleKey: "sidebar.section.planningResources" },
  { key: "analytics", titleKey: "sidebar.section.analytics" },
  { key: "management", titleKey: "sidebar.section.management" },
];

export const NAV_PAGES: NavPage[] = [
  // ── Overview — the two pages that function as someone's landing page ────
  {
    id: "dashboard",
    href: "/workspace/dashboard",
    labelKey: "sidebar.dashboard",
    icon: Home,
    // The page redirects anyone without one of these to Today, so showing the
    // link to them was an invitation to a bounce.
    anyPermission: DASHBOARD_ACCESS_PERMISSIONS,
    sectionKey: "overview",
    descriptionKey: "sidebar.description.dashboard",
    keywords: ["home", "overview", "main", "control tower"],
  },
  {
    id: "today",
    href: "/workspace/today",
    labelKey: "sidebar.today",
    icon: Clock,
    permission: PERMISSIONS.VIEW_FORECASTS,
    sectionKey: "overview",
    descriptionKey: "sidebar.description.today",
    keywords: ["today's plan", "day plan", "prep plan", "forecast"],
  },

  // ── Daily execution — working the floor right now ───────────────────────
  {
    id: "tasks",
    href: "/workspace/tasks",
    labelKey: "sidebar.tasks",
    icon: TaskList,
    permission: PERMISSIONS.VIEW_TASK_BOARD,
    sectionKey: "execution",
    descriptionKey: "sidebar.description.tasks",
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
    sectionKey: "execution",
    descriptionKey: "sidebar.description.production",
    keywords: ["production batches", "batches", "kitchen production"],
  },
  {
    id: "chat",
    href: "/workspace/chat",
    labelKey: "sidebar.chat",
    icon: ChatBubble,
    permission: PERMISSIONS.ACCESS_GLOBAL_CHAT,
    sectionKey: "execution",
    descriptionKey: "sidebar.description.chat",
    keywords: ["operations hub", "hub", "messages", "team chat"],
  },

  // ── Planning & resources — setting up for a day that hasn't happened yet ─
  {
    id: "planning",
    href: "/workspace/planning",
    labelKey: "sidebar.planning",
    icon: Calendar,
    permission: PERMISSIONS.VIEW_CALENDAR,
    // "schedule" now belongs to the Schedule page below; leaving it here would
    // make the deterministic router send "open the schedule" to the calendar.
    keywords: ["calendar", "planner", "events"],
    sectionKey: "planningResources",
    descriptionKey: "sidebar.description.planning",
  },
  {
    id: "schedule",
    href: "/workspace/schedule",
    labelKey: "sidebar.schedule",
    icon: Community,
    permission: PERMISSIONS.VIEW_TEAM_SCHEDULE,
    sectionKey: "planningResources",
    descriptionKey: "sidebar.description.schedule",
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
    id: "inventory",
    href: "/workspace/inventory",
    labelKey: "sidebar.inventory",
    icon: Package,
    permission: PERMISSIONS.VIEW_INVENTORY,
    sectionKey: "planningResources",
    descriptionKey: "sidebar.description.inventory",
    keywords: ["stock", "items", "recipes", "menu items"],
  },

  // ── Analytics — what happened, why, and what it means ───────────────────
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
    descriptionKey: "sidebar.description.analysis",
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
    id: "intelligence-journey",
    href: "/workspace/intelligence",
    labelKey: "sidebar.intelligence",
    icon: Brain,
    // Deliberately not gated on analytics: the journey is the branch's own
    // learning status, and the people who most need to read it (and to teach
    // PrepIQ what the kitchen sells) are the ones running the prep plan.
    anyPermission: [
      PERMISSIONS.VIEW_FORECASTS,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_INVENTORY,
    ],
    sectionKey: "analytics",
    descriptionKey: "sidebar.description.intelligenceJourney",
    // "intelligence" stays here but is absent from the backend registry: the
    // palette lists every match, so sharing the word with `analysis` is
    // helpful, whereas the assistant's router resolves to one page and would
    // have to steal the alias outright.
    keywords: [
      "intelligence",
      "journey",
      "learning",
      "what has prepiq learned",
      "kitchen dna",
      "confidence",
      "cold start",
      "teach prepiq",
      "expected sales",
      "how much do we sell",
    ],
  },
  {
    id: "sales-waste",
    href: "/workspace/sales-waste",
    labelKey: "sidebar.salesWaste",
    icon: StatsReport,
    permission: PERMISSIONS.VIEW_PRODUCTION_REPORTS,
    sectionKey: "analytics",
    descriptionKey: "sidebar.description.salesWaste",
    keywords: ["sales", "waste", "sales report", "waste report"],
  },
  {
    id: "financial",
    href: "/workspace/financial",
    labelKey: "sidebar.financial",
    icon: Coins,
    permission: PERMISSIONS.VIEW_FINANCIAL_DATA,
    sectionKey: "analytics",
    descriptionKey: "sidebar.description.financial",
    keywords: ["finance", "financials", "money", "revenue"],
  },
  {
    id: "staff-performance",
    href: "/workspace/staff-performance",
    labelKey: "sidebar.staff",
    icon: Group,
    permission: PERMISSIONS.MANAGE_TEAM,
    sectionKey: "analytics",
    descriptionKey: "sidebar.description.staffPerformance",
    keywords: ["staff performance", "team performance", "team", "employees"],
  },
  {
    id: "history",
    href: "/workspace/history",
    labelKey: "sidebar.history",
    icon: ClockRotateRight,
    permission: PERMISSIONS.VIEW_PRODUCTION_REPORTS,
    // Lives with the rest of Analytics now — it's a lookback, not a same-day
    // execution tool, so it never belonged next to Tasks and Production.
    sectionKey: "analytics",
    descriptionKey: "sidebar.description.history",
    keywords: ["past days", "operations history", "day history"],
  },

  // ── Management — org- and branch-level configuration ────────────────────
  {
    id: "branches",
    href: "/workspace/branches",
    labelKey: "sidebar.branches",
    icon: Shop,
    permission: PERMISSIONS.MANAGE_BRANCHES,
    sectionKey: "management",
    descriptionKey: "sidebar.description.branches",
    keywords: ["locations", "stores", "sites", "branch list"],
  },
  {
    id: "purchasing",
    href: "/workspace/purchasing",
    labelKey: "sidebar.purchasing",
    icon: Cart,
    permission: PERMISSIONS.MANAGE_INVENTORY,
    sectionKey: "management",
    descriptionKey: "sidebar.description.purchasing",
    keywords: ["procurement", "purchase orders", "buying", "suppliers"],
  },
  {
    id: "risk",
    href: "/workspace/risk",
    labelKey: "sidebar.risk",
    icon: ShieldAlert,
    permission: PERMISSIONS.VIEW_COMPLIANCE,
    sectionKey: "management",
    descriptionKey: "sidebar.description.risk",
    keywords: ["risks", "alerts", "risk center", "compliance"],
  },
  {
    id: "billing",
    href: "/workspace/billing",
    labelKey: "sidebar.billing",
    icon: CreditCard,
    permission: PERMISSIONS.MANAGE_BILLING,
    sectionKey: "management",
    descriptionKey: "sidebar.description.billing",
    keywords: ["billing settings", "subscription", "plan", "payment", "invoices", "upgrade"],
  },
  {
    id: "settings",
    href: "/workspace/settings",
    labelKey: "sidebar.settings",
    icon: Settings,
    // Was its own single-item "Workspace" section; org/workspace configuration
    // reads more naturally next to Branches, Purchasing, Risk, and Billing
    // than alone under its own heading.
    sectionKey: "management",
    descriptionKey: "sidebar.description.settings",
    keywords: ["workspace settings", "preferences", "configuration", "security"],
  },

  // ── Palette / deep-link only — already one click away via the top bar ───
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
