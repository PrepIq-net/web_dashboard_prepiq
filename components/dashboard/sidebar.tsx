"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Settings,
  Clock,
  User,
  Folder,
  HelpCircle,
  NavArrowLeft,
  LogOut,
  UserBadgeCheck,
  Brain,
  ChatBubble,
  Shop,
} from "iconoir-react";
import { useSessionLogoutUser } from "@/services";
import { useSidebarState } from "@/components/dashboard/sidebar-state";
import type { UserProfile } from "@/services/users/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function getNavSectionsByRole(role?: string | null): NavSection[] {
  if (role === "AUDITOR" || role === "ACCOUNTANT") {
    return [
      {
        title: "Financial",
        items: [
          { label: "Overview", href: "/", icon: <Home className="h-4 w-4" /> },
          { label: "Command", href: "/workspace/finance-command", icon: <Brain className="h-4 w-4" /> },
          { label: "Sales Overview", href: "/workspace/sales-overview", icon: <Folder className="h-4 w-4" /> },
          { label: "Margin Protection", href: "/workspace/margin-protection", icon: <Folder className="h-4 w-4" /> },
          { label: "Waste Cost", href: "/workspace/waste-cost-report", icon: <Folder className="h-4 w-4" /> },
          { label: "Tax", href: "/workspace/tax-engine", icon: <Settings className="h-4 w-4" /> },
          { label: "Purchasing", href: "/workspace/purchase-variance", icon: <Brain className="h-4 w-4" /> },
          { label: "Branch Summary", href: "/workspace/branch-financial-summary", icon: <Shop className="h-4 w-4" /> },
          { label: "Exports", href: "/workspace/exports", icon: <Clock className="h-4 w-4" /> },
        ],
      },
    ];
  }

  if (role === "STAFF_OPERATOR") {
    return [
      {
        title: "Production",
        items: [
          { label: "Today", href: "/", icon: <Home className="h-4 w-4" /> },
          { label: "Log Batch", href: "/workspace/log-batch", icon: <Brain className="h-4 w-4" /> },
          { label: "History", href: "/workspace/history", icon: <Clock className="h-4 w-4" /> },
          { label: "Chat", href: "/workspace/chat", icon: <ChatBubble className="h-4 w-4" /> },
        ],
      },
    ];
  }

  if (role === "BRANCH_MANAGER" || role === "GM") {
    return [
      {
        title: "Branch",
        items: [
          { label: "Today", href: "/", icon: <Home className="h-4 w-4" /> },
          { label: "Production", href: "/workspace/production-plan", icon: <Brain className="h-4 w-4" /> },
          { label: "Sales & Waste", href: "/workspace/sales-waste", icon: <Folder className="h-4 w-4" /> },
          { label: "Inventory", href: "/workspace/inventory", icon: <Clock className="h-4 w-4" /> },
          { label: "Staff", href: "/workspace/staff", icon: <User className="h-4 w-4" /> },
          { label: "Chat", href: "/workspace/chat", icon: <ChatBubble className="h-4 w-4" /> },
        ],
      },
    ];
  }

  if (role === "OPS_DIRECTOR") {
    return [
      {
        title: "Operations",
        items: [
          { label: "Overview", href: "/", icon: <Home className="h-4 w-4" /> },
          { label: "Command", href: "/workspace/command", icon: <Brain className="h-4 w-4" /> },
          { label: "Branches", href: "/workspace/branches", icon: <Shop className="h-4 w-4" /> },
          { label: "Production", href: "/workspace/production-intelligence", icon: <Brain className="h-4 w-4" /> },
          { label: "Purchasing", href: "/workspace/purchase-intelligence", icon: <Folder className="h-4 w-4" /> },
          { label: "Staff", href: "/workspace/staff-performance", icon: <User className="h-4 w-4" /> },
          { label: "Risk", href: "/workspace/risk-compliance", icon: <Settings className="h-4 w-4" /> },
          { label: "Chat", href: "/workspace/chat", icon: <ChatBubble className="h-4 w-4" /> },
        ],
      },
    ];
  }

  if (role === "ORG_OWNER" || role === "ORG_ADMIN") {
    return [
      {
        title: "Executive",
        items: [
          { label: "Overview", href: "/", icon: <Home className="h-4 w-4" /> },
          { label: "Command", href: "/workspace/command", icon: <Brain className="h-4 w-4" /> },
          { label: "Branches", href: "/workspace/branches", icon: <Shop className="h-4 w-4" /> },
          { label: "Financial", href: "/workspace/margin-protection", icon: <Folder className="h-4 w-4" /> },
          { label: "Purchasing", href: "/workspace/purchase-intelligence", icon: <Folder className="h-4 w-4" /> },
          { label: "Staff", href: "/workspace/staff-intelligence", icon: <User className="h-4 w-4" /> },
          { label: "Risk", href: "/workspace/risk-compliance", icon: <Settings className="h-4 w-4" /> },
          { label: "Billing", href: "/workspace/billing", icon: <Folder className="h-4 w-4" /> },
          { label: "Chat", href: "/workspace/chat", icon: <ChatBubble className="h-4 w-4" /> },
          { label: "Settings", href: "/workspace/settings", icon: <Settings className="h-4 w-4" /> },
        ],
      },
    ];
  }

  return [
    {
      title: "Workspace",
      items: [
        { label: "Overview", href: "/", icon: <Home className="h-4 w-4" /> },
        { label: "Today", href: "/workspace/today", icon: <Clock className="h-4 w-4" /> },
        { label: "Production", href: "/workspace/production-plan", icon: <Brain className="h-4 w-4" /> },
        { label: "Sales & Waste", href: "/workspace/sales-waste", icon: <Folder className="h-4 w-4" /> },
        { label: "Inventory", href: "/workspace/inventory", icon: <Clock className="h-4 w-4" /> },
        { label: "Staff", href: "/workspace/staff", icon: <User className="h-4 w-4" /> },
      ],
    },
  ];
}

