"use client";

import { Select } from "@/components/ui/select";
import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Search,
  HelpCircle,
  Bug,
  LightBulb,
  CheckCircle,
  WarningTriangle,
  Circle,
  Play,
  ArrowUp,
  Attachment,
  ChatBubble,
  Book,
  Rocket,
  Terminal,
  Package,
  GraphUp,
  Xmark,
} from "iconoir-react";
import { Button } from "@/components/ui/button";
import {
  useCurrentUserProfile,
  useHelpArticles,
  useSearchHelpArticles,
  useSystemStatus,
  useBranches,
} from "@/services";
import type { HelpArticle, SystemStatus } from "@/services/support/types";
import {
  useFeatureBoard,
  useSubmitSupportRequest,
  useToggleFeatureVote,
  type FeatureBoardEntry,
  type SupportContactType,
} from "@/services/support/contact";
import { useLanguage } from "@/lib/i18n/language-context";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const CONTACT_TYPES: {
  value: SupportContactType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "BUG",
    label: "Report a bug",
    description: "Something isn't working the way it should",
    icon: <Bug className="h-5 w-5" />,
  },
  {
    value: "FEATURE_REQUEST",
    label: "Request a feature",
    description: "Something PrepIQ could do for your kitchen",
    icon: <LightBulb className="h-5 w-5" />,
  },
  {
    value: "INQUIRY",
    label: "Ask a question",
    description: "Billing, data, forecasts — anything unclear",
    icon: <HelpCircle className="h-5 w-5" />,
  },
  {
    value: "FEEDBACK",
    label: "Share feedback",
    description: "Tell us how PrepIQ is working for you",
    icon: <ChatBubble className="h-5 w-5" />,
  },
];

const MESSAGE_PLACEHOLDERS: Record<SupportContactType, string> = {
  BUG: "What happened, what did you expect, and how can we reproduce it? Include any error messages…",
  FEATURE_REQUEST: "Describe the feature and how it would help your operations…",
  INQUIRY: "What would you like to know?",
  FEEDBACK: "What's working well? What's getting in your way?",
};

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

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

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
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-3 text-brand-gold group-hover:bg-brand-gold/10">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        </div>
      </div>
      <p className="text-xs text-text-muted mt-3">
        <span className="text-brand-gold font-medium">{articleCount}</span> articles
      </p>
    </button>
  );
}

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

