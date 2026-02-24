"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  WarningTriangle,
  ChatBubble,
  Shop,
} from "iconoir-react";
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
          {
            label: "Overview",
            href: "/",
            icon: <Home className="h-4 w-4" />,
          },
          {
            label: "Command",
            href: "/workspace/finance-command",
            icon: <WarningTriangle className="h-4 w-4" />,
          },
          {
            label: "Sales Overview",
            href: "/workspace/sales-overview",
            icon: <Folder className="h-4 w-4" />,
          },
          {
            label: "Margin Protection",
            href: "/workspace/margin-protection",
            icon: <WarningTriangle className="h-4 w-4" />,
          },
          {
            label: "Waste Cost",
            href: "/workspace/waste-cost-report",
            icon: <Folder className="h-4 w-4" />,
          },
          {
            label: "Tax",
            href: "/workspace/tax-engine",
            icon: <Settings className="h-4 w-4" />,
          },
          {
            label: "Purchasing",
            href: "/workspace/purchase-variance",
            icon: <Brain className="h-4 w-4" />,
          },
          {
            label: "Branch Summary",
            href: "/workspace/branch-financial-summary",
            icon: <Shop className="h-4 w-4" />,
          },
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
          {
            label: "Production",
            href: "/workspace/production-intelligence",
            icon: <Brain className="h-4 w-4" />,
          },
          {
            label: "Purchasing",
            href: "/workspace/purchase-intelligence",
            icon: <Folder className="h-4 w-4" />,
          },
          { label: "Staff", href: "/workspace/staff-performance", icon: <User className="h-4 w-4" /> },
          { label: "Risk", href: "/workspace/risk-compliance", icon: <WarningTriangle className="h-4 w-4" /> },
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
          {
            label: "Branches",
            href: "/workspace/branches",
            icon: <Shop className="h-4 w-4" />,
          },
          {
            label: "Financial",
            href: "/workspace/margin-protection",
            icon: <WarningTriangle className="h-4 w-4" />,
          },
          {
            label: "Purchasing",
            href: "/workspace/purchase-intelligence",
            icon: <Folder className="h-4 w-4" />,
          },
          {
            label: "Staff",
            href: "/workspace/staff-intelligence",
            icon: <User className="h-4 w-4" />,
          },
          {
            label: "Risk",
            href: "/workspace/risk-compliance",
            icon: <WarningTriangle className="h-4 w-4" />,
          },
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

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`group relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[13px] font-medium transition-colors duration-150 ${
        active
          ? "text-[#F5F5F7]"
          : "text-[#C7C7CC] hover:text-[#F5F5F7]"
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
      <span className="truncate tracking-[-0.01em]">{item.label}</span>
    </Link>
  );
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;
  const navSections = getNavSectionsByRole(user?.organization_role);

  return (
    <aside className="fixed left-0 top-0 z-20 h-screen w-64 border-r border-[#2E2E33] bg-[#141416] flex flex-col">
      {/* Header */}
      <div className="px-4 py-5 border-b border-[#2E2E33]">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5 min-w-0">
            <span className="h-9 w-9 rounded-[10px] bg-[#232327] inline-flex items-center justify-center">
              <Image
                src="/logo/golden-main-transparent.png"
                alt="PrepIQ"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
                priority
              />
            </span>
            <span className="font-display text-[19px] leading-6 tracking-[-0.015em] text-[#F5F5F7]">
              PrepIQ
            </span>
          </Link>
          <button
            aria-label="Collapse sidebar"
            className="h-8 w-8 rounded-[8px] border border-[#2E2E33] bg-[#232327] inline-flex items-center justify-center text-[#8E8E93] hover:text-[#F5F5F7] hover:bg-[#2A2A2E] transition-colors duration-150"
          >
            <NavArrowLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 px-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#8E8E93]">
            Kitchen Intelligence Workspace
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {navSections.map((section, index) => (
          <div
            key={section.title}
            className={index === 0 ? "" : "mt-6 pt-3 border-t border-[#2A2A2E]/70"}
          >
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8E8E93] mb-3">
              {section.title}
            </p>
            <nav className="space-y-1.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return <SidebarLink key={item.href} item={item} active={active} />;
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[#2E2E33] p-3 space-y-3">
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-3">
            {user?.profile_picture ? (
              <Image
                src={user.profile_picture}
                alt={`${user.first_name} ${user.last_name}`}
                width={36}
                height={36}
                className="h-10 w-10 rounded-[9px] object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-[9px] bg-[#232327] inline-flex items-center justify-center text-[#A8821F] text-[12px] font-semibold">
                {getUserInitials(user)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium tracking-[-0.01em] text-[#F5F5F7]">
                {user ? `${user.first_name} ${user.last_name}` : "User"}
              </p>
              <p className="truncate text-[11px] text-[#8E8E93]">
                {user?.organization_role || "Workspace member"}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <Link
              href="/workspace/settings"
              className="h-8 rounded-[8px] inline-flex items-center justify-center gap-1.5 text-[11px] text-[#C7C7CC] hover:text-[#F5F5F7] hover:bg-[#232327] transition-colors duration-150"
            >
              <UserBadgeCheck className="h-3.5 w-3.5" />
              Profile
            </Link>
            <button
              className="h-8 rounded-[8px] inline-flex items-center justify-center gap-1.5 text-[11px] text-[#C7C7CC] hover:text-[#F5F5F7] hover:bg-[#232327] transition-colors duration-150"
              type="button"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>

        <Link
          href="/workspace/support"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[12px] font-medium text-[#C7C7CC] hover:text-[#F5F5F7] hover:bg-[#232327] transition-colors duration-150"
        >
          <span className="h-6 w-6 rounded-[7px] bg-[#232327] inline-flex items-center justify-center text-[#8E8E93]">
            <HelpCircle className="h-4 w-4 flex-shrink-0" />
          </span>
          <span className="truncate">Support</span>
        </Link>
      </div>
    </aside>
  );
}
