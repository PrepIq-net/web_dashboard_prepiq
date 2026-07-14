import type { ComponentType } from "react";
import {
  Bell,
  Calendar,
  Cart,
  ChatBubble,
  Clock,
  ClockRotateRight,
  Coins,
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
  StatsReport,
} from "iconoir-react";
import { PERMISSIONS } from "@/services/organizations/types";

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
  | "production"
  | "inventory"
  | "history"
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
    sectionKey: "operations",
    keywords: ["calendar", "planner", "schedule"],
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

export function visibleNavPages(permissions: Set<string>): NavPage[] {
  return NAV_PAGES.filter((page) => !page.permission || permissions.has(page.permission));
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
