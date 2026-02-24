"use client";

import { useBranches, useCurrentUserProfile } from "@/services";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  MetricCard,
  ProgressChart,
  DataTable,
  StatBadge,
} from "@/components/dashboard";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import {
  Spark,
  Brain,
  Shop,
  Clock,
  User,
  Bell,
  Search,
  NavArrowDown,
  MapPin,
  PlusCircle,
  Check,
} from "iconoir-react";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-surface-1">
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <div className="h-12 w-12 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-text-muted">
              Getting things ready...
            </p>
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { data: user, isLoading } = useCurrentUserProfile();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const branchMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedBranchFromUrl = searchParams.get("branch");

  const branches = branchesQuery.data ?? [];
  const activeBranch = useMemo(() => {
    if (!branches.length) return null;
    if (selectedBranchFromUrl) {
      const fromUrl = branches.find((branch) => branch.id === selectedBranchFromUrl);
      if (fromUrl) return fromUrl;
    }
    const primary = branches.find((branch) => branch.is_primary);
    return primary ?? branches[0];
  }, [branches, selectedBranchFromUrl]);

  const applyBranchToUrl = (branchId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("branch", branchId);
    router.replace(`${pathname}?${next.toString()}`);
  };

  useEffect(() => {
    if (!isLoading && user && !user.has_organization) {
      router.replace("/onboarding");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!activeBranch) return;
    if (selectedBranchFromUrl === activeBranch.id) return;
    applyBranchToUrl(activeBranch.id);
  }, [activeBranch, selectedBranchFromUrl]);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (!branchMenuRef.current) return;
      if (branchMenuRef.current.contains(event.target as Node)) return;
      setBranchMenuOpen(false);
    };

    if (branchMenuOpen) {
      window.addEventListener("mousedown", onOutsideClick);
    }
    return () => window.removeEventListener("mousedown", onOutsideClick);
  }, [branchMenuOpen]);

  if (isLoading || (user && !user.has_organization)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted">
            Getting things ready...
          </p>
        </div>
      </main>
    );
  }

  const projectData = [
    {
      name: "Menu optimization",
      dueDate: "25.01.24",
      status: "completed",
      variance: "↑ 12%",
    },
    {
      name: "Waste reduction initiative",
      dueDate: "25.01.24",
      status: "in-progress",
      variance: "↓ 10%",
    },
    {
      name: "Prep time analysis",
      dueDate: "25.01.24",
      status: "at-risk",
      variance: "↑ 8%",
    },
    {
      name: "Inventory recount",
      dueDate: "25.01.24",
      status: "in-progress",
      variance: "→ 2%",
    },
    {
      name: "Staff scheduling",
      dueDate: "25.01.24",
      status: "delayed",
      variance: "↓ 5%",
    },
  ];

  const progressItems = [
    { label: "Optimized", value: 65, color: "gold" as const },
    { label: "In progress", value: 87, color: "info" as const },
    { label: "At risk", value: 20, color: "warning" as const },
    { label: "Delayed", value: 25, color: "critical" as const },
  ];

  return (
    <div className="flex min-h-screen bg-surface-1">
      {/* Sidebar */}
      <DashboardSidebar user={user} />

      {/* Main Content */}
      <main className="flex-1 ml-64 py-8">
        <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-8">
          {/* Top Nav */}
          <div className="mb-10 -mx-2 px-2 sm:-mx-4 sm:px-4 pb-5 border-b border-[#2A2A2E]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
                  Dashboard
                </p>
                <h1 className="mt-1 font-display text-[30px] leading-[38px] font-semibold text-[#F5F5F7]">
                  Overview
                </h1>
              </div>

              <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
                <div className="relative" ref={branchMenuRef}>
                  <button
                    type="button"
                    onClick={() => setBranchMenuOpen((open) => !open)}
                    className="h-10 min-w-[220px] rounded-[8px] bg-[#232327] pl-3 pr-2 inline-flex items-center justify-between gap-2 text-left hover:bg-[#2A2A2E] transition-colors duration-150"
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <MapPin className="h-4 w-4 text-[#A8821F]" />
                      <span className="min-w-0">
                        <span className="block text-[10px] uppercase tracking-[0.12em] text-[#8E8E93]">
                          Active branch
                        </span>
                        <span className="block truncate text-[12px] font-medium text-[#F5F5F7] max-w-[140px]">
                          {branchesQuery.isLoading
                            ? "Loading..."
                            : activeBranch?.name || "No branch selected"}
                        </span>
                      </span>
                    </span>
                    <NavArrowDown
                      className={`h-4 w-4 text-[#8E8E93] transition-transform duration-150 ${
                        branchMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {branchMenuOpen ? (
                    <div className="absolute right-0 mt-2 w-[320px] rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-30">
                      <div className="px-2 pt-1 pb-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                          Switch branch context
                        </p>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                        {branchesQuery.isLoading ? (
                          <p className="px-2 py-2 text-[12px] text-[#8E8E93]">
                            Loading branches...
                          </p>
                        ) : branches.length ? (
                          branches.map((branch) => {
                            const isActive = activeBranch?.id === branch.id;
                            return (
                              <button
                                key={branch.id}
                                type="button"
                                onClick={() => {
                                  applyBranchToUrl(branch.id);
                                  setBranchMenuOpen(false);
                                }}
                                className={`w-full rounded-[8px] px-2.5 py-2 inline-flex items-center justify-between gap-2 text-left transition-colors duration-150 ${
                                  isActive
                                    ? "bg-[#232327] text-[#F5F5F7]"
                                    : "text-[#C7C7CC] hover:bg-[#232327] hover:text-[#F5F5F7]"
                                }`}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-[12px] font-medium">
                                    {branch.name}
                                  </span>
                                  <span className="block text-[11px] text-[#8E8E93]">
                                    {branch.address}
                                  </span>
                                </span>
                                {isActive ? (
                                  <span className="h-5 w-5 rounded-full bg-[#A8821F]/20 inline-flex items-center justify-center text-[#A8821F]">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                ) : null}
                              </button>
                            );
                          })
                        ) : (
                          <p className="px-2 py-2 text-[12px] text-[#8E8E93]">
                            No branches available yet.
                          </p>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-[#2E2E33]">
                        <Link
                          href="/setup/branch/create"
                          className="w-full rounded-[8px] px-2.5 py-2 inline-flex items-center justify-between text-[12px] font-medium text-[#F5F5F7] hover:bg-[#232327] transition-colors duration-150"
                          onClick={() => setBranchMenuOpen(false)}
                        >
                          <span className="inline-flex items-center gap-2">
                            <PlusCircle className="h-4 w-4 text-[#A8821F]" />
                            Add new branch
                          </span>
                          <span className="text-[#8E8E93]">Setup</span>
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>

                <label className="relative flex-1 min-w-[220px] lg:min-w-[340px]">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                  <input
                    type="text"
                    placeholder="Search reports, branches, settings..."
                    className="h-10 w-full rounded-[8px] bg-[#232327] pl-9 pr-3 text-[13px] text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:ring-1 focus:ring-[#A8821F]"
                  />
                </label>

                <button
                  type="button"
                  aria-label="Notifications"
                  className="h-10 w-10 rounded-[8px] bg-[#232327] inline-flex items-center justify-center text-[#C7C7CC] hover:text-[#F5F5F7] hover:bg-[#2A2A2E] transition-colors duration-150"
                >
                  <Bell className="h-4 w-4" />
                </button>

                {user && (
                  <button
                    type="button"
                    className="h-10 rounded-[8px] bg-[#232327] pl-2 pr-2.5 inline-flex items-center gap-2 text-left hover:bg-[#2A2A2E] transition-colors duration-150"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-brand-gold/20 text-brand-gold">
                      <span className="text-[11px] font-semibold">
                        {user.first_name?.[0]}
                        {user.last_name?.[0]}
                      </span>
                    </div>
                    <div className="hidden sm:block min-w-0">
                      <p className="truncate text-[12px] font-medium text-[#F5F5F7] max-w-[120px]">
                        {user.first_name} {user.last_name}
                      </p>
                    </div>
                    <NavArrowDown className="h-4 w-4 text-[#8E8E93]" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Header Section */}
          <div className="mb-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                Executive View
              </p>
              <h1 className="mt-2 font-display text-4xl font-semibold text-text-primary">
                Operations snapshot
              </h1>
            </div>
          </div>

          {/* Metrics Overview */}
          <section className="mb-12">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Last 30 days
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total revenue"
                value="$53,900"
                icon={<Spark />}
                change={{ percentage: 12, isPositive: true }}
              />
              <MetricCard
                label="Active recipes"
                value="95"
                icon={<Brain />}
                change={{ percentage: 10, isPositive: false }}
              />
              <MetricCard
                label="Prep hours logged"
                value="1,022"
                icon={<Clock />}
                change={{ percentage: 8, isPositive: true }}
              />
              <MetricCard
                label="Team efficiency"
                value="101"
                icon={<User />}
                change={{ percentage: 2, isPositive: true }}
              />
            </div>
          </section>

          {/* Main Content Grid */}
          <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Project Summary Table */}
            <div className="lg:col-span-2">
              <DataTable
                title="Project summary"
                columns={[
                  { key: "name", label: "Name" },
                  { key: "dueDate", label: "Due date" },
                  {
                    key: "status",
                    label: "Status",
                    render: (status) => (
                      <StatBadge
                        status={status}
                        label={
                          status.charAt(0).toUpperCase() +
                          status.slice(1).replace("-", " ")
                        }
                      />
                    ),
                  },
                  { key: "variance", label: "Variance" },
                ]}
                data={projectData}
              />
            </div>

            {/* Overall Progress */}
            <ProgressChart title="Overall progress" items={progressItems} />
          </section>

          {/* CTA Section */}
          <section className="mt-12 rounded-card border border-border-default bg-surface-2 p-8 shadow-[var(--shadow-level-1)] sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
              Ready to optimize?
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-text-primary">
              Start your kitchen intelligence journey
            </h2>
            <p className="mt-4 max-w-2xl text-base text-text-secondary">
              PrepIQ transforms daily operational noise into clear, actionable
              insights. Discover what to produce, where margin is leaking, and
              what to fix before tomorrow service.
            </p>

            <Link href="/setup/branch">
              <button className="mt-8 h-12 w-full bg-brand-gold hover:bg-brand-gold-hover active:bg-brand-gold-pressed text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150 sm:w-auto sm:px-8">
                <Shop />
                Get started
              </button>
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
