"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition, memo } from "react";
import {
  Home,
  Settings,
  Clock,
  User,
  HelpCircle,
  NavArrowLeft,
  LogOut,
  Brain,
  ChatBubble,
  Shop,
  GraphUp,
  Cart,
  Coins,
  Archive,
  ShieldAlert,
  CreditCard,
  ClockRotateRight,
  Package,
  StatsReport,
} from "iconoir-react";
import { useSessionLogoutUser } from "@/services";
import { useSidebarState } from "@/components/dashboard/sidebar-state";
import { LanguageSwitcher } from "./language-switcher";
import { useTranslation } from "@/lib/i18n";
import type { UserProfile } from "@/services/users/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  tone?:
    | "operations"
    | "financial"
    | "governance"
    | "workspace"
    | "branch"
    | "production";
  items: NavItem[];
}

function getNavSectionsByRole(role?: string | null): NavSection[] {
  if (role === "AUDITOR" || role === "ACCOUNTANT") {
    return [
      {
        title: "Financial",
        tone: "financial",
        items: [
          { label: "Overview",   href: "/",                    icon: <Home className="h-4 w-4" /> },
          { label: "Command",    href: "/workspace/command",   icon: <Brain className="h-4 w-4" /> },
          { label: "Purchasing", href: "/workspace/purchasing",icon: <Cart className="h-4 w-4" /> },
          { label: "Billing",    href: "/workspace/billing",   icon: <CreditCard className="h-4 w-4" /> },
          { label: "Chat",       href: "/workspace/chat",      icon: <ChatBubble className="h-4 w-4" /> },
        ],
      },
    ];
  }

  if (role === "STAFF_OPERATOR") {
    return [
      {
        title: "Production",
        tone: "production",
        items: [
          { label: "Today",      href: "/workspace/today",      icon: <Home className="h-4 w-4" /> },
          { label: "Production", href: "/workspace/production", icon: <Brain className="h-4 w-4" /> },
          { label: "Inventory",  href: "/workspace/inventory",  icon: <Package className="h-4 w-4" /> },
          { label: "History",    href: "/workspace/history",    icon: <ClockRotateRight className="h-4 w-4" /> },
          { label: "Chat",       href: "/workspace/chat",       icon: <ChatBubble className="h-4 w-4" /> },
        ],
      },
    ];
  }

  if (role === "BRANCH_MANAGER" || role === "GM") {
    return [
      {
        title: "Branch",
        tone: "branch",
        items: [
          { label: "Today",        href: "/workspace/today",            icon: <Home className="h-4 w-4" /> },
          { label: "Production",   href: "/workspace/production",       icon: <Brain className="h-4 w-4" /> },
          { label: "Inventory",    href: "/workspace/inventory",        icon: <Package className="h-4 w-4" /> },
          { label: "History",      href: "/workspace/history",          icon: <ClockRotateRight className="h-4 w-4" /> },
          { label: "Purchasing",   href: "/workspace/purchasing",       icon: <Cart className="h-4 w-4" /> },
          { label: "Sales & Waste",href: "/workspace/sales-waste",      icon: <StatsReport className="h-4 w-4" /> },
          { label: "Financial",    href: "/workspace/financial",        icon: <Coins className="h-4 w-4" /> },
          { label: "Risk",         href: "/workspace/risk",             icon: <ShieldAlert className="h-4 w-4" /> },
          { label: "Staff",        href: "/workspace/staff-performance",icon: <User className="h-4 w-4" /> },
          { label: "Chat",         href: "/workspace/chat",             icon: <ChatBubble className="h-4 w-4" /> },
        ],
      },
    ];
  }

  if (role === "OPS_DIRECTOR") {
    return [
      {
        title: "Operations",
        tone: "operations",
        items: [
          { label: "Overview",     href: "/",                           icon: <Home className="h-4 w-4" /> },
          { label: "Command",      href: "/workspace/command",          icon: <Brain className="h-4 w-4" /> },
          { label: "Branches",     href: "/workspace/branches",         icon: <Shop className="h-4 w-4" /> },
          { label: "Production",   href: "/workspace/production",       icon: <GraphUp className="h-4 w-4" /> },
          { label: "Inventory",    href: "/workspace/inventory",        icon: <Package className="h-4 w-4" /> },
          { label: "History",      href: "/workspace/history",          icon: <ClockRotateRight className="h-4 w-4" /> },
          { label: "Sales & Waste",href: "/workspace/sales-waste",      icon: <StatsReport className="h-4 w-4" /> },
          { label: "Purchasing",   href: "/workspace/purchasing",       icon: <Cart className="h-4 w-4" /> },
          { label: "Financial",    href: "/workspace/financial",        icon: <Coins className="h-4 w-4" /> },
          { label: "Staff",        href: "/workspace/staff-performance",icon: <User className="h-4 w-4" /> },
          { label: "Risk",         href: "/workspace/risk",             icon: <ShieldAlert className="h-4 w-4" /> },
          { label: "Billing",      href: "/workspace/billing",          icon: <CreditCard className="h-4 w-4" /> },
          { label: "Chat",         href: "/workspace/chat",             icon: <ChatBubble className="h-4 w-4" /> },
        ],
      },
    ];
  }

  if (role === "ORG_OWNER") {
    return [
      {
        title: "Operations",
        tone: "operations",
        items: [
          { label: "Overview",     href: "/",                     icon: <Home className="h-4 w-4" /> },
          { label: "Command",      href: "/workspace/command",    icon: <Brain className="h-4 w-4" /> },
          { label: "Branches",     href: "/workspace/branches",   icon: <Shop className="h-4 w-4" /> },
          { label: "Production",   href: "/workspace/production", icon: <GraphUp className="h-4 w-4" /> },
          { label: "Inventory",    href: "/workspace/inventory",  icon: <Package className="h-4 w-4" /> },
          { label: "History",      href: "/workspace/history",    icon: <ClockRotateRight className="h-4 w-4" /> },
          { label: "Sales & Waste",href: "/workspace/sales-waste",icon: <StatsReport className="h-4 w-4" /> },
        ],
      },
      {
        title: "Financial",
        tone: "financial",
        items: [
          { label: "Financial",  href: "/workspace/financial",        icon: <Coins className="h-4 w-4" /> },
          { label: "Purchasing", href: "/workspace/purchasing",       icon: <Cart className="h-4 w-4" /> },
          { label: "Staff",      href: "/workspace/staff-performance",icon: <User className="h-4 w-4" /> },
        ],
      },
      {
        title: "Governance",
        tone: "governance",
        items: [
          { label: "Risk",     href: "/workspace/risk",     icon: <ShieldAlert className="h-4 w-4" /> },
          { label: "Billing",  href: "/workspace/billing",  icon: <CreditCard className="h-4 w-4" /> },
          { label: "Chat",     href: "/workspace/chat",     icon: <ChatBubble className="h-4 w-4" /> },
          { label: "Settings", href: "/workspace/settings", icon: <Settings className="h-4 w-4" /> },
        ],
      },
    ];
  }

  if (role === "ORG_ADMIN") {
    return [
      {
        title: "Operations",
        tone: "operations",
        items: [
          { label: "Overview",     href: "/",                     icon: <Home className="h-4 w-4" /> },
          { label: "Command",      href: "/workspace/command",    icon: <Brain className="h-4 w-4" /> },
          { label: "Branches",     href: "/workspace/branches",   icon: <Shop className="h-4 w-4" /> },
          { label: "Production",   href: "/workspace/production", icon: <GraphUp className="h-4 w-4" /> },
          { label: "Inventory",    href: "/workspace/inventory",  icon: <Package className="h-4 w-4" /> },
          { label: "Sales & Waste",href: "/workspace/sales-waste",icon: <StatsReport className="h-4 w-4" /> },
          { label: "Purchasing",   href: "/workspace/purchasing", icon: <Cart className="h-4 w-4" /> },
          { label: "Financial",    href: "/workspace/financial",  icon: <Coins className="h-4 w-4" /> },
          { label: "Staff",        href: "/workspace/staff-performance",icon: <User className="h-4 w-4" /> },
        ],
      },
      {
        title: "Governance",
        tone: "governance",
        items: [
          { label: "Risk",     href: "/workspace/risk",     icon: <ShieldAlert className="h-4 w-4" /> },
          { label: "Billing",  href: "/workspace/billing",  icon: <CreditCard className="h-4 w-4" /> },
          { label: "Chat",     href: "/workspace/chat",     icon: <ChatBubble className="h-4 w-4" /> },
          { label: "Settings", href: "/workspace/settings", icon: <Settings className="h-4 w-4" /> },
        ],
      },
    ];
  }

  return [
    {
      title: "Workspace",
      tone: "workspace",
      items: [
        { label: "Overview",     href: "/",                     icon: <Home className="h-4 w-4" /> },
        { label: "Today",        href: "/workspace/today",      icon: <Clock className="h-4 w-4" /> },
        { label: "Production",   href: "/workspace/production", icon: <Brain className="h-4 w-4" /> },
        { label: "Sales & Waste",href: "/workspace/sales-waste",icon: <StatsReport className="h-4 w-4" /> },
        { label: "Inventory",    href: "/workspace/inventory",  icon: <Package className="h-4 w-4" /> },
        { label: "Staff",        href: "/workspace/staff-performance",icon: <User className="h-4 w-4" /> },
        { label: "Chat",         href: "/workspace/chat",       icon: <ChatBubble className="h-4 w-4" /> },
      ],
    },
  ];
}

