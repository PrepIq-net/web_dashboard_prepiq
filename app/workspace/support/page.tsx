"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  HelpCircle,
  Bug,
  LightBulb,
  Clock,
  CheckCircle,
  WarningTriangle,
  Circle,
  Page,
  Play,
  CreditCard,
  ArrowRight,
  Plus,
  ChatBubble,
  Book,
  Rocket,
  Terminal,
  Package,
  GraphUp,
  Cart,
  Coins,
  User,
  WarningCircle,
} from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Button } from "@/components/ui/button";
import {
  useCurrentUserProfile,
  useSupportStats,
  useHelpArticles,
  useSearchHelpArticles,
  useSystemStatus,
  useSupportTickets,
  useCreateSupportTicket,
  useCreateBugReport,
  useFeatureRequests,
  useCreateFeatureRequest,
  useVoteFeatureRequest,
  useBranches,
} from "@/services";
import type { HelpArticle, SystemStatus, SupportTicket, FeatureRequest } from "@/services/support/types";

function getStatusIcon(status: SystemStatus["forecast_engine"]) {
  switch (status) {
    case "operational":
      return <CheckCircle className="h-5 w-5 text-status-success" />;
    case "degraded":
      return <WarningTriangle className="h-5 w-5 text-status-warning" />;
    case "down":
      return <Circle className="h-5 w-5 text-status-critical" />;
  }
}

function getStatusLabel(status: SystemStatus["forecast_engine"]) {
  switch (status) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "down":
      return "Outage";
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "getting_started":
      return <Rocket className="h-5 w-5" />;
    case "daily_operations":
      return <Terminal className="h-5 w-5" />;
    case "forecasting":
      return <GraphUp className="h-5 w-5" />;
    case "production":
      return <Package className="h-5 w-5" />;
    case "inventory":
      return <Package className="h-5 w-5" />;
    case "pos_integration":
      return <Terminal className="h-5 w-5" />;
    case "billing":
      return <CreditCard className="h-5 w-5" />;
    default:
      return <Book className="h-5 w-5" />;
  }
}

function getCategoryLabel(category: string) {
  switch (category) {
    case "getting_started":
      return "Getting Started";
    case "daily_operations":
      return "Daily Operations";
    case "forecasting":
      return "Forecasting";
    case "production":
      return "Production";
    case "inventory":
      return "Inventory";
    case "pos_integration":
      return "POS Integration";
    case "billing":
      return "Billing";
    default:
      return category;
  }
}

// Quick Guide Card Component
function QuickGuideCard({
  title,
  description,
  icon,
  articleCount,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  articleCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 rounded-xl border border-border-default bg-surface-2 hover:bg-surface-3 hover:border-brand-gold/30 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-3 text-brand-gold group-hover:bg-brand-gold/10">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-brand-gold group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-xs text-text-muted mt-3">
        <span className="text-brand-gold font-medium">{articleCount}</span> articles
      </p>
    </button>
  );
}

// System Status Card Component
function SystemStatusCard({
  label,
  status,
}: {
  label: string;
  status: SystemStatus["forecast_engine"];
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-surface-3 border border-border-default">
      <div className="flex items-center gap-3">
        {getStatusIcon(status)}
        <span className="text-sm font-medium text-text-primary">{label}</span>
      </div>
      <span
        className={`text-xs font-semibold uppercase tracking-wider ${
          status === "operational"
            ? "text-status-success"
            : status === "degraded"
              ? "text-status-warning"
              : "text-status-critical"
        }`}
      >
        {getStatusLabel(status)}
      </span>
    </div>
  );
}

