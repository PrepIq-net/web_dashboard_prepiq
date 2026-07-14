"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useCurrentUserProfile, useMyOrganizations } from "@/services";
import {
  Building,
  Shop,
  Group,
  CloudSync,
  BellNotification,
  ShieldCheck,
  Brain,
  ArrowRight,
  Upload,
  InfoCircle,
  Plus,
  Trash,
  Edit,
  HelpCircle,
  Clock,
} from "iconoir-react";
import Link from "next/link";
import {
  useOrganizationDetail,
  useUpdateOrganization,
  useOrganizationMembers,
  useAddOrganizationMember,
  useUpdateOrganizationMember,
  useRemoveOrganizationMember,
  useOrganizationPermissions,
  useOrganizationRoles,
  useCreateOrganizationRole,
  useUpdateOrganizationRole,
  useDeleteOrganizationRole,
} from "@/services/organizations/hooks";
import {
  useBranches,
  useBranch,
  useUpdateBranch,
  useDeleteBranch,
} from "@/services/branches/hooks";
import { ConfirmActionModal } from "@/components/dashboard/today/confirm-action-modal";
import {
  useIntegrationsOverview,
  useSquareOAuthStart,
  useToastOAuthStart,
  useLoyverseOAuthStart,
  useCloverOAuthStart,
} from "@/services/production-intelligence/hooks";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useNotificationQuietHours,
  useUpdateNotificationQuietHours,
} from "@/services/notifications/hooks";
import { Switch } from "@/components/ui/switch";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Badge } from "@/components/ui/badge";
import {
  createColumnHelper,
  useReactTable,
  NativeTable,
} from "@/components/ui/native-table";
import { ModalShell } from "@/components/ui/modal-shell";
import type { OrganizationMember, Role } from "@/services/organizations/types";
import {
  SYSTEM_ROLE_OPTIONS,
  SYSTEM_ROLE_SLUG,
  PERMISSIONS,
  resolveMemberRoleLabel,
} from "@/services/organizations/types";
import { resolvePermissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import Image from "next/image";
import { SupportTabContent } from "@/components/dashboard/settings/support-tab";
import { WebPushPrimingCard } from "@/components/dashboard/settings/web-push-priming-card";
import { DangerZone } from "@/components/dashboard/settings/danger-zone";
import { ActiveSessions } from "@/components/dashboard/settings/active-sessions";
import { useTranslation } from "@/lib/i18n";

const columnHelper = createColumnHelper<any>();

type SettingsTab =
  | "organization"
  | "branches"
  | "users-roles"
  | "integrations"
  | "notifications"
  | "security"
  | "data-ai"
  | "support";

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  permission?: string;
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageContent />
    </Suspense>
  );
}

const VALID_SETTINGS_TABS: SettingsTab[] = [
  "organization",
  "branches",
  "users-roles",
  "integrations",
  "notifications",
  "security",
  "data-ai",
  "support",
];

function SettingsPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabFromUrl = searchParams.get("tab") as SettingsTab | null;
  const branchFromUrl = searchParams.get("branch") ?? undefined;

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (tabFromUrl && VALID_SETTINGS_TABS.includes(tabFromUrl)) return tabFromUrl;
    return "organization";
  });
  const { data: user } = useCurrentUserProfile();

  // When the user changes branch inside IntegrationsSettings, update the URL so
  // navigating away and back still shows the same branch.
  function handleIntegrationBranchChange(branchId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("branch", branchId);
    params.set("tab", "integrations");
    router.replace(`/workspace/settings?${params.toString()}`, { scroll: false });
  }
  const { data: organizations } = useMyOrganizations();
  const org = organizations?.[0];

  const userPermissions = resolvePermissions(user);

  const tabs: TabItem[] = [
    {
      id: "organization",
      label: t("settings.tabs.organization"),
      icon: <Building className="h-4 w-4" />,
      permission: PERMISSIONS.MANAGE_ORG_SETTINGS,
    },
    {
      id: "branches",
      label: t("settings.tabs.branches"),
      icon: <Shop className="h-4 w-4" />,
      permission: PERMISSIONS.MANAGE_BRANCHES,
    },
    {
      id: "users-roles",
      label: t("settings.tabs.usersRoles"),
      icon: <Group className="h-4 w-4" />,
      permission: PERMISSIONS.MANAGE_TEAM,
    },
    {
      id: "integrations",
      label: t("settings.tabs.integrations"),
      icon: <CloudSync className="h-4 w-4" />,
      permission: PERMISSIONS.MANAGE_INTEGRATIONS,
    },
    {
      id: "notifications",
      label: t("settings.tabs.notifications"),
      icon: <BellNotification className="h-4 w-4" />,
    },
    {
      id: "security",
      label: t("settings.tabs.security"),
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      id: "data-ai",
      label: t("settings.tabs.dataAI"),
      icon: <Brain className="h-4 w-4" />,
    },
    {
      id: "support",
      label: t("settings.tabs.support"),
      icon: <HelpCircle className="h-4 w-4" />,
    },
  ];

  const filteredTabs = tabs.filter(
    (tab) => !tab.permission || userPermissions.has(tab.permission),
  );

  // Once permissions resolve, snap activeTab to the first tab the user can see.
  // Without this a user starts on "organization" (the default) even if that
  // tab is hidden for them, which would render the org settings component.
  useEffect(() => {
    if (user && !filteredTabs.some((t) => t.id === activeTab)) {
      const fallback = filteredTabs[0]?.id;
      if (fallback) setActiveTab(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <WorkspaceShell
      eyebrow={t("settings.shell.eyebrow")}
      title={t("settings.shell.title")}
      description={t("settings.shell.description")}
      insight={t("settings.shell.insight")}
    >
      <div className="flex flex-col md:flex-row gap-8 mt-4">
        {/* Settings Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col space-y-1">
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-[#1C1C1F] text-brand-gold shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-[#2A2A2E]"
                    : "text-text-secondary hover:bg-[#1C1C1F]/50 hover:text-text-primary"
                }`}
              >
                <span
                  className={`${activeTab === tab.id ? "text-brand-gold" : "text-text-muted"}`}
                >
                  {tab.icon}
                </span>
                {tab.label}
                {activeTab === tab.id && (
                  <ArrowRight className="h-3 w-3 ml-auto opacity-50" />
                )}
              </button>
            ))}
          </nav>

        </aside>

        {/* Content Panel */}
        <main className="flex-1 min-w-0 bg-[#141416] rounded-2xl border border-[#1C1C1F] p-6 md:p-8">
          {activeTab === "organization" && (
            <OrganizationSettings orgId={org?.id} />
          )}
          {activeTab === "branches" && <BranchSettings orgId={org?.id} focusedBranchId={branchFromUrl} />}
          {activeTab === "users-roles" && <UserRoleSettings orgId={org?.id} />}
          {activeTab === "integrations" && (
            <IntegrationsSettings
              orgId={org?.id}
              focusedBranchId={branchFromUrl}
              onBranchChange={handleIntegrationBranchChange}
            />
          )}
          {activeTab === "notifications" && <NotificationsSettings />}
          {activeTab === "security" && (
            <div className="space-y-10">
              <ActiveSessions />
              <DangerZone orgId={org?.id} />
            </div>
          )}
          {activeTab === "support" && <SupportTabContent />}
          {/* Placeholder for tabs not yet built */}
          {![
            "organization",
            "branches",
            "users-roles",
            "integrations",
            "notifications",
            "security",
            "support",
          ].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-12 w-12 rounded-full bg-[#1C1C1F] flex items-center justify-center mb-4">
                {tabs.find((t) => t.id === activeTab)?.icon}
              </div>
              <h3 className="text-lg font-medium text-text-primary">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h3>
              <p className="text-sm text-text-muted mt-1">
                {t("settings.underDevelopment")}
              </p>
            </div>
          )}
        </main>
      </div>
    </WorkspaceShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function OrganizationSettings({ orgId }: { orgId?: string }) {
  const { t } = useTranslation();
  const { data: org, isLoading } = useOrganizationDetail(orgId || "");
  const updateOrg = useUpdateOrganization(orgId || "");
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (org && !formData) {
      setFormData({
        name: org.name || "",
        business_type: org.business_type || "RESTAURANT",
        timezone: org.timezone || "UTC",
        currency: org.currency || "USD",
        country: org.country || "",
        brand_color: org.brand_color || "#A8821F",
        receipt_name: org.receipt_name || "",
        default_prep_buffer_minutes: org.default_prep_buffer_minutes || 30,
        forecast_horizon_days: org.forecast_horizon_days || 7,
      });
    }
  }, [org, formData]);

  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  const handleSave = () => {
    updateOrg.mutate(formData, {
      onSuccess: () => {
        toast.success(t("settings.organization.updated"));
      },
    });
  };

  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            {t("settings.organization.title")}
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {t("settings.organization.description")}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateOrg.isPending}
          className="font-semibold px-6"
        >
          {updateOrg.isPending ? t("settings.organization.saving") : t("settings.organization.saveChanges")}
        </Button>
      </div>

      {/* General Settings */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <InfoCircle className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.organization.general")}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label={t("settings.organization.orgName")}
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder={t("settings.organization.orgNamePlaceholder")}
          />
          <Select
            label={t("settings.organization.businessType")}
            value={formData.business_type}
            onChange={(val: string) => handleChange("business_type", val)}
            options={[
              { label: t("settings.organization.businessTypeOptions.restaurant"), value: "RESTAURANT" },
              { label: t("settings.organization.businessTypeOptions.hotel"), value: "HOTEL" },
              { label: t("settings.organization.businessTypeOptions.bakery"), value: "BAKERY" },
              { label: t("settings.organization.businessTypeOptions.cloudKitchen"), value: "CLOUD_KITCHEN" },
              { label: t("settings.organization.businessTypeOptions.catering"), value: "CATERING" },
              { label: t("settings.organization.businessTypeOptions.institutional"), value: "INSTITUTIONAL" },
            ]}
          />
          <Select
            label={t("settings.organization.timezone")}
            value={formData.timezone}
            onChange={(val: string) => handleChange("timezone", val)}
            options={[
              { label: t("settings.organization.timezoneOptions.utc"), value: "UTC" },
              { label: t("settings.organization.timezoneOptions.eastern"), value: "America/New_York" },
              { label: t("settings.organization.timezoneOptions.pacific"), value: "America/Los_Angeles" },
              { label: t("settings.organization.timezoneOptions.london"), value: "Europe/London" },
              { label: t("settings.organization.timezoneOptions.eastAfrica"), value: "Africa/Nairobi" },
            ]}
          />
          <Select
            label={t("settings.organization.defaultCurrency")}
            value={formData.currency}
            onChange={(val: string) => handleChange("currency", val)}
            options={[
              { label: t("settings.organization.currencyOptions.usd"), value: "USD" },
              { label: t("settings.organization.currencyOptions.eur"), value: "EUR" },
              { label: t("settings.organization.currencyOptions.gbp"), value: "GBP" },
              { label: t("settings.organization.currencyOptions.kes"), value: "KES" },
            ]}
          />
        </div>
      </section>

      {/* Branding */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <Building className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.organization.branding")}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <span className="text-sm font-medium text-text-secondary">
              {t("settings.organization.orgLogo")}
            </span>
            <div className="flex items-center gap-6">
              <div className="h-24 w-24 rounded-2xl bg-[#1C1C1F] border border-[#2A2A2E] flex items-center justify-center overflow-hidden relative group">
                {org?.logo ? (
                  <Image
                    src={org.logo}
                    alt="Logo"
                    fill
                    className="object-contain p-2"
                  />
                ) : (
                  <Building className="h-8 w-8 text-text-muted" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <Upload className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-text-primary">
                  {t("settings.organization.updateLogo")}
                </p>
                <p className="text-xs text-text-muted">
                  {t("settings.organization.logoHint")}
                </p>
                <Button
                  variant="secondary"
                  className="mt-2 text-[11px] h-8 px-3"
                >
                  {t("settings.organization.uploadNew")}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex gap-3 items-end">
              <Input
                label={t("settings.organization.brandColor")}
                value={formData.brand_color}
                onChange={(e) => handleChange("brand_color", e.target.value)}
                className="font-mono uppercase"
              />
              <div
                className="h-12 w-12 rounded-lg border border-[#2A2A2E] shrink-0 mb-px"
                style={{ backgroundColor: formData.brand_color }}
              />
            </div>
            <Input
              label={t("settings.organization.receiptName")}
              value={formData.receipt_name}
              onChange={(e) => handleChange("receipt_name", e.target.value)}
              placeholder={t("settings.organization.receiptNamePlaceholder")}
            />
          </div>
        </div>
      </section>

      {/* Operational Defaults */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <Brain className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.organization.operationalDefaults")}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label={t("settings.organization.defaultPrepBuffer")}
            type="number"
            value={formData.default_prep_buffer_minutes}
            onChange={(e) =>
              handleChange(
                "default_prep_buffer_minutes",
                parseInt(e.target.value),
              )
            }
          />
          <Input
            label={t("settings.organization.forecastHorizon")}
            type="number"
            value={formData.forecast_horizon_days}
            onChange={(e) =>
              handleChange("forecast_horizon_days", parseInt(e.target.value))
            }
          />
        </div>
      </section>

      {/* Language */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <InfoCircle className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.organization.language")}
          </h3>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-3">
            {t("settings.organization.languageDescription")}
          </p>
          <LanguageSwitcher />
        </div>
      </section>
    </div>
  );
}

const POS_SYSTEMS = [
  { id: "square", name: "Square" },
  { id: "toast", name: "Toast" },
  { id: "clover", name: "Clover" },
  { id: "loyverse", name: "Loyverse" },
  { id: "lightspeed", name: "Lightspeed" },
];

function IntegrationsSettings({
  orgId,
  focusedBranchId,
  onBranchChange,
}: {
  orgId?: string;
  focusedBranchId?: string;
  onBranchChange?: (branchId: string) => void;
}) {
  const { t } = useTranslation();
  const branchesQuery = useBranches(orgId ?? "");
  const branches = branchesQuery.data ?? [];

  const [selectedBranchId, setSelectedBranchId] = useState(focusedBranchId ?? "");
  const initDone = useRef(false);

  // Initialize exactly once when branches first load — never resets on user changes.
  useEffect(() => {
    if (initDone.current || branches.length === 0) return;
    initDone.current = true;
    const preferred =
      focusedBranchId && branches.some((b) => b.id === focusedBranchId)
        ? focusedBranchId
        : branches[0].id;
    setSelectedBranchId(preferred);
  }, [branches, focusedBranchId]);

  const integrationsQuery = useIntegrationsOverview({
    organization_id: orgId ?? "00000000-0000-0000-0000-000000000000",
    branch_id: selectedBranchId || "00000000-0000-0000-0000-000000000000",
  });

  const squareOAuth = useSquareOAuthStart();
  const toastOAuth = useToastOAuthStart();
  const loyverseOAuth = useLoyverseOAuthStart();
  const cloverOAuth = useCloverOAuthStart();

  const summary = integrationsQuery.data?.summary;
  // API now filters by branch_id, so the first (and only) item is our branch.
  const branchStatus =
    integrationsQuery.data?.branches.find((b) => b.branch_id === selectedBranchId) ??
    integrationsQuery.data?.branches?.[0];
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const isConnected = branchStatus?.status === "CONNECTED";
  const isFocusedBranchWithIssue =
    !!focusedBranchId && focusedBranchId === selectedBranchId && !isConnected;

  function handleBranchChange(branchId: string) {
    setSelectedBranchId(branchId);
    onBranchChange?.(branchId);
  }

  const handleConnect = (posId: string) => {
    const branch_id = selectedBranchId || "00000000-0000-0000-0000-000000000000";
    if (posId === "square") {
      squareOAuth.mutate({ branch_id });
    } else if (posId === "toast") {
      toastOAuth.mutate({ branch_id, client_id: "placeholder", client_secret: "placeholder" });
    } else if (posId === "loyverse") {
      loyverseOAuth.mutate({ branch_id });
    } else if (posId === "clover") {
      cloverOAuth.mutate({ branch_id });
    } else {
      toast.error(t("settings.integrations.connectionNotImplemented", { posId }));
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary">{t("settings.integrations.title")}</h2>
        <p className="text-sm text-text-muted mt-1">
          {t("settings.integrations.description")}
        </p>
      </div>

      {/* Org-wide summary chips */}
      {summary && (
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-surface-4 px-3 py-1 text-xs text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-status-ok" />
            {t("settings.integrations.branchesConnected", { count: summary.active_connections, total: summary.total_branches })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-surface-4 px-3 py-1 text-xs text-text-muted">
            {t("settings.integrations.syncHealth", { pct: summary.health_pct })}
          </span>
        </div>
      )}

      {/* Branch picker */}
      <Select
        label={t("settings.integrations.integrationFor")}
        options={branches.map((b) => ({ value: b.id, label: b.name }))}
        value={selectedBranchId}
        onChange={handleBranchChange}
        placeholder={branches.length === 0 ? t("settings.integrations.loadingBranches") : t("settings.integrations.selectBranch")}
        disabled={branches.length === 0}
        className="max-w-xs"
      />

      {/* Selected branch status */}
      {integrationsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          Loading…
        </div>
      ) : branchStatus ? (
        <div
          className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${
            isConnected
              ? "border-status-ok/25 bg-status-ok/6"
              : "border-status-critical/25 bg-status-critical/6"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-status-ok" : "bg-status-critical"
              }`}
            />
            <div>
              <p className="text-sm font-medium text-text-primary">
                {selectedBranch?.name ?? "Branch"} —{" "}
                  {isConnected ? t("settings.integrations.posConnected") : t("settings.integrations.noPosConnected")}
              </p>
              {branchStatus.last_sync && (
                <p className="text-xs text-text-muted mt-0.5">
                  {t("settings.integrations.lastSync")}{" "}
                  {new Date(branchStatus.last_sync).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
          </div>
          {isConnected && (
            <Badge variant="outline" className="text-[10px] text-status-ok border-status-ok/40">
              {t("settings.integrations.active")}
            </Badge>
          )}
        </div>
      ) : selectedBranch ? (
        <div className="flex items-center gap-3 rounded-2xl border border-surface-4 px-5 py-4 text-sm text-text-muted">
          <span className="h-2 w-2 rounded-full bg-text-muted/30" />
          {t("settings.integrations.noIntegrationData", { name: selectedBranch.name })}
        </div>
      ) : null}

      {/* Context banner — shown when arriving from dashboard with a POS issue */}
      {isFocusedBranchWithIssue && (
        <div className="flex items-start gap-3 rounded-xl border border-status-warning/30 bg-status-warning/8 px-4 py-4">
          <InfoCircle className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {t("settings.integrations.posIssueTitle", { name: selectedBranch?.name ?? "" })}
            </p>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              {t("settings.integrations.posIssueDescription")}
            </p>
          </div>
        </div>
      )}

      {/* POS Systems */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <Shop className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.integrations.sectionPos")}
          </h3>
          {selectedBranch && (
            <span className="ml-auto text-xs text-text-muted">
              {isConnected ? t("settings.integrations.isConnectedSuffix", { name: selectedBranch.name }) : t("settings.integrations.connectFor", { name: selectedBranch.name })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {POS_SYSTEMS.map((pos) => (
            <div
              key={pos.id}
              className="p-5 rounded-2xl bg-[#1C1C1F]/50 border border-[#1C1C1F] flex items-center justify-between group hover:border-[#2A2A2E] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#1C1C1F] flex items-center justify-center text-text-muted group-hover:text-brand-gold transition-colors">
                  <Shop className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">{t(`settings.integrations.posSystems.${pos.id}`)}</p>
                  <Badge variant="outline" className="mt-1 text-[10px] opacity-60">
                    {isConnected ? t("settings.integrations.connected") : t("settings.integrations.notConnected")}
                  </Badge>
                </div>
              </div>
              {!isConnected && (
                <Button
                  variant="secondary"
                  onClick={() => handleConnect(pos.id)}
                  disabled={!selectedBranchId}
                  className="h-9 px-4 text-xs font-semibold"
                >
                  {t("settings.integrations.connect")}
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <CloudSync className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.integrations.sectionAccounting")}
          </h3>
        </div>

        <div className="p-10 rounded-2xl border border-dashed border-[#1C1C1F] text-center bg-[#1C1C1F]/20">
          <CloudSync className="h-10 w-10 text-text-muted mx-auto mb-4 opacity-20" />
          <p className="text-sm text-text-muted max-w-xs mx-auto">
            {t("settings.integrations.privateBeta")}
          </p>
        </div>
      </section>
    </div>
  );
}

const DIGEST_ELIGIBLE_CATEGORIES = ["LEARNING", "EXECUTIVE"];

function NotificationsSettings() {
  const { t } = useTranslation();
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const [localPrefs, setLocalPrefs] = useState<any[]>([]);

  const { data: quietHours, isLoading: quietHoursLoading } = useNotificationQuietHours();
  const updateQuietHours = useUpdateNotificationQuietHours();
  const [localQuietHours, setLocalQuietHours] = useState<{
    enabled: boolean;
    start_time: string;
    end_time: string;
  } | null>(null);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  useEffect(() => {
    if (quietHours && !localQuietHours) {
      setLocalQuietHours({
        enabled: quietHours.enabled,
        start_time: quietHours.start_time.slice(0, 5),
        end_time: quietHours.end_time.slice(0, 5),
      });
    }
  }, [quietHours, localQuietHours]);

  const handleToggle = (notificationCategory: string, channel: string, enabled: boolean) => {
    const updated = localPrefs.map((p) =>
      p.notification_category === notificationCategory
        ? { ...p, [`${channel}_enabled`]: enabled }
        : p,
    );
    setLocalPrefs(updated);
    updatePreferences.mutate(updated);
  };

  const handleDigestToggle = (notificationCategory: string, enabled: boolean) => {
    const updated = localPrefs.map((p) =>
      p.notification_category === notificationCategory
        ? { ...p, digest_mode: enabled }
        : p,
    );
    setLocalPrefs(updated);
    updatePreferences.mutate(updated);
  };

  const handleQuietHoursChange = (patch: Partial<{ enabled: boolean; start_time: string; end_time: string }>) => {
    const updated = { ...(localQuietHours ?? { enabled: false, start_time: "23:00", end_time: "07:00" }), ...patch };
    setLocalQuietHours(updated);
    updateQuietHours.mutate(updated);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  const notificationTypes = [
    {
      notification_category: "OPERATIONAL",
      label: t("settings.notifications.types.operational"),
      description: t("settings.notifications.types.operationalDesc"),
    },
    {
      notification_category: "PLANNING",
      label: t("settings.notifications.types.planning"),
      description: t("settings.notifications.types.planningDesc"),
    },
    {
      notification_category: "LIVE_SERVICE",
      label: t("settings.notifications.types.liveService"),
      description: t("settings.notifications.types.liveServiceDesc"),
    },
    {
      notification_category: "LEARNING",
      label: t("settings.notifications.types.learning"),
      description: t("settings.notifications.types.learningDesc"),
    },
    {
      notification_category: "EXECUTIVE",
      label: t("settings.notifications.types.executive"),
      description: t("settings.notifications.types.executiveDesc"),
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          {t("settings.notifications.title")}
        </h2>
        <p className="text-sm text-text-muted mt-1">
          {t("settings.notifications.description")}
        </p>
      </div>

      <WebPushPrimingCard />

      <div className="rounded-2xl border border-[#1C1C1F] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#1C1C1F]/50">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                {t("settings.notifications.tableHeader.type")}
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-center">
                {t("settings.notifications.tableHeader.inApp")}
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-center">
                {t("settings.notifications.tableHeader.email")}
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-center">
                {t("settings.notifications.tableHeader.push")}
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-center">
                {t("settings.notifications.tableHeader.digest")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1C1C1F]/50">
            {notificationTypes.map((type) => {
              const pref = localPrefs.find(
                (p) => p.notification_category === type.notification_category,
              ) || {
                notification_category: type.notification_category,
                in_app_enabled: true,
                email_enabled: true,
                push_enabled: true,
                digest_mode: false,
              };
              const digestEligible = DIGEST_ELIGIBLE_CATEGORIES.includes(type.notification_category);

              return (
                <tr
                  key={type.notification_category}
                  className="hover:bg-[#1C1C1F]/20 transition-colors"
                >
                  <td className="px-6 py-5">
                    <p className="text-sm font-medium text-text-primary">
                      {type.label}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {type.description}
                    </p>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <Switch
                      checked={pref.in_app_enabled}
                      onCheckedChange={(val) =>
                        handleToggle(type.notification_category, "in_app", val)
                      }
                    />
                  </td>
                  <td className="px-6 py-5 text-center">
                    <Switch
                      checked={pref.email_enabled}
                      onCheckedChange={(val) =>
                        handleToggle(type.notification_category, "email", val)
                      }
                    />
                  </td>
                  <td className="px-6 py-5 text-center">
                    <Switch
                      checked={pref.push_enabled}
                      onCheckedChange={(val) =>
                        handleToggle(type.notification_category, "push", val)
                      }
                    />
                  </td>
                  <td className="px-6 py-5 text-center">
                    {digestEligible ? (
                      <span
                        title={
                          !pref.email_enabled
                            ? t("settings.notifications.digestRequiresEmail")
                            : undefined
                        }
                      >
                        <Switch
                          checked={!!pref.digest_mode}
                          disabled={!pref.email_enabled}
                          onCheckedChange={(val) =>
                            handleDigestToggle(type.notification_category, val)
                          }
                        />
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-6 rounded-2xl bg-[#1C1C1F]/50 border border-[#1C1C1F] flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold shrink-0">
          <InfoCircle className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-text-primary">
            {t("settings.notifications.escalationTitle")}
          </h4>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            {t("settings.notifications.escalationDescription")}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <Clock className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {t("settings.notifications.quietHours.title")}
          </h3>
        </div>
        <p className="text-xs text-text-muted">
          {t("settings.notifications.quietHours.description")}
        </p>

        {quietHoursLoading || !localQuietHours ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-gold" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-end gap-4 p-5 rounded-2xl bg-[#1C1C1F]/50 border border-[#1C1C1F]">
            <div className="flex items-center gap-3">
              <Switch
                checked={localQuietHours.enabled}
                onCheckedChange={(val) => handleQuietHoursChange({ enabled: val })}
              />
              <span className="text-sm text-text-primary">
                {t("settings.notifications.quietHours.enable")}
              </span>
            </div>
            <Input
              label={t("settings.notifications.quietHours.start")}
              type="time"
              value={localQuietHours.start_time}
              disabled={!localQuietHours.enabled}
              onChange={(e) => handleQuietHoursChange({ start_time: e.target.value })}
              className="max-w-[140px]"
            />
            <Input
              label={t("settings.notifications.quietHours.end")}
              type="time"
              value={localQuietHours.end_time}
              disabled={!localQuietHours.enabled}
              onChange={(e) => handleQuietHoursChange({ end_time: e.target.value })}
              className="max-w-[140px]"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function BranchSettings({ orgId, focusedBranchId }: { orgId?: string; focusedBranchId?: string }) {
  const { t } = useTranslation();
  const { data: branches, isLoading: loadingBranches } = useBranches(
    orgId || "",
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const { data: branch, isLoading: loadingBranch } = useBranch(
    orgId || "",
    selectedBranchId,
  );
  const updateBranch = useUpdateBranch(orgId || "", selectedBranchId);
  const deleteBranch = useDeleteBranch(orgId || "");
  const [deleteBranchOpen, setDeleteBranchOpen] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  const isLastBranch = (branches?.length ?? 0) <= 1;

  const handleDeleteBranch = () => {
    if (!selectedBranchId) return;
    deleteBranch.mutate(selectedBranchId, {
      onSuccess: () => {
        setDeleteBranchOpen(false);
        setSelectedBranchId("");
      },
    });
  };

  // Default to focusedBranchId from URL, then first branch
  useEffect(() => {
    if (!branches?.length || selectedBranchId) return;
    const target = focusedBranchId && branches.some((b) => b.id === focusedBranchId)
      ? focusedBranchId
      : branches[0].id;
    setSelectedBranchId(target);
  }, [branches, focusedBranchId, selectedBranchId]);

  // Sync form data when branch details are loaded
  useEffect(() => {
    if (branch) {
      setFormData({
        name: branch.name || "",
        address: branch.address || "",
        timezone: branch.timezone || "UTC",
        capacity: branch.capacity || 0,
        average_prep_time_minutes: branch.average_prep_time_minutes || 15,
        service_start_time: branch.service_start_time || "",
        service_end_time: branch.service_end_time || "",
        seasonality_profile: branch.seasonality_profile || "",
        min_stock_buffer: branch.min_stock_buffer || 10,
        waste_threshold: branch.waste_threshold || 0.05,
        reorder_buffer: branch.reorder_buffer || 5,
      });
    }
  }, [branch]);

  const handleSave = () => {
    updateBranch.mutate(formData, {
      onSuccess: () => {
        toast.success(t("settings.branch.updated"));
      },
    });
  };

  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  if (loadingBranches) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  const branchOptions =
    branches?.map((b) => ({
      label: b.name,
      value: b.id,
    })) || [];

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            {t("settings.branch.title")}
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {t("settings.branch.description")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-48">
            <Select
              value={selectedBranchId}
              onChange={setSelectedBranchId}
              options={branchOptions}
              placeholder={t("settings.branch.selectBranchPlaceholder")}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={updateBranch.isPending || !selectedBranchId}
            className="font-semibold px-6"
          >
            {updateBranch.isPending ? t("settings.branch.saving") : t("settings.branch.saveChanges")}
          </Button>
        </div>
      </div>

      {!selectedBranchId ? (
        <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-[#1C1C1F] rounded-2xl">
          <Shop className="h-8 w-8 text-text-muted mb-3" />
          <p className="text-sm text-text-muted">
            {t("settings.branch.noBranchSelected")}
          </p>
        </div>
      ) : loadingBranch || !formData ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* General */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
              <Shop className="h-4 w-4 text-brand-gold" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                {t("settings.branch.general")}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t("settings.branch.branchName")}
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
              <Input
                label={t("settings.branch.address")}
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
              <Select
                label={t("settings.branch.timezone")}
                value={formData.timezone}
                onChange={(val: string) => handleChange("timezone", val)}
                options={[
                  { label: t("settings.organization.timezoneOptions.utc"), value: "UTC" },
                  { label: t("settings.organization.timezoneOptions.eastern"), value: "America/New_York" },
                  { label: t("settings.organization.timezoneOptions.pacific"), value: "America/Los_Angeles" },
                  { label: t("settings.organization.timezoneOptions.london"), value: "Europe/London" },
                  { label: t("settings.organization.timezoneOptions.eastAfrica"), value: "Africa/Nairobi" },
                ]}
              />
            </div>
          </section>

          {/* Kitchen Configuration */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
              <Brain className="h-4 w-4 text-brand-gold" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                {t("settings.branch.kitchenConfiguration")}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t("settings.branch.kitchenCapacity")}
                type="number"
                value={formData.capacity}
                onChange={(e) =>
                  handleChange("capacity", parseInt(e.target.value))
                }
              />
              <Input
                label={t("settings.branch.avgPrepTime")}
                type="number"
                value={formData.average_prep_time_minutes}
                onChange={(e) =>
                  handleChange(
                    "average_prep_time_minutes",
                    parseInt(e.target.value),
                  )
                }
              />
              <Input
                label={t("settings.branch.serviceStartTime")}
                type="time"
                value={formData.service_start_time}
                onChange={(e) =>
                  handleChange("service_start_time", e.target.value)
                }
              />
              <Input
                label={t("settings.branch.serviceEndTime")}
                type="time"
                value={formData.service_end_time}
                onChange={(e) =>
                  handleChange("service_end_time", e.target.value)
                }
              />
            </div>
          </section>

          {/* Demand Context */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
              <CloudSync className="h-4 w-4 text-brand-gold" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                {t("settings.branch.demandContext")}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t("settings.branch.seasonalityProfile")}
                value={formData.seasonality_profile}
                onChange={(e) =>
                  handleChange("seasonality_profile", e.target.value)
                }
                placeholder={t("settings.branch.seasonalityPlaceholder")}
              />
              <div className="p-4 rounded-xl bg-[#1C1C1F]/50 border border-[#2A2A2E] flex items-start gap-3">
                <InfoCircle className="h-5 w-5 text-brand-gold shrink-0 mt-0.5" />
                <p className="text-xs text-text-muted leading-relaxed">
                  {t("settings.branch.demandContextBefore")}
                  <span className="text-brand-gold font-medium">
                    {" "}
                    {t("settings.branch.intelligenceEngine")}
                  </span>{" "}
                  {t("settings.branch.demandContextAfter")}
                </p>
              </div>
            </div>
          </section>

          {/* Inventory Rules */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
              <ShieldCheck className="h-4 w-4 text-brand-gold" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                {t("settings.branch.inventoryRules")}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input
                label={t("settings.branch.minStockBuffer")}
                type="number"
                value={formData.min_stock_buffer}
                onChange={(e) =>
                  handleChange("min_stock_buffer", parseInt(e.target.value))
                }
              />
              <Input
                label={t("settings.branch.wasteThreshold")}
                type="number"
                step="0.01"
                value={formData.waste_threshold}
                onChange={(e) =>
                  handleChange("waste_threshold", parseFloat(e.target.value))
                }
              />
              <Input
                label={t("settings.branch.reorderBuffer")}
                type="number"
                value={formData.reorder_buffer}
                onChange={(e) =>
                  handleChange("reorder_buffer", parseInt(e.target.value))
                }
              />
            </div>
          </section>

          {/* Danger zone — delete this branch */}
          <section className="space-y-4">
            <div className="border-l-4 border-status-critical/60 bg-[#141416] rounded-r-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
              <div className="flex items-start gap-3">
                <Trash className="h-5 w-5 text-status-critical mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t("settings.branch.delete.title")}
                  </h3>
                  <p className="text-sm text-text-muted mt-1">
                    {isLastBranch
                      ? t("settings.branch.delete.lastBranch")
                      : t("settings.branch.delete.description")}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                disabled={isLastBranch}
                onClick={() => setDeleteBranchOpen(true)}
                className="shrink-0"
              >
                {t("settings.branch.delete.button")}
              </Button>
            </div>
          </section>
        </div>
      )}

      <ConfirmActionModal
        open={deleteBranchOpen}
        title={t("settings.branch.delete.title")}
        description={t("settings.branch.delete.confirm", { name: branch?.name ?? "" })}
        confirmLabel={t("settings.branch.delete.button")}
        tone="critical"
        isConfirming={deleteBranch.isPending}
        onClose={() => setDeleteBranchOpen(false)}
        onConfirm={handleDeleteBranch}
      />
    </div>
  );
}

function UserRoleSettings({ orgId }: { orgId?: string }) {
  const { t } = useTranslation();
  const { data: members, isLoading: membersLoading } = useOrganizationMembers(
    orgId || "",
  );
  const { data: permissions } = useOrganizationPermissions(orgId || "");
  const { data: roles } = useOrganizationRoles(orgId || "");
  const addMember = useAddOrganizationMember(orgId || "");
  const updateMember = useUpdateOrganizationMember(orgId || "");
  const removeMember = useRemoveOrganizationMember(orgId || "");
  const createRole = useCreateOrganizationRole(orgId || "");
  const updateRole = useUpdateOrganizationRole(orgId || "");
  const deleteRole = useDeleteOrganizationRole(orgId || "");

  // Members modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    user_email: "",
    custom_role_slug: SYSTEM_ROLE_OPTIONS[2].value as string,
  });

  // Custom roles modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleFormMode, setRoleFormMode] = useState<"create" | "edit">("create");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    slug: "",
    permission_codes: [] as string[],
  });
  const [isConfirmRoleDeleteOpen, setIsConfirmRoleDeleteOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isConfirmMemberRemoveOpen, setIsConfirmMemberRemoveOpen] =
    useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{
    userId: string;
    label: string;
  } | null>(null);

  // Get all available roles for member dropdown (system + custom)
  const availableRoles = [
    ...SYSTEM_ROLE_OPTIONS,
    ...(roles
      ?.filter((r) => !r.is_system)
      .map((r) => ({ label: r.name, value: r.slug })) || []),
  ];

  const handleAddMember = () => {
    addMember.mutate(newMember, {
      onSuccess: () => {
        setIsAddModalOpen(false);
        setNewMember({
          user_email: "",
          custom_role_slug: SYSTEM_ROLE_OPTIONS[2].value,
        });
      },
    });
  };

  const handleUpdateRole = (userId: string, custom_role_slug: string) => {
    updateMember.mutate({ userId, custom_role_slug });
  };

  const handleRemoveMember = (userId: string, label: string) => {
    setMemberToRemove({ userId, label });
    setIsConfirmMemberRemoveOpen(true);
  };

  const handleConfirmRemoveMember = () => {
    if (!memberToRemove) return;
    removeMember.mutate(memberToRemove.userId, {
      onSettled: () => {
        setMemberToRemove(null);
        setIsConfirmMemberRemoveOpen(false);
      },
    });
  };

  // Custom role handlers
  const handleOpenNewRoleModal = () => {
    setRoleFormMode("create");
    setEditingRoleId(null);
    setRoleForm({
      name: "",
      description: "",
      slug: "",
      permission_codes: [],
    });
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRoleModal = (role: Role) => {
    setRoleFormMode("edit");
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      description: role.description || "",
      slug: role.slug,
      permission_codes: role.permission_codes,
    });
    setIsRoleModalOpen(true);
  };

  const handleTogglePermission = (permissionCode: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permission_codes: prev.permission_codes.includes(permissionCode)
        ? prev.permission_codes.filter((p) => p !== permissionCode)
        : [...prev.permission_codes, permissionCode],
    }));
  };

  const handleSaveRole = () => {
    if (!roleForm.name.trim()) {
      toast.error(t("settings.roles.modal.nameError"));
      return;
    }

    const payload = {
      name: roleForm.name,
      description: roleForm.description || undefined,
      slug: roleForm.slug || undefined,
      permission_codes: roleForm.permission_codes,
    };

    if (roleFormMode === "create") {
      createRole.mutate(payload, {
        onSuccess: () => {
          setIsRoleModalOpen(false);
          setRoleForm({
            name: "",
            description: "",
            slug: "",
            permission_codes: [],
          });
        },
      });
    } else if (editingRoleId) {
      updateRole.mutate(
        { roleId: editingRoleId, payload },
        {
          onSuccess: () => {
            setIsRoleModalOpen(false);
            setRoleForm({
              name: "",
              description: "",
              slug: "",
              permission_codes: [],
            });
            setEditingRoleId(null);
          },
        },
      );
    }
  };

  const handleDeleteRole = (roleId: string, roleName: string) => {
    setRoleToDelete({ id: roleId, name: roleName });
    setIsConfirmRoleDeleteOpen(true);
  };

  const handleConfirmDeleteRole = () => {
    if (!roleToDelete) return;
    deleteRole.mutate(roleToDelete.id, {
      onSettled: () => {
        setRoleToDelete(null);
        setIsConfirmRoleDeleteOpen(false);
      },
    });
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "user",
        header: t("settings.users.table.user"),
        cell: (info) => {
          const member = info.row.original as OrganizationMember;
          return (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[#1C1C1F] flex items-center justify-center text-xs font-semibold text-brand-gold border border-[#2A2A2E]">
                {member.first_name?.[0] || member.email?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {member.first_name} {member.last_name}
                </p>
                <p className="text-xs text-text-muted">{member.email}</p>
              </div>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "role",
        header: t("settings.users.table.role"),
        cell: (info) => {
          const member = info.row.original as OrganizationMember;
          const currentSlug =
            member.custom_role_slug ?? SYSTEM_ROLE_OPTIONS[2].value;
          return (
            <select
              value={currentSlug}
              onChange={(e) => handleUpdateRole(member.user, e.target.value)}
              className="bg-[#1C1C1F] text-brand-gold text-[10px] font-semibold border border-brand-gold/20 rounded-md px-2 py-1 outline-none cursor-pointer"
            >
              {availableRoles.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label.toUpperCase()}
                </option>
              ))}
            </select>
          );
        },
      }),
      columnHelper.display({
        id: "role_label",
        header: t("settings.users.table.assignedRole"),
        cell: (info) => {
          const member = info.row.original as OrganizationMember;
          return (
            <span className="text-sm text-text-secondary">
              {resolveMemberRoleLabel(member)}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "branch",
        header: t("settings.users.table.branch"),
        cell: (info) => {
          const member = info.row.original as OrganizationMember;
          return (
            <span className="text-sm text-text-secondary">
              {member.branch_name || t("settings.users.table.allBranches")}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: t("settings.users.table.actions"),
        cell: (info) => {
          const member = info.row.original as OrganizationMember;
          return (
            <button
              onClick={() =>
                handleRemoveMember(
                  member.user,
                  `${member.first_name || "User"} ${member.last_name || member.email}`,
                )
              }
              className="p-2 text-text-muted hover:text-red-500 transition-colors"
              title={t("settings.users.removeMember")}
            >
              <Trash className="h-4 w-4" />
            </button>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members],
  );

  const table = useReactTable({
    data: members || [],
    columns,
  });

  if (membersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Custom Roles Management Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              {t("settings.roles.title")}
            </h3>
            <p className="text-sm text-text-muted mt-1">
              {t("settings.roles.description")}
            </p>
          </div>
          <Button
            onClick={handleOpenNewRoleModal}
            leftIcon={<Plus className="h-4 w-4" />}
            className="font-semibold px-4"
          >
            {t("settings.roles.newRole")}
          </Button>
        </div>

        {roles && roles.length > 0 && roles.some((r) => !r.is_system) ? (
          <div className="rounded-xl border border-[#1C1C1F] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1C1C1F]/50 border-b border-[#1C1C1F]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      {t("settings.roles.table.name")}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      {t("settings.roles.table.description")}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      {t("settings.roles.table.permissions")}
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                      {t("settings.roles.table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roles
                    .filter((r) => !r.is_system)
                    .map((role) => (
                      <tr
                        key={role.id}
                        className="border-b border-[#1C1C1F]/50 last:border-0 hover:bg-[#1C1C1F]/20 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-text-primary">
                            {role.name}
                          </p>
                          <p className="text-xs text-text-muted mt-1">
                            {role.slug}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-text-secondary">
                            {role.description || "—"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {role.permission_codes.slice(0, 2).map((code) => (
                              <span
                                key={code}
                                className="inline-flex items-center px-2 py-1 rounded-md bg-[#1C1C1F] text-xs font-medium text-brand-gold border border-brand-gold/20"
                              >
                                {code}
                              </span>
                            ))}
                            {role.permission_codes.length > 2 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#1C1C1F] text-xs font-medium text-text-muted">
                                {t("settings.roles.table.more", { n: role.permission_codes.length - 2 })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditRoleModal(role)}
                              className="p-2 text-text-muted hover:text-brand-gold transition-colors"
                              title={t("settings.roles.editRole")}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteRole(role.id, role.name)
                              }
                              className="p-2 text-text-muted hover:text-red-500 transition-colors"
                              title={t("settings.roles.deleteRole")}
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1C1C1F] p-8 text-center">
            <p className="text-sm text-text-muted">{t("settings.roles.empty.title")}</p>
            <p className="text-xs text-text-muted mt-2">
              {t("settings.roles.empty.description")}
            </p>
          </div>
        )}
      </div>

      {/* Members Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              {t("settings.users.title")}
            </h3>
            <p className="text-sm text-text-muted mt-1">
              {t("settings.users.description")}
            </p>
          </div>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
            className="font-semibold px-4"
          >
            {t("settings.users.addMember")}
          </Button>
        </div>

        <div className="rounded-xl border border-[#1C1C1F] overflow-hidden">
          <NativeTable
            table={table}
            headerClassName="bg-[#1C1C1F]/50 border-b border-[#1C1C1F]"
            cellClassName="border-b border-[#1C1C1F]/50 last:border-0"
          />
        </div>
      </div>

      <ModalShell
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t("settings.users.addMemberModal.title")}
        description={t("settings.users.addMemberModal.description")}
      >
        <div className="space-y-6 py-4 px-1">
          <Input
            label={t("settings.users.addMemberModal.emailLabel")}
            type="email"
            value={newMember.user_email}
            onChange={(e) =>
              setNewMember({ ...newMember, user_email: e.target.value })
            }
            placeholder={t("settings.users.addMemberModal.emailPlaceholder")}
          />
          <Select
            label={t("settings.users.addMemberModal.roleLabel")}
            value={newMember.custom_role_slug}
            onChange={(val: string) =>
              setNewMember({ ...newMember, custom_role_slug: val })
            }
            options={availableRoles}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              {t("settings.users.addMemberModal.cancel")}
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={addMember.isPending || !newMember.user_email}
            >
              {addMember.isPending
                ? t("settings.users.addMemberModal.adding")
                : t("settings.users.addMemberModal.add")}
            </Button>
          </div>
        </div>
      </ModalShell>

      {/* Custom Role Modal */}
      <ModalShell
        open={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={
          roleFormMode === "create"
            ? t("settings.roles.createModal.title")
            : t("settings.roles.editModal.title")
        }
        description={
          roleFormMode === "create"
            ? t("settings.roles.createModal.description")
            : t("settings.roles.editModal.description")
        }
        maxWidthClassName="max-w-3xl"
      >
        <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
          <Input
            label={t("settings.roles.modal.roleNameLabel")}
            value={roleForm.name}
            onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
            placeholder={t("settings.roles.modal.roleNamePlaceholder")}
          />
          <Input
            label={t("settings.roles.modal.descriptionLabel")}
            value={roleForm.description}
            onChange={(e) =>
              setRoleForm({ ...roleForm, description: e.target.value })
            }
            placeholder={t("settings.roles.modal.descriptionPlaceholder")}
          />
          {/* Slug is auto-generated by the backend from the role name; no user input needed. */}

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <label className="block text-sm font-medium text-text-primary">
                {t("settings.roles.modal.permissionsLabel")}
              </label>
              <p className="text-sm text-text-muted">
                {t("settings.roles.modal.selected", {
                  n: roleForm.permission_codes.length,
                  m: permissions?.length ?? 0,
                })}
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-3xl border border-[#2A2A2E] bg-[#0F0F11] p-3 shadow-inner shadow-black/20">
              {permissions && permissions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {permissions.map((permission) => {
                    const checked = roleForm.permission_codes.includes(
                      permission.code,
                    );
                    return (
                      <button
                        key={permission.code}
                        type="button"
                        onClick={() => handleTogglePermission(permission.code)}
                        className={`w-full text-left rounded-3xl border px-4 py-4 transition-all duration-150 flex items-start gap-3 ${
                          checked
                            ? "border-brand-gold bg-[#241F0F] shadow-[0_0_0_1px_rgba(168,130,31,0.35)]"
                            : "border-[#2A2A2E] bg-[#141418] hover:border-[#A8821F]/70 hover:bg-[#1F1F23]"
                        }`}
                        aria-pressed={checked}
                      >
                        <span
                          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${
                            checked
                              ? "border-brand-gold bg-brand-gold text-[#141416]"
                              : "border-[#3A3A3F] bg-transparent text-text-secondary"
                          }`}
                        >
                          {checked ? "✓" : ""}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary">
                            {permission.label}
                          </p>
                          <p className="text-xs text-text-muted leading-relaxed">
                            {permission.code}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center py-4">
                  {t("settings.roles.noPermissions")}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsRoleModalOpen(false)}>
              {t("settings.roles.modal.cancel")}
            </Button>
            <Button
              onClick={handleSaveRole}
              disabled={createRole.isPending || updateRole.isPending}
            >
              {roleFormMode === "create"
                ? createRole.isPending
                  ? t("settings.roles.modal.creating")
                  : t("settings.roles.modal.create")
                : updateRole.isPending
                  ? t("settings.roles.modal.updating")
                  : t("settings.roles.modal.update")}
            </Button>
          </div>
        </div>
      </ModalShell>

      <ConfirmActionModal
        open={isConfirmRoleDeleteOpen}
        title={
          roleToDelete
            ? t("settings.roles.deleteModal.title", { name: roleToDelete.name })
            : t("settings.roles.deleteModal.titleDefault")
        }
        description={
          roleToDelete
            ? t("settings.roles.deleteModal.description", { name: roleToDelete.name })
            : t("settings.roles.deleteModal.descriptionDefault")
        }
        confirmLabel={t("settings.roles.deleteModal.confirmLabel")}
        tone="critical"
        isConfirming={deleteRole.isPending}
        onClose={() => {
          setIsConfirmRoleDeleteOpen(false);
          setRoleToDelete(null);
        }}
        onConfirm={handleConfirmDeleteRole}
      />

      <ConfirmActionModal
        open={isConfirmMemberRemoveOpen}
        title={
          memberToRemove
            ? t("settings.users.removeModal.title", { label: memberToRemove.label })
            : t("settings.users.removeModal.titleDefault")
        }
        description={
          memberToRemove
            ? t("settings.users.removeModal.description", { label: memberToRemove.label })
            : t("settings.users.removeModal.descriptionDefault")
        }
        confirmLabel={t("settings.users.removeModal.confirmLabel")}
        tone="critical"
        isConfirming={removeMember.isPending}
        onClose={() => {
          setIsConfirmMemberRemoveOpen(false);
          setMemberToRemove(null);
        }}
        onConfirm={handleConfirmRemoveMember}
      />
    </div>
  );
}