type DashboardSidebarProps = {
  user?: UserProfile | null;
};

function SidebarLink({
  item,
  active,
  collapsed,
  sectionTone,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  sectionTone?: NavSection["tone"];
}) {
  const commandItem = item.label === "Command";
  const toneBaseClass =
    sectionTone === "financial"
      ? "bg-[#1C1C1F] group-hover:bg-[#232327]"
      : sectionTone === "operations" || sectionTone === "production"
        ? "bg-[#1C1C1F] group-hover:bg-[#232327]"
        : sectionTone === "governance"
          ? "bg-[#1C1C1F] group-hover:bg-[#232327]"
          : sectionTone === "branch" || sectionTone === "workspace"
            ? "bg-[#1C1C1F] group-hover:bg-[#232327]"
            : "bg-transparent group-hover:bg-[#232327]";

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`group relative w-full flex items-center ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      } py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? "text-text-primary bg-[#1C1C1F] shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
          : commandItem
            ? "text-[#CFA23A] hover:text-[#F3C865] hover:bg-[#1C1C1F]/50"
            : "text-text-secondary hover:text-text-primary hover:bg-[#1C1C1F]/50"
      }`}
      prefetch={false}
      scroll={false}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand-gold" />
      )}
      <span
        className={`h-8 w-8 rounded-lg inline-flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
          active
            ? commandItem
              ? "text-brand-gold bg-[#232327] shadow-[0_0_16px_rgba(168,130,31,0.25)]"
              : "text-brand-gold bg-[#232327]"
            : commandItem
              ? "text-[#CFA23A] bg-[#1C1C1F] shadow-[0_0_10px_rgba(168,130,31,0.12)]"
              : `text-text-muted ${toneBaseClass} group-hover:text-text-secondary`
        }`}
      >
        {item.icon}
      </span>
      {!collapsed && (
        <span className="truncate tracking-[-0.01em]">{item.label}</span>
      )}
    </Link>
  );
}