// Feature Request Card Component
function FeatureRequestCard({
  request,
  onVote,
}: {
  request: FeatureRequest;
  onVote: (id: string) => void;
}) {
  const [voting, setVoting] = useState(false);

  const handleVote = async () => {
    setVoting(true);
    await onVote(request.id);
    setVoting(false);
  };

  return (
    <div className="p-4 rounded-lg bg-surface-2 border border-border-default">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-text-primary">{request.title}</h4>
          <p className="text-xs text-text-muted mt-1 line-clamp-2">{request.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-surface-3 text-text-muted uppercase tracking-wider">
              {request.category}
            </span>
          </div>
        </div>
        <button
          onClick={handleVote}
          disabled={voting}
          className="flex flex-col items-center gap-1 p-2 rounded-lg bg-surface-3 hover:bg-brand-gold/10 hover:text-brand-gold border border-border-default transition-colors"
        >
          <Plus className={`h-4 w-4 ${voting ? "animate-pulse" : ""}`} />
          <span className="text-xs font-bold">{request.votes}</span>
        </button>
      </div>
    </div>
  );
}

export default function SupportPage() {
  const router = useRouter();
  const { data: user } = useCurrentUserProfile();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  // Queries
  const statsQuery = useSupportStats();
  const helpArticlesQuery = useHelpArticles();
  const systemStatusQuery = useSystemStatus();
  const ticketsQuery = useSupportTickets();
  const featureRequestsQuery = useFeatureRequests();

  // Mutations
  const createTicketMutation = useCreateSupportTicket();
  const createBugReportMutation = useCreateBugReport();
  const createFeatureRequestMutation = useCreateFeatureRequest();
  const voteFeatureRequestMutation = useVoteFeatureRequest();

  // Local state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"help" | "contact" | "report" | "features">("help");
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    category: "technical_issue" as const,
    description: "",
    priority: "medium" as const,
  });
  const [bugForm, setBugForm] = useState({
    description: "",
  });
  const [featureForm, setFeatureForm] = useState({
    title: "",
    description: "",
    category: "forecasting" as const,
  });

  // Search results
  const searchResults = useSearchHelpArticles(searchQuery);

  // Group help articles by category
  const groupedArticles = useMemo(() => {
    if (!helpArticlesQuery.data) return {};
    return helpArticlesQuery.data.reduce(
      (acc, article) => {
        if (!acc[article.category]) {
          acc[article.category] = [];
        }
        acc[article.category].push(article);
        return acc;
      },
      {} as Record<string, HelpArticle[]>
    );
  }, [helpArticlesQuery.data]);

  // Filter feature requests by status
  const openFeatureRequests = useMemo(() => {
    return (
      featureRequestsQuery.data?.filter(
        (r) => r.status === "open" || r.status === "under_review" || r.status === "planned"
      ) ?? []
    );
  }, [featureRequestsQuery.data]);

  // Handle form submissions
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTicketMutation.mutateAsync(ticketForm);
    setTicketForm({ subject: "", category: "technical_issue", description: "", priority: "medium" });
    setActiveTab("help");
  };

  const handleSubmitBugReport = async (e: React.FormEvent) => {
    e.preventDefault();
    await createBugReportMutation.mutateAsync(bugForm);
    setBugForm({ description: "" });
  };

  const handleSubmitFeatureRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await createFeatureRequestMutation.mutateAsync(featureForm);
    setFeatureForm({ title: "", description: "", category: "forecasting" });
  };

  const handleVote = async (id: string) => {
    await voteFeatureRequestMutation.mutateAsync(id);
    featureRequestsQuery.refetch();
  };

  const stats = statsQuery.data;

  return (
    <WorkspaceShell
      eyebrow="System"
      title="Support Hub"
      description="Help center, issue tracking, and feature requests for the Command Center."
      insight="Most onboarding blockers are integration-related and resolved within 24h."
    >
      {/* Quick Stats */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3 pb-8 border-b border-[#2A2A2E]">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Open Tickets
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            {stats?.open_tickets ?? "—"}
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Avg Response
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            {stats?.avg_response_time_minutes ?? "—"} min
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Resolved This Week
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            {stats?.resolved_this_week ?? "—"}
          </p>
        </article>
      </section>

      {/* Tab Navigation */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-border-default pb-4">
        <button
          onClick={() => setActiveTab("help")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "help"
              ? "bg-brand-gold text-background"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
          }`}
        >
          <Search className="h-4 w-4" />
          Help & Guides
        </button>
        <button
          onClick={() => setActiveTab("contact")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "contact"
              ? "bg-brand-gold text-background"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
          }`}
        >
          <ChatBubble className="h-4 w-4" />
          Contact Support
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "report"
              ? "bg-brand-gold text-background"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
          }`}
        >
          <Bug className="h-4 w-4" />
          Report a Problem
        </button>
        <button
          onClick={() => setActiveTab("features")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "features"
              ? "bg-brand-gold text-background"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
          }`}
        >
          <LightBulb className="h-4 w-4" />
          Feature Requests
        </button>
      </div>

      {/* Help & Guides Tab */}
      {activeTab === "help" && (
        <div className="mt-6 space-y-8">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles..."
              className="w-full h-12 pl-12 pr-4 rounded-lg bg-surface-3 border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all"
            />
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Search Results
              </p>
              {searchResults.isLoading ? (
                <p className="text-sm text-text-muted">Searching...</p>
              ) : searchResults.data && searchResults.data.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {searchResults.data.map((article) => (
                    <button
                      key={article.id}
                      className="text-left p-4 rounded-lg bg-surface-2 border border-border-default hover:border-brand-gold/30 transition-all"
                    >
                      <h4 className="text-sm font-semibold text-text-primary">{article.title}</h4>
                      <p className="text-xs text-text-muted mt-1 line-clamp-2">{article.summary}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No results found. Try a different search term.</p>
              )}
            </div>
          )}

          {/* Quick Guides Grid */}
          {searchQuery.length < 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4">
                  Quick Guides
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <QuickGuideCard
                    title="Getting Started"
                    description="Set up your branch and connect your POS"
                    icon={<Rocket className="h-5 w-5" />}
                    articleCount={groupedArticles["getting_started"]?.length ?? 0}
                    onClick={() => {}}
                  />
                  <QuickGuideCard
                    title="Daily Operations"
                    description="Planning, live service, and reporting"
                    icon={<Terminal className="h-5 w-5" />}
                    articleCount={groupedArticles["daily_operations"]?.length ?? 0}
                    onClick={() => {}}
                  />
                  <QuickGuideCard
                    title="Forecasting"
                    description="Understanding and managing forecasts"
                    icon={<GraphUp className="h-5 w-5" />}
                    articleCount={groupedArticles["forecasting"]?.length ?? 0}
                    onClick={() => {}}
                  />
                  <QuickGuideCard
                    title="Production"
                    description="Managing prep and production planning"
                    icon={<Package className="h-5 w-5" />}
                    articleCount={groupedArticles["production"]?.length ?? 0}
                    onClick={() => {}}
                  />
                  <QuickGuideCard
                    title="Inventory"
                    description="Tracking and managing ingredients"
                    icon={<Package className="h-5 w-5" />}
                    articleCount={groupedArticles["inventory"]?.length ?? 0}
                    onClick={() => {}}
                  />
                  <QuickGuideCard
                    title="POS Integration"
                    description="Connecting your POS system"
                    icon={<Terminal className="h-5 w-5" />}
                    articleCount={groupedArticles["pos_integration"]?.length ?? 0}
                    onClick={() => {}}
                  />
                </div>
              </div>

              {/* System Status */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4">
                  System Status
                </h3>
                {systemStatusQuery.isLoading ? (
                  <p className="text-sm text-text-muted">Loading status...</p>
                ) : systemStatusQuery.data ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <SystemStatusCard
                      label="Forecast Engine"
                      status={systemStatusQuery.data.forecast_engine}
                    />
                    <SystemStatusCard
                      label="POS Integrations"
                      status={systemStatusQuery.data.pos_integrations}
                    />
                    <SystemStatusCard
                      label="Data Sync"
                      status={systemStatusQuery.data.data_sync}
                    />
                    <SystemStatusCard
                      label="API Services"
                      status={systemStatusQuery.data.api_services}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">Unable to load system status.</p>
                )}
              </div>

              {/* Training Resources */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4">
                  Training & Resources
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-surface-2 border border-border-default hover:border-brand-gold/30 transition-all cursor-pointer">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                      <Play className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">Command Center Intro</h4>
                      <p className="text-xs text-text-muted mt-0.5">2-minute video guide</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-surface-2 border border-border-default hover:border-brand-gold/30 transition-all cursor-pointer">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-3 text-brand-gold">
                      <Book className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">Kitchen Planning Guide</h4>
                      <p className="text-xs text-text-muted mt-0.5">Best practices documentation</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Links */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4">
                  Account & Billing
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => router.push("/workspace/billing")}
                    className="flex items-center gap-3 p-4 rounded-lg bg-surface-2 border border-border-default hover:border-brand-gold/30 transition-all text-left"
                  >
                    <CreditCard className="h-5 w-5 text-text-muted" />
                    <span className="text-sm font-medium text-text-primary">View Invoices</span>
                  </button>
                  <button
                    onClick={() => router.push("/workspace/billing")}
                    className="flex items-center gap-3 p-4 rounded-lg bg-surface-2 border border-border-default hover:border-brand-gold/30 transition-all text-left"
                  >
                    <CreditCard className="h-5 w-5 text-text-muted" />
                    <span className="text-sm font-medium text-text-primary">Update Payment</span>
                  </button>
                  <button
                    onClick={() => router.push("/workspace/billing")}
                    className="flex items-center gap-3 p-4 rounded-lg bg-surface-2 border border-border-default hover:border-brand-gold/30 transition-all text-left"
                  >
                    <CreditCard className="h-5 w-5 text-text-muted" />
                    <span className="text-sm font-medium text-text-primary">Upgrade Plan</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contact Support Tab */}
      {activeTab === "contact" && (
        <div className="mt-6">
          <form onSubmit={handleSubmitTicket} className="max-w-2xl space-y-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                Subject
              </label>
              <input
                type="text"
                value={ticketForm.subject}
                onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                placeholder="Brief description of your issue"
                required
                className="w-full h-12 px-4 rounded-lg bg-surface-3 border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                  Category
                </label>
                <select
                  value={ticketForm.category}
                  onChange={(e) =>
                    setTicketForm({ ...ticketForm, category: e.target.value as typeof ticketForm.category })
                  }
                  className="w-full h-12 px-4 rounded-lg bg-surface-3 border border-border-default text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all appearance-none"
                >
                  <option value="technical_issue">Technical Issue</option>
                  <option value="data_problem">Data Problem</option>
                  <option value="forecast_question">Forecast Question</option>
                  <option value="billing_issue">Billing Issue</option>
                  <option value="pos_integration">POS Integration</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                  Priority
                </label>
                <select
                  value={ticketForm.priority}
                  onChange={(e) =>
                    setTicketForm({ ...ticketForm, priority: e.target.value as typeof ticketForm.priority })
                  }
                  className="w-full h-12 px-4 rounded-lg bg-surface-3 border border-border-default text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all appearance-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                Description
              </label>
              <textarea
                value={ticketForm.description}
                onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                placeholder="Please provide details about your issue..."
                required
                rows={6}
                className="w-full px-4 py-3 rounded-lg bg-surface-3 border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">
                Branch:{" "}
                {branchesQuery.data?.[0]?.name ?? "Not selected"}
              </p>
              <Button type="submit" disabled={createTicketMutation.isPending}>
                {createTicketMutation.isPending ? "Submitting..." : "Submit Ticket"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Report a Problem Tab */}
      {activeTab === "report" && (
        <div className="mt-6">
          <div className="max-w-2xl p-6 rounded-xl bg-status-critical/10 border border-status-critical/20">
            <div className="flex items-center gap-3 mb-4">
              <WarningCircle className="h-6 w-6 text-status-critical" />
              <h3 className="text-sm font-semibold text-text-primary">Report a Problem</h3>
            </div>
            <p className="text-xs text-text-muted mb-6">
              Use this for urgent issues. Browser info and page location are automatically captured.
            </p>

            <form onSubmit={handleSubmitBugReport} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                  Describe the Issue
                </label>
                <textarea
                  value={bugForm.description}
                  onChange={(e) => setBugForm({ ...bugForm, description: e.target.value })}
                  placeholder="What isn't working? Include any error messages..."
                  required
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-surface-3 border border-status-critical/20 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-status-critical focus:ring-1 focus:ring-status-critical/20 transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  Environment data will be captured automatically
                </p>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={createBugReportMutation.isPending}
                >
                  {createBugReportMutation.isPending ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feature Requests Tab */}
      {activeTab === "features" && (
        <div className="mt-6 space-y-8">
          {/* Submit New Feature */}
          <div className="p-6 rounded-xl bg-surface-2 border border-border-default">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Submit a Feature Request</h3>
            <form onSubmit={handleSubmitFeatureRequest} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={featureForm.title}
                  onChange={(e) => setFeatureForm({ ...featureForm, title: e.target.value })}
                  placeholder="Feature title"
                  required
                  className="h-12 px-4 rounded-lg bg-surface-3 border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all"
                />
                <select
                  value={featureForm.category}
                  onChange={(e) =>
                    setFeatureForm({ ...featureForm, category: e.target.value as typeof featureForm.category })
                  }
                  className="h-12 px-4 rounded-lg bg-surface-3 border border-border-default text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all appearance-none"
                >
                  <option value="forecasting">Forecasting</option>
                  <option value="production">Production</option>
                  <option value="purchasing">Purchasing</option>
                  <option value="reporting">Reporting</option>
                  <option value="inventory">Inventory</option>
                  <option value="pos_integration">POS Integration</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <textarea
                value={featureForm.description}
                onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })}
                placeholder="Describe how this feature would help your operations..."
                required
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-surface-3 border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all resize-none"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={createFeatureRequestMutation.isPending}>
                  {createFeatureRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </div>

          {/* Existing Feature Requests */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4">
              Open Feature Requests
            </h3>
            {featureRequestsQuery.isLoading ? (
              <p className="text-sm text-text-muted">Loading...</p>
            ) : openFeatureRequests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {openFeatureRequests.map((request) => (
                  <FeatureRequestCard key={request.id} request={request} onVote={handleVote} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted p-4 rounded-lg bg-surface-2">
                No open feature requests. Be the first to submit one!
              </p>
            )}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}