type DashboardSidebarProps = {
  user?: UserProfile | null;
};

function getUserInitials(user?: UserProfile | null) {
  const first = user?.first_name?.[0] ?? "";
  const last = user?.last_name?.[0] ?? "";
  return `${first}${last}`.toUpperCase() || "U";
}

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
      className={`group relative w-full flex items-center ${
        collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
      } py-2 rounded-[8px] text-[13px] font-medium transition-colors duration-150 ${
        active ? "text-[#F5F5F7]" : "text-[#C7C7CC] hover:text-[#F5F5F7]"
      }`}
    >
      <span
        className={`absolute left-0 top-2.5 h-6 w-[2px] rounded-r ${
          active ? "bg-[#A8821F]" : "bg-transparent"
        }`}
      />
      <span
        className={`h-7 w-7 rounded-[7px] inline-flex items-center justify-center flex-shrink-0 ${
          active
            ? "text-[#A8821F] bg-[#232327]"
            : "text-[#8E8E93] bg-transparent group-hover:text-[#C7C7CC] group-hover:bg-[#232327]"
        }`}
      >
        {item.icon}
      </span>
      {!collapsed ? <span className="truncate tracking-[-0.01em]">{item.label}</span> : null}
    </Link>
  );
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const logoutMutation = useSessionLogoutUser();
  const { collapsed, toggle } = useSidebarState();
  const isActive = (href: string) => pathname === href;
  const navSections = getNavSectionsByRole(user?.organization_role);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => router.replace("/login"),
      onError: () => router.replace("/login"),
    });
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-20 h-screen border-r border-[#2E2E33] bg-[#141416] flex flex-col transition-[width] duration-200 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="border-b border-[#2E2E33] px-4 py-5">
        <div className="flex items-center justify-between">
          <Link href="/" className={`inline-flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#232327]">
              <Image
                src="/logo/golden-main-transparent.png"
                alt="PrepIQ"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
                priority
              />
            </span>
            {!collapsed ? (
              <span className="font-display text-[19px] leading-6 tracking-[-0.015em] text-[#F5F5F7]">
                PrepIQ
              </span>
            ) : null}
          </Link>
          <button
            aria-label="Toggle sidebar"
            onClick={toggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#2E2E33] bg-[#232327] text-[#8E8E93] transition-colors duration-150 hover:bg-[#2A2A2E] hover:text-[#F5F5F7]"
          >
            <NavArrowLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>
        {!collapsed ? (
          <div className="mt-4 px-1">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#8E8E93]">
              Kitchen Intelligence Workspace
            </p>
          </div>
        ) : null}
      </div>

      <div className={`flex-1 overflow-y-auto py-5 ${collapsed ? "px-2" : "px-3"}`}>
        {navSections.map((section, index) => (
          <div
            key={section.title}
            className={index === 0 ? "" : `mt-6 pt-3 ${collapsed ? "" : "border-t border-[#2A2A2E]/70"}`}
          >
            {!collapsed ? (
              <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8E8E93]">
                {section.title}
              </p>
            ) : null}
            <nav className="space-y-1.5">
              {section.items.map((item) => (
                <SidebarLink
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

      <div className="space-y-3 border-t border-[#2E2E33] p-3">
        <div className="px-2 py-1.5">
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            {user?.profile_picture ? (
              <Image
                src={user.profile_picture}
                alt={`${user.first_name} ${user.last_name}`}
                width={36}
                height={36}
                className="h-10 w-10 rounded-[9px] object-cover"
              />
            ) : (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-[9px] bg-[#232327] text-[12px] font-semibold text-[#A8821F]">
                {getUserInitials(user)}
              </div>
            )}
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium tracking-[-0.01em] text-[#F5F5F7]">
                  {user ? `${user.first_name} ${user.last_name}` : "User"}
                </p>
                <p className="truncate text-[11px] text-[#8E8E93]">
                  {user?.organization_role || "Workspace member"}
                </p>
              </div>
            ) : null}
          </div>
          <div className={`mt-3 ${collapsed ? "space-y-1.5" : "grid grid-cols-2 gap-1.5"}`}>
            <Link
              href="/workspace/settings"
              title={collapsed ? "Profile" : undefined}
              className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] text-[11px] text-[#C7C7CC] transition-colors duration-150 hover:bg-[#232327] hover:text-[#F5F5F7] ${
                collapsed ? "w-full" : ""
              }`}
            >
              <UserBadgeCheck className="h-3.5 w-3.5" />
              {!collapsed ? "Profile" : null}
            </Link>
            <button
              className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] text-[11px] text-[#C7C7CC] transition-colors duration-150 hover:bg-[#232327] hover:text-[#F5F5F7] ${
                collapsed ? "w-full" : ""
              }`}
              type="button"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              title={collapsed ? "Sign out" : undefined}
            >
              <LogOut className="h-3.5 w-3.5" />
              {!collapsed ? "Sign out" : null}
            </button>
          </div>
        </div>

        <Link
          href="/workspace/support"
          title={collapsed ? "Support" : undefined}
          className={`w-full rounded-[10px] px-3 py-2.5 text-[12px] font-medium text-[#C7C7CC] transition-colors duration-150 hover:bg-[#232327] hover:text-[#F5F5F7] flex items-center ${
            collapsed ? "justify-center" : "gap-3"
          }`}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#232327] text-[#8E8E93]">
            <HelpCircle className="h-4 w-4 flex-shrink-0" />
          </span>
          {!collapsed ? <span className="truncate">Support</span> : null}
        </Link>
      </div>
    </aside>
  );
}