const MemoizedSidebarLink = memo(SidebarLink);

export const DashboardSidebar = memo(function DashboardSidebarInner({
  user,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const logoutMutation = useSessionLogoutUser();
  const { collapsed, toggle } = useSidebarState();

  const normalizedPath =
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;
  const isStaffExecutionRole = user?.organization_role === "STAFF_OPERATOR";

  const isActive = (href: string) => {
    const normalizedHref =
      href.endsWith("/") && href !== "/" ? href.slice(0, -1) : href;
    if (normalizedPath === normalizedHref) return true;
    if (
      isStaffExecutionRole &&
      normalizedHref === "/workspace/today" &&
      normalizedPath === "/"
    )
      return true;
    return false;
  };

  const rawNavSections = getNavSectionsByRole(user?.organization_role);

  // Map raw labels to translated versions
  const navSections = rawNavSections.map((section) => ({
    ...section,
    title: t(`dashboard.sidebar.${section.title.toLowerCase()}`),
    items: section.items.map((item) => {
      const key = item.label.toLowerCase().replace(/ & /g, " ").replace(/\s/g, "");
      return {
        ...item,
        label: t(`dashboard.sidebar.${key}`),
      };
    }),
  }));

  const handleLogout = () => {
    startTransition(() => {
      logoutMutation.mutate(undefined, {
        onSuccess: () => {
          window.location.href = "/login";
        },
        onError: () => {
          window.location.href = "/login";
        },
      });
    });
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-20 h-screen border-r border-[#1C1C1F] bg-[#141416] flex flex-col transition-[width] duration-200 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="border-b border-[#1C1C1F] px-5 py-6">
        <div className="relative flex items-center">
          <Link
            href="/"
            className={`inline-flex min-w-0 items-center ${
              collapsed ? "mx-auto justify-center" : "gap-3 pr-10"
            }`}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#232327] to-[#1C1C1F] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              <Image
                src="/logo/golden-main-transparent.png"
                alt="PrepIQ"
                width={26}
                height={26}
                className="h-[26px] w-[26px] object-contain"
                priority
              />
            </span>
            {!collapsed && (
              <span className="font-display text-xl leading-6 tracking-[-0.02em] text-text-primary font-semibold">
                PrepIQ
              </span>
            )}
          </Link>
          <button
            aria-label="Toggle sidebar"
            onClick={toggle}
            className={`absolute right-0 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-[#2A2A2E] bg-[#1C1C1F] text-text-muted transition-all duration-200 hover:bg-[#232327] hover:text-text-primary hover:border-[#3A3A40] active:scale-95 ${
              collapsed ? "shadow-[0_0_0_4px_rgba(20,20,22,0.95)]" : ""
            }`}
          >
            <NavArrowLeft
              className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {!collapsed && (
          <div className="mt-4 px-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
              Kitchen Intelligence Platform
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div
        className={`flex-1 overflow-y-auto py-6 [scrollbar-width:thin] [scrollbar-color:#2A2A2E_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2A2A2E] hover:[&::-webkit-scrollbar-thumb]:bg-[#3A3A40] ${
          collapsed ? "px-2.5" : "px-4"
        }`}
      >
        {navSections.map((section, index) => (
          <div
            key={section.title}
            className={
              index === 0
                ? ""
                : `mt-8 pt-4 ${collapsed ? "" : "border-t border-[#1C1C1F]"}`
            }
          >
            {!collapsed && (
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {section.title}
              </p>
            )}
            <nav className="space-y-1">
              {section.items.map((item) => (
                <MemoizedSidebarLink
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                  sectionTone={section.tone}
                />
              ))}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-[#1C1C1F] p-4 space-y-1">
        {/* User identity */}
        {user && !collapsed && (
          <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-lg bg-[#1C1C1F]">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#232327] border border-[#2A2A2E] flex items-center justify-center text-xs font-semibold text-text-muted">
              {user.first_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate leading-tight">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-[11px] text-text-muted truncate leading-tight mt-0.5">
                {user.email}
              </p>
            </div>
          </div>
        )}
        {user && collapsed && (
          <div className="flex justify-center mb-2">
            <div className="h-8 w-8 rounded-full bg-[#232327] border border-[#2A2A2E] flex items-center justify-center text-xs font-semibold text-text-muted">
              {user.first_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "U"}
            </div>
          </div>
        )}

        <Link
          href="/workspace/support"
          title={collapsed ? t("common.support") : undefined}
          className={`w-full rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:bg-[#1C1C1F] hover:text-text-primary flex items-center ${
            collapsed ? "justify-center" : "gap-3"
          }`}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#1C1C1F] text-text-muted">
            <HelpCircle className="h-4 w-4 flex-shrink-0" />
          </span>
          {!collapsed && <span className="truncate">{t("common.support")}</span>}
        </Link>
        <LanguageSwitcher collapsed={collapsed} />
        <button
          className={`w-full rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:bg-[#1C1C1F] hover:text-text-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${
            collapsed ? "justify-center" : "gap-3"
          }`}
          type="button"
          onClick={handleLogout}
          disabled={logoutMutation.isPending || isPending}
          title={collapsed ? t("common.logout") : undefined}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#1C1C1F] text-text-muted">
            <LogOut className="h-4 w-4 flex-shrink-0" />
          </span>
          {!collapsed && <span className="truncate">{t("common.logout")}</span>}
        </button>
      </div>
    </aside>
  );
});
