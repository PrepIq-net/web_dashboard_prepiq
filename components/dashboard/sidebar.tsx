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
  tone?: "operations" | "financial" | "governance" | "workspace" | "branch" | "production";
  items: NavItem[];
}

function getNavSectionsByRole(role?: string | null): NavSection[] {
  if (role === "AUDITOR" || role === "ACCOUNTANT") {
    return [
      {
        title: "Financial",
        tone: "financial",
        items: [
          { label: "Overview", href: "/", icon: <Home className="h-4 w-4" /> },
          { label: "Command", href: "/workspace/command", icon: <Brain className="h-4 w-4" /> },
          { label: "Financial", href: "/workspace/financial", icon: <Folder className="h-4 w-4" /> },
          { label: "Purchasing", href: "/workspace/purchasing", icon: <Brain className="h-4 w-4" /> },
          { label: "Risk", href: "/workspace/risk", icon: <Settings className="h-4 w-4" /> },
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
          { label: "Today", href: "/", icon: <Home className="h-4 w-4" /> },
          { label: "Production", href: "/workspace/production", icon: <Brain className="h-4 w-4" /> },
          { label: "Inventory", href: "/workspace/inventory", icon: <Clock className="h-4 w-4" /> },
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
        tone: "branch",
        items: [
          { label: "Today", href: "/", icon: <Home className="h-4 w-4" /> },
          { label: "Production", href: "/workspace/production", icon: <Brain className="h-4 w-4" /> },
          { label: "Purchasing", href: "/workspace/purchasing", icon: <Folder className="h-4 w-4" /> },
          { label: "Sales & Waste", href: "/workspace/sales-waste", icon: <Folder className="h-4 w-4" /> },
          { label: "Inventory", href: "/workspace/inventory", icon: <Clock className="h-4 w-4" /> },
          { label: "Staff", href: "/workspace/staff-performance", icon: <User className="h-4 w-4" /> },
          { label: "Chat", href: "/workspace/chat", icon: <ChatBubble className="h-4 w-4" /> },
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
          { label: "Overview", href: "/", icon: <Home className="h-4 w-4" /> },
          { label: "Command", href: "/workspace/command", icon: <Brain className="h-4 w-4" /> },
          { label: "Financial", href: "/workspace/financial", icon: <Folder className="h-4 w-4" /> },
          { label: "Branches", href: "/workspace/branches", icon: <Shop className="h-4 w-4" /> },
          { label: "Purchasing", href: "/workspace/purchasing", icon: <Folder className="h-4 w-4" /> },
          { label: "Production", href: "/workspace/production", icon: <Brain className="h-4 w-4" /> },
          { label: "Inventory", href: "/workspace/inventory", icon: <Clock className="h-4 w-4" /> },
          { label: "Staff", href: "/workspace/staff-performance", icon: <User className="h-4 w-4" /> },
          { label: "Sales & Waste", href: "/workspace/sales-waste", icon: <Folder className="h-4 w-4" /> },
          { label: "Risk", href: "/workspace/risk", icon: <Settings className="h-4 w-4" /> },
          { label: "Chat", href: "/workspace/chat", icon: <ChatBubble className="h-4 w-4" /> },
        ],
      },
    ];
  }

  if (role === "ORG_OWNER" || role === "ORG_ADMIN") {
    return [
      {
        title: "Operations",
        tone: "operations",
        items: [
          { label: "Overview", href: "/", icon: <Home className="h-4 w-4" /> },
          { label: "Command", href: "/workspace/command", icon: <Brain className="h-4 w-4" /> },
          { label: "Branches", href: "/workspace/branches", icon: <Shop className="h-4 w-4" /> },
          { label: "Production", href: "/workspace/production", icon: <Brain className="h-4 w-4" /> },
          { label: "Inventory", href: "/workspace/inventory", icon: <Clock className="h-4 w-4" /> },
          { label: "Sales & Waste", href: "/workspace/sales-waste", icon: <Folder className="h-4 w-4" /> },
        ],
      },
      {
        title: "Financial",
        tone: "financial",
        items: [
          { label: "Financial", href: "/workspace/financial", icon: <Folder className="h-4 w-4" /> },
          { label: "Purchasing", href: "/workspace/purchasing", icon: <Folder className="h-4 w-4" /> },
          { label: "Staff", href: "/workspace/staff-performance", icon: <User className="h-4 w-4" /> },
        ],
      },
      {
        title: "Governance",
        tone: "governance",
        items: [
          { label: "Risk", href: "/workspace/risk", icon: <Settings className="h-4 w-4" /> },
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
      tone: "workspace",
      items: [
        { label: "Overview", href: "/", icon: <Home className="h-4 w-4" /> },
        { label: "Today", href: "/workspace/today", icon: <Clock className="h-4 w-4" /> },
        { label: "Production", href: "/workspace/production", icon: <Brain className="h-4 w-4" /> },
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
      ? "bg-[#211e15] group-hover:bg-[#2A2416]"
      : sectionTone === "operations" || sectionTone === "production"
        ? "bg-[#1c2128] group-hover:bg-[#232a34]"
        : sectionTone === "governance"
          ? "bg-[#211f24] group-hover:bg-[#2a2730]"
          : sectionTone === "branch" || sectionTone === "workspace"
            ? "bg-[#1e1f22] group-hover:bg-[#26282d]"
            : "bg-transparent group-hover:bg-[#232327]";

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`group relative w-full flex items-center ${
        collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
      } py-2 rounded-[8px] text-[13px] font-medium transition-colors duration-150 ${
        active
          ? "text-[#F5F5F7]"
          : commandItem
            ? "text-[#CFA23A] hover:text-[#F3C865]"
            : "text-[#C7C7CC] hover:text-[#F5F5F7]"
      }`}
    >
      <span
        className={`absolute left-0 top-2.5 h-6 w-[2px] rounded-r ${
          active ? "bg-[#A8821F]" : "bg-transparent"
        }`}
      />
      <span
        className={`h-7 w-7 rounded-[7px] inline-flex items-center justify-center flex-shrink-0 transition-colors ${
          active
            ? commandItem
              ? "text-[#F3C865] bg-[#2A2416] shadow-[0_0_18px_rgba(168,130,31,0.35)]"
              : "text-[#A8821F] bg-[#232327]"
            : commandItem
              ? "text-[#CFA23A] bg-[#211e15] shadow-[0_0_12px_rgba(168,130,31,0.18)]"
              : `text-[#8E8E93] ${toneBaseClass} group-hover:text-[#C7C7CC]`
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
        <div className="relative flex items-center">
          <Link
            href="/"
            className={`inline-flex min-w-0 items-center ${
              collapsed ? "mx-auto justify-center" : "gap-2.5 pr-10"
            }`}
          >
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
            className={`absolute right-0 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] border border-[#2E2E33] bg-[#232327] text-[#8E8E93] transition-colors duration-150 hover:bg-[#2A2A2E] hover:text-[#F5F5F7] ${
              collapsed ? "shadow-[0_0_0_3px_rgba(20,20,22,0.95)]" : ""
            }`}
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

      <div
        className={`flex-1 overflow-y-auto py-5 [scrollbar-width:thin] [scrollbar-color:#2E2E33_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2E2E33] hover:[&::-webkit-scrollbar-thumb]:bg-[#3A3A40] ${
          collapsed ? "px-2" : "px-3"
        }`}
      >
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
                  sectionTone={section.tone}
                />
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-[#2E2E33] p-3">
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
        <button
          className={`w-full rounded-[10px] px-3 py-2.5 text-[12px] font-medium text-[#C7C7CC] transition-colors duration-150 hover:bg-[#232327] hover:text-[#F5F5F7] flex items-center ${
            collapsed ? "justify-center" : "gap-3"
          }`}
          type="button"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          title={collapsed ? "Sign out" : undefined}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#232327] text-[#8E8E93]">
            <LogOut className="h-4 w-4 flex-shrink-0" />
          </span>
          {!collapsed ? <span className="truncate">Sign out</span> : null}
        </button>
      </div>
    </aside>
  );
}