function FeatureBoardCard({
  entry,
  onVote,
  voting,
}: {
  entry: FeatureBoardEntry;
  onVote: (id: string) => void;
  voting: boolean;
}) {
  return (
    <div className="p-4 rounded-lg bg-surface-2 border border-border-default">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-text-primary">{entry.title}</h4>
          <p className="text-xs text-text-muted mt-1 line-clamp-3">{entry.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-surface-3 text-text-muted uppercase tracking-wider">
              {entry.status === "IN_PROGRESS" ? "In progress" : "Under review"}
            </span>
            <span className="text-[10px] text-text-muted font-mono">{entry.reference}</span>
          </div>
        </div>
        <button
          onClick={() => onVote(entry.id)}
          disabled={voting}
          title={entry.hasVoted ? "Remove your vote" : "Vote for this feature"}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
            entry.hasVoted
              ? "bg-brand-gold/15 text-brand-gold border-brand-gold/40"
              : "bg-surface-3 border-border-default hover:bg-brand-gold/10 hover:text-brand-gold"
          }`}
        >
          <ArrowUp className={`h-4 w-4 ${voting ? "animate-pulse" : ""}`} />
          <span className="text-xs font-bold">{entry.votes}</span>
        </button>
      </div>
    </div>
  );
}

type ReplyPreference = "account" | "custom" | "none";

export function SupportTabContent() {
  const { data: user } = useCurrentUserProfile();
  const { language } = useLanguage();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const helpArticlesQuery = useHelpArticles();
  const systemStatusQuery = useSystemStatus();
  const featureBoardQuery = useFeatureBoard();

  const submitMutation = useSubmitSupportRequest();
  const voteMutation = useToggleFeatureVote();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"help" | "contact" | "board">("help");

  const [contactType, setContactType] = useState<SupportContactType>("BUG");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [branchId, setBranchId] = useState("");
  const [replyPreference, setReplyPreference] = useState<ReplyPreference>("account");
  const [customEmail, setCustomEmail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [lastReference, setLastReference] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useSearchHelpArticles(searchQuery);

  const groupedArticles = useMemo(() => {
    const articles = Array.isArray(helpArticlesQuery.data) ? helpArticlesQuery.data : [];
    return articles.reduce(
      (acc, article) => {
        if (!acc[article.category]) acc[article.category] = [];
        acc[article.category].push(article);
        return acc;
      },
      {} as Record<string, HelpArticle[]>,
    );
  }, [helpArticlesQuery.data]);

  const branches = branchesQuery.data ?? [];

  function handleAddFiles(selected: FileList | null) {
    if (!selected) return;
    const next = [...files];
    for (const file of Array.from(selected)) {
      if (next.length >= MAX_FILES) {
        toast.error(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`"${file.name}" is larger than 5 MB.`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (replyPreference === "custom" && !/^\S+@\S+\.\S+$/.test(customEmail.trim())) {
      toast.error("Enter a valid email for the reply, or choose another option.");
      return;
    }

    const form = new FormData();
    form.set("type", contactType);
    form.set("subject", subject);
    form.set("message", message);
    if (replyPreference === "account" && user?.email) {
      form.set("contactEmail", user.email);
    } else if (replyPreference === "custom") {
      form.set("contactEmail", customEmail.trim());
    }
    const branch = branches.find((b) => b.id === branchId);
    if (branch) {
      form.set("branchId", branch.id);
      form.set("branchName", branch.name);
    }
    form.set("currentUrl", window.location.href);
    form.set("locale", language);
    for (const file of files) form.append("attachments", file);

    try {
      const result = await submitMutation.mutateAsync(form);
      setLastReference(result.reference);
      setSubject("");
      setMessage("");
      setFiles([]);
      toast.success(`Sent! Your reference is ${result.reference}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your request.");
    }
  }

  function handleVote(id: string) {
    voteMutation.mutate(id, {
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Could not register your vote."),
    });
  }

  const boardEntries = featureBoardQuery.data ?? [];

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Support Hub</h2>
        <p className="text-sm text-text-muted mt-1">
          Help center, direct line to the PrepIQ team, and feature voting.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border-default pb-4">
        {(
          [
            { id: "help", label: "Help & Guides", icon: <Search className="h-4 w-4" /> },
            { id: "contact", label: "Contact Us", icon: <ChatBubble className="h-4 w-4" /> },
            { id: "board", label: "Feature Board", icon: <LightBulb className="h-4 w-4" /> },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "bg-brand-gold text-background"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Help & Guides */}
      {activeTab === "help" && (
        <div className="space-y-8">
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

              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4">
                  System Status
                </h3>
                {systemStatusQuery.isLoading ? (
                  <p className="text-sm text-text-muted">Loading status...</p>
                ) : systemStatusQuery.data ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <SystemStatusCard label="Forecast Engine" status={systemStatusQuery.data.forecast_engine} />
                    <SystemStatusCard label="POS Integrations" status={systemStatusQuery.data.pos_integrations} />
                    <SystemStatusCard label="Data Sync" status={systemStatusQuery.data.data_sync} />
                    <SystemStatusCard label="API Services" status={systemStatusQuery.data.api_services} />
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">Unable to load system status.</p>
                )}
              </div>

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
            </div>
          )}
        </div>
      )}

      {/* Contact Us — unified intake for bugs, features, questions, feedback */}
      {activeTab === "contact" && (
        <div className="max-w-3xl space-y-6">
          {lastReference && (
            <div className="p-4 rounded-xl bg-status-success/10 border border-status-success/20 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-status-success shrink-0" />
              <p className="text-sm text-text-primary">
                Thanks — your message reached the PrepIQ team. Reference{" "}
                <span className="font-mono text-brand-gold">{lastReference}</span>.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-3">
                What&apos;s this about?
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CONTACT_TYPES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setContactType(option.value)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                      contactType === option.value
                        ? "border-brand-gold bg-brand-gold/10"
                        : "border-border-default bg-surface-2 hover:bg-surface-3"
                    }`}
                  >
                    <span
                      className={
                        contactType === option.value ? "text-brand-gold" : "text-text-muted"
                      }
                    >
                      {option.icon}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-text-primary">
                        {option.label}
                      </span>
                      <span className="block text-xs text-text-muted mt-0.5">
                        {option.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="One line summing it up"
                required
                maxLength={200}
                className="w-full h-12 px-4 rounded-lg bg-surface-3 border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                Details
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={MESSAGE_PLACEHOLDERS[contactType]}
                required
                rows={6}
                className="w-full px-4 py-3 rounded-lg bg-surface-3 border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Branch concerned (optional)"
                options={[
                  { value: "", label: "General / all branches" },
                  ...branches.map((b) => ({ value: b.id, label: b.name })),
                ]}
                value={branchId}
                onChange={(value) => setBranchId(value)}
              />

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                  Attachments
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt,.csv,.json"
                  className="hidden"
                  onChange={(e) => handleAddFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-12"
                >
                  <Attachment className="h-4 w-4 mr-2" />
                  Add screenshots or files
                </Button>
                <p className="text-[11px] text-text-muted mt-1.5">
                  Up to {MAX_FILES} files, 5 MB each. Images, PDF, or logs.
                </p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((file) => (
                  <span
                    key={`${file.name}-${file.size}`}
                    className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg bg-surface-3 border border-border-default text-xs text-text-primary"
                  >
                    {file.name}
                    <span className="text-text-muted">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((f) => f !== file))}
                      className="h-5 w-5 rounded flex items-center justify-center hover:bg-surface-2 text-text-muted hover:text-status-critical"
                      aria-label={`Remove ${file.name}`}
                    >
                      <Xmark className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-3">
                Where should we reply?
              </label>
              <div className="space-y-2">
                {(
                  [
                    {
                      value: "account",
                      label: `My account email${user?.email ? ` — ${user.email}` : ""}`,
                    },
                    { value: "custom", label: "A different email" },
                    { value: "none", label: "No reply needed — just letting you know" },
                  ] as { value: ReplyPreference; label: string }[]
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      replyPreference === option.value
                        ? "border-brand-gold/50 bg-brand-gold/5"
                        : "border-border-default bg-surface-2 hover:bg-surface-3"
                    }`}
                  >
                    <input
                      type="radio"
                      name="replyPreference"
                      value={option.value}
                      checked={replyPreference === option.value}
                      onChange={() => setReplyPreference(option.value)}
                      className="accent-[#C9A961]"
                    />
                    <span className="text-sm text-text-primary">{option.label}</span>
                  </label>
                ))}
                {replyPreference === "custom" && (
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="reply-here@yourdomain.com"
                    required
                    className="w-full h-11 px-4 rounded-lg bg-surface-3 border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 transition-all"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">
                Goes straight to the PrepIQ team with your account context attached.
              </p>
              <Button type="submit" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? "Sending..." : "Send to PrepIQ"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Feature Board — published requests, votable */}
      {activeTab === "board" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-text-muted">
              Features other kitchens asked for. Vote for what would help you most —
              submit new ideas via{" "}
              <button
                onClick={() => {
                  setContactType("FEATURE_REQUEST");
                  setActiveTab("contact");
                }}
                className="text-brand-gold hover:underline"
              >
                Contact Us
              </button>
              .
            </p>
          </div>
          {featureBoardQuery.isLoading ? (
            <p className="text-sm text-text-muted">Loading...</p>
          ) : featureBoardQuery.isError ? (
            <p className="text-sm text-text-muted p-4 rounded-lg bg-surface-2">
              The feature board is unavailable right now. Please try again later.
            </p>
          ) : boardEntries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {boardEntries.map((entry) => (
                <FeatureBoardCard
                  key={entry.id}
                  entry={entry}
                  onVote={handleVote}
                  voting={voteMutation.isPending && voteMutation.variables === entry.id}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted p-4 rounded-lg bg-surface-2">
              Nothing on the board yet. Be the first — send us a feature request!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
