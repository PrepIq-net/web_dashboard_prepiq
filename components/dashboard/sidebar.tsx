"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useMemo } from "react";
import { NavArrowLeft } from "iconoir-react";
import { useSidebarState } from "@/components/dashboard/sidebar-state";
import { canAccessDashboard, resolvePermissions } from "@/lib/permissions";
import {
  NAV_PAGES,
  NAV_SECTION_TITLES,
  canSeeNavPage,
} from "@/lib/command/navigation";
import { useTranslation } from "@/lib/i18n";
import type { UserProfile } from "@/services/users/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}


// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      scroll={false}
      className={`group relative flex w-full items-center rounded-lg text-sm font-medium transition-all duration-150
        ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"}
        ${
          active
            ? "bg-[#1C1C1F] text-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
            : "text-text-secondary hover:bg-[#1C1C1F]/60 hover:text-text-primary"
        }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gold" />
      )}
      <span
        className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150
          ${
            active
              ? "bg-[#232327] text-brand-gold"
              : "bg-[#1C1C1F] text-text-muted group-hover:text-text-secondary"
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

// ─────────────────────────────────────────────────────────────────────────────
// Main sidebar
// ─────────────────────────────────────────────────────────────────────────────

export const DashboardSidebar = memo(function DashboardSidebarInner({
  user,
}: {
  user?: UserProfile | null;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarState();

  const permissions = resolvePermissions(user);

  const normalizedPath =
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;

  function isActive(href: string) {
    const norm = href.endsWith("/") && href !== "/" ? href.slice(0, -1) : href;
    return normalizedPath === norm;
  }

  const visibleSections = useMemo(
    (): NavSection[] =>
      NAV_SECTION_TITLES.map((section) => ({
        title: t(section.titleKey),
        items: NAV_PAGES.filter(
          (page) =>
            page.sectionKey === section.key && canSeeNavPage(page, permissions),
        ).map((page) => ({
          label: t(page.labelKey),
          href: page.href,
          icon: <page.icon className="h-4 w-4" />,
          permission: page.permission,
        })),
      })).filter((section) => section.items.length > 0),
    [permissions, t],
  );

  // The logo is a "go home" affordance, so it has to honour the same rule as
  // the nav entry — pointing everyone at /workspace/dashboard sent operational
  // staff to a page that immediately redirects them back out.
  const homeHref = canAccessDashboard(permissions)
    ? "/workspace/dashboard"
    : "/workspace/today";

  // Org logo — use organization_logo if set, else fall back to app logo
  const orgLogo = user?.organization_logo ?? null;

  return (
    <aside
      className={`fixed left-0 top-0 z-20 flex h-screen flex-col border-r border-[#1C1C1F] bg-[#141416] transition-[width] duration-200 ${
        collapsed ? "w-20" : "w-60"
      }`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-[#1C1C1F] px-4 py-5">
        <div className="relative flex items-center">
          <Link
            href={homeHref}
            className={`inline-flex min-w-0 items-center ${
              collapsed ? "mx-auto justify-center" : "gap-3 pr-8"
            }`}
          >
            <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#232327] to-[#1C1C1F] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              {orgLogo ? (
                <Image
                  src={orgLogo}
                  alt={user?.organization_name ?? "Organization"}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-lg object-cover"
                />
              ) : (
                <Image
                  src="/logo/golden-main-transparent.png"
                  alt="PrepIQ"
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] object-contain"
                  priority
                />
              )}
            </span>
            {!collapsed && (
              <span className="truncate font-display text-[15px] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
                {user?.organization_name ?? "PrepIQ"}
              </span>
            )}
          </Link>

          {/* Collapse toggle */}
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggle}
            className={`absolute right-0 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-[#2A2A2E] bg-[#1C1C1F] text-text-muted transition-all duration-150 hover:border-[#3A3A40] hover:bg-[#232327] hover:text-text-primary active:scale-95`}
          >
            <NavArrowLeft
              className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Role pill */}
        {!collapsed && user?.organization_role && (
          <div className="mt-3 px-1">
            <span className="inline-block rounded-md bg-brand-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {user.organization_role}
            </span>
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <div
        className={`flex-1 overflow-y-auto py-4
          [scrollbar-width:thin] [scrollbar-color:#2A2A2E_transparent]
          [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2A2A2E]
          ${collapsed ? "px-2" : "px-3"}`}
      >
        {visibleSections.map((section, index) => (
          <div
            key={section.title}
            className={index === 0 ? "mb-4" : "mb-4 border-t border-[#1C1C1F] pt-4"}
          >
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-text-muted/70">
                {section.title}
              </p>
            )}
            <nav className="space-y-0.5">
              {section.items.map((item) => (
                <MemoizedSidebarLink
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                />
              ))}
            </nav>
          </div>
        ))}
      </div>

      {/* ── User identity footer ────────────────────────────────────────── */}
      {user && (
        <div className="border-t border-[#1C1C1F] p-3">
          {collapsed ? (
            <Link
              href="/workspace/profile"
              title="My Profile"
              className="flex justify-center hover:opacity-80 transition-opacity"
            >
              <div className="h-8 w-8 rounded-full bg-[#232327] border border-[#2A2A2E] flex items-center justify-center text-[11px] font-semibold text-text-muted select-none">
                {user.first_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}
              </div>
            </Link>
          ) : (
            <Link
              href="/workspace/profile"
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#1C1C1F]/60 transition-colors group"
            >
              <div className="h-7 w-7 flex-shrink-0 rounded-full bg-[#232327] border border-[#2A2A2E] flex items-center justify-center text-[11px] font-semibold text-text-muted select-none">
                {user.first_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium leading-tight text-text-primary group-hover:text-brand-gold transition-colors">
                  {user.first_name} {user.last_name}
                </p>
                <p className="truncate text-[10px] leading-tight text-text-muted mt-0.5">
                  {user.email}
                </p>
              </div>
            </Link>
          )}
        </div>
      )}
    </aside>
  );
});
