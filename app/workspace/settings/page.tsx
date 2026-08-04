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
  HelpCircle,
  EvPlug,
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
import type { UpdateBranchPayload } from "@/services/branches/types";
import { BranchForm } from "@/components/branches/branch-form";
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
import { MemberAccessDrawer } from "@/components/dashboard/settings/member-access-drawer";
import {
  RoleEditorModal,
  type RoleFormValues,
} from "@/components/dashboard/settings/role-editor-modal";
import { SectionHeader } from "@/components/ui/section-header";
import { WebPushPrimingCard } from "@/components/dashboard/settings/web-push-priming-card";
import { DangerZone } from "@/components/dashboard/settings/danger-zone";
import { ActiveSessions } from "@/components/dashboard/settings/active-sessions";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateConnectorToken,
  usePrepConectors,
} from "@/services/connector/hook";
import { ClipboardModal } from "@/components/dashboard/ClipboardModal";
import { Spinner } from "@/components/ui/spinner";

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
    if (tabFromUrl && VALID_SETTINGS_TABS.includes(tabFromUrl))
      return tabFromUrl;
    return "organization";
  });
  const { data: user } = useCurrentUserProfile();

  // When the user changes branch inside IntegrationsSettings, update the URL so
  // navigating away and back still shows the same branch.
  function handleIntegrationBranchChange(branchId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("branch", branchId);
    params.set("tab", "integrations");
    router.replace(`/workspace/settings?${params.toString()}`, {
      scroll: false,
    });
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

  // A user with no organization (e.g. they just deleted their only one) keeps
  // the Organization tab so they can create a new one from its empty state,
  // even though they hold no org-settings permission yet.
  const hasNoOrg = user != null && !user.has_organization;
  const filteredTabs = tabs.filter(
    (tab) =>
      !tab.permission ||
      userPermissions.has(tab.permission) ||
      (tab.id === "organization" && hasNoOrg),
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
          {activeTab === "branches" && (
            <BranchSettings orgId={org?.id} focusedBranchId={branchFromUrl} />
          )}
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

  // No org yet (fresh account, or just deleted the last one): offer a way back
  // in instead of spinning forever on an org detail that will never load.
  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-[#1C1C1F] rounded-2xl px-6">
        <div className="h-12 w-12 rounded-full bg-[#1C1C1F] flex items-center justify-center mb-4">
          <Building className="h-6 w-6 text-brand-gold" />
        </div>
        <h3 className="text-lg font-medium text-text-primary">
          {t("settings.organization.noOrg.title")}
        </h3>
        <p className="text-sm text-text-muted mt-1 max-w-sm">
          {t("settings.organization.noOrg.description")}
        </p>
        <Link
          href="/onboarding"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-[8px] bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-colors hover:bg-[#B8962E]"
        >
          <Plus className="h-4 w-4" />
          {t("settings.organization.noOrg.cta")}
        </Link>
      </div>
    );
  }

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
          {updateOrg.isPending
            ? t("settings.organization.saving")
            : t("settings.organization.saveChanges")}
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
              {
                label: t(
                  "settings.organization.businessTypeOptions.restaurant",
                ),
                value: "RESTAURANT",
              },
              {
                label: t("settings.organization.businessTypeOptions.hotel"),
                value: "HOTEL",
              },
              {
                label: t("settings.organization.businessTypeOptions.bakery"),
                value: "BAKERY",
              },
              {
                label: t(
                  "settings.organization.businessTypeOptions.cloudKitchen",
                ),
                value: "CLOUD_KITCHEN",
              },
              {
                label: t("settings.organization.businessTypeOptions.catering"),
                value: "CATERING",
              },
              {
                label: t(
                  "settings.organization.businessTypeOptions.institutional",
                ),
                value: "INSTITUTIONAL",
              },
            ]}
          />
          <Select
            label={t("settings.organization.timezone")}
            value={formData.timezone}
            onChange={(val: string) => handleChange("timezone", val)}
            options={[
              {
                label: t("settings.organization.timezoneOptions.utc"),
                value: "UTC",
              },
              {
                label: t("settings.organization.timezoneOptions.eastern"),
                value: "America/New_York",
              },
              {
                label: t("settings.organization.timezoneOptions.pacific"),
                value: "America/Los_Angeles",
              },
              {
                label: t("settings.organization.timezoneOptions.london"),
                value: "Europe/London",
              },
              {
                label: t("settings.organization.timezoneOptions.eastAfrica"),
                value: "Africa/Nairobi",
              },
            ]}
          />
          <Select
            label={t("settings.organization.defaultCurrency")}
            value={formData.currency}
            onChange={(val: string) => handleChange("currency", val)}
            options={[
              {
                label: t("settings.organization.currencyOptions.usd"),
                value: "USD",
              },
              {
                label: t("settings.organization.currencyOptions.eur"),
                value: "EUR",
              },
              {
                label: t("settings.organization.currencyOptions.gbp"),
                value: "GBP",
              },
              {
                label: t("settings.organization.currencyOptions.kes"),
                value: "KES",
              },
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

const PREP_CNECTORON = [{ id: "connect", name: "Prep Connector" }];

/** Compact "time ago" label for connector heartbeats / syncs. */
function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

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

  const [selectedBranchId, setSelectedBranchId] = useState(
    focusedBranchId ?? "",
  );

  const { data: orgConnectors } = usePrepConectors(
    orgId ?? "",
    selectedBranchId ?? "",
  );
  const connectors = orgConnectors ?? [];

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
    integrationsQuery.data?.branches.find(
      (b) => b.branch_id === selectedBranchId,
    ) ?? integrationsQuery.data?.branches?.[0];
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const isConnected = branchStatus?.status === "CONNECTED";
  const isFocusedBranchWithIssue =
    !!focusedBranchId && focusedBranchId === selectedBranchId && !isConnected;

  const createConnectorToken = useCreateConnectorToken();

  const [generatedToken, setGeneratedToken] = useState<string | "">("");
  const [openTokenDialog, setOpenTokenDialog] = useState(false);

  function handleBranchChange(branchId: string) {
    setSelectedBranchId(branchId);
    onBranchChange?.(branchId);
  }

  async function handleTokenCreation(branchId: string) {
    const response = await createConnectorToken.mutateAsync(branchId);
    toast.loading(<Spinner />);

    setGeneratedToken(response.data.token);
    setOpenTokenDialog(true);
  }

  const handleConnect = (posId: string) => {
    const branch_id =
      selectedBranchId || "00000000-0000-0000-0000-000000000000";
    if (posId === "square") {
      squareOAuth.mutate({ branch_id });
    } else if (posId === "toast") {
      toastOAuth.mutate({
        branch_id,
        client_id: "placeholder",
        client_secret: "placeholder",
      });
    } else if (posId === "loyverse") {
      loyverseOAuth.mutate({ branch_id });
    } else if (posId === "clover") {
      cloverOAuth.mutate({ branch_id });
    } else {
      toast.error(
        t("settings.integrations.connectionNotImplemented", { posId }),
      );
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          {t("settings.integrations.title")}
        </h2>
        <p className="text-sm text-text-muted mt-1">
          {t("settings.integrations.description")}
        </p>
      </div>

      {/* Org-wide summary chips */}
      {summary && (
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-surface-4 px-3 py-1 text-xs text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-status-ok" />
            {t("settings.integrations.branchesConnected", {
              count: summary.active_connections,
              total: summary.total_branches,
            })}
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
        placeholder={
          branches.length === 0
            ? t("settings.integrations.loadingBranches")
            : t("settings.integrations.selectBranch")
        }
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
                {isConnected
                  ? t("settings.integrations.posConnected")
                  : t("settings.integrations.noPosConnected")}
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
            <Badge
              variant="outline"
              className="text-[10px] text-status-ok border-status-ok/40"
            >
              {t("settings.integrations.active")}
            </Badge>
          )}
        </div>
      ) : selectedBranch ? (
        <div className="flex items-center gap-3 rounded-2xl border border-surface-4 px-5 py-4 text-sm text-text-muted">
          <span className="h-2 w-2 rounded-full bg-text-muted/30" />
          {t("settings.integrations.noIntegrationData", {
            name: selectedBranch.name,
          })}
        </div>
      ) : null}

      {/* Context banner — shown when arriving from dashboard with a POS issue */}
      {isFocusedBranchWithIssue && (
        <div className="flex items-start gap-3 rounded-xl border border-status-warning/30 bg-status-warning/8 px-4 py-4">
          <InfoCircle className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {t("settings.integrations.posIssueTitle", {
                name: selectedBranch?.name ?? "",
              })}
            </p>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Sales data isn&apos;t syncing for this branch. Connect a POS
              system below.
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
              {isConnected
                ? t("settings.integrations.isConnectedSuffix", {
                    name: selectedBranch.name,
                  })
                : t("settings.integrations.connectFor", {
                    name: selectedBranch.name,
                  })}
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
                  <p className="font-medium text-text-primary">
                    {t(`settings.integrations.posSystems.${pos.id}`)}
                  </p>
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px] opacity-60"
                  >
                    {isConnected
                      ? t("settings.integrations.connected")
                      : t("settings.integrations.notConnected")}
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
            QuickBooks, Xero, and OpenTable integrations are currently in
            private beta. Contact support to join the waitlist.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-surface-4 pb-2">
          <EvPlug className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Prep Connector
          </h3>
          {selectedBranch && (
            <span className="ml-auto text-xs text-text-muted">
              {isConnected
                ? `${selectedBranch.name} is connected`
                : `Connect for ${selectedBranch.name}`}
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-surface-4 bg-surface-3/40">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    Connector
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    Records today
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    Last sync
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    Active
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-4">
                {connectors.length ? (
                  connectors.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors duration-200 hover:bg-surface-3/30"
                    >
                      <td className="px-5 py-4">
                        <p className="font-mono text-sm text-text-primary">
                          {row.machine_id}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          v{row.connector_version}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full border border-surface-4 bg-surface-3/40 px-2.5 py-1 text-xs font-medium text-text-secondary">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              row.is_online
                                ? "bg-status-success"
                                : "bg-status-critical"
                            }`}
                          />
                          {row.is_online ? "Online" : "Offline"}
                          <span className="text-text-muted">·</span>
                          <span className="text-text-muted">{row.status}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-sm tabular-nums text-text-secondary">
                        {row.records_synced_today.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-sm text-text-secondary">
                        {formatRelativeTime(row.last_sync_at)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            row.is_active
                              ? "bg-status-success/10 text-status-success"
                              : "bg-surface-3 text-text-muted"
                          }`}
                        >
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-sm text-text-muted"
                    >
                      No connectors registered for
                      {selectedBranch
                        ? ` ${selectedBranch.name}`
                        : " this branch"}{" "}
                      yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

const DIGEST_ELIGIBLE_CATEGORIES = ["LEARNING", "EXECUTIVE"];

const NOTIFICATION_CATEGORY_ORDER = [
  "OPERATIONAL",
  "PLANNING",
  "LIVE_SERVICE",
  "LEARNING",
  "EXECUTIVE",
] as const;

type CategoryPref = {
  notification_category: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  digest_mode: boolean;
};

const DEFAULT_CATEGORY_PREF = {
  in_app_enabled: true,
  email_enabled: true,
  push_enabled: true,
  digest_mode: false,
};

/**
 * One row per category the table renders, whether or not the server has a
 * saved row for it. The toggles used to operate on the raw server list, so on
 * an account that had never saved a preference every change mapped over an
 * empty array and POSTed nothing — the switch flicked back and the setting
 * never persisted.
 */
function buildCategoryPrefs(
  serverPrefs:
    | { notification_category?: string; branch?: string | null }[]
    | undefined,
): CategoryPref[] {
  return NOTIFICATION_CATEGORY_ORDER.map((category) => {
    const saved = serverPrefs?.find(
      (p) => p.notification_category === category && !p.branch,
    ) as Partial<CategoryPref> | undefined;
    return {
      notification_category: category,
      in_app_enabled:
        saved?.in_app_enabled ?? DEFAULT_CATEGORY_PREF.in_app_enabled,
      email_enabled:
        saved?.email_enabled ?? DEFAULT_CATEGORY_PREF.email_enabled,
      push_enabled: saved?.push_enabled ?? DEFAULT_CATEGORY_PREF.push_enabled,
      digest_mode: saved?.digest_mode ?? DEFAULT_CATEGORY_PREF.digest_mode,
    };
  });
}

function NotificationsSettings() {
  const { t } = useTranslation();
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const [localPrefs, setLocalPrefs] = useState<CategoryPref[]>(() =>
    buildCategoryPrefs(undefined),
  );

  const { data: quietHours, isLoading: quietHoursLoading } =
    useNotificationQuietHours();
  const updateQuietHours = useUpdateNotificationQuietHours();
  const [localQuietHours, setLocalQuietHours] = useState<{
    enabled: boolean;
    start_time: string;
    end_time: string;
  } | null>(null);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(buildCategoryPrefs(preferences));
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

  /**
   * Applies a patch to one category and persists just that row. Sending the
   * whole table on every flick re-wrote four untouched rows for no reason, and
   * the row is sent complete so a partial payload can't leave the server
   * guessing at the flags the user didn't change.
   */
  const persistCategory = (
    notificationCategory: string,
    patch: Partial<CategoryPref>,
  ) => {
    const current = localPrefs.find(
      (p) => p.notification_category === notificationCategory,
    ) ?? {
      notification_category: notificationCategory,
      ...DEFAULT_CATEGORY_PREF,
    };
    const next = { ...current, ...patch };
    // Digest is a delayed email; switching email off has to take it down too,
    // matching what the server enforces.
    if (!next.email_enabled) next.digest_mode = false;
    const rollback = localPrefs;

    setLocalPrefs((prev) =>
      prev.map((p) =>
        p.notification_category === notificationCategory ? next : p,
      ),
    );
    updatePreferences.mutate([next], {
      // A switch left flipped after a failed save reads as "saved". Put it back.
      onError: () => setLocalPrefs(rollback),
    });
  };

  const handleToggle = (
    notificationCategory: string,
    channel: string,
    enabled: boolean,
  ) =>
    persistCategory(notificationCategory, { [`${channel}_enabled`]: enabled });

  const handleDigestToggle = (notificationCategory: string, enabled: boolean) =>
    persistCategory(notificationCategory, { digest_mode: enabled });

  const handleQuietHoursChange = (
    patch: Partial<{ enabled: boolean; start_time: string; end_time: string }>,
  ) => {
    const updated = {
      ...(localQuietHours ?? {
        enabled: false,
        start_time: "23:00",
        end_time: "07:00",
      }),
      ...patch,
    };
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
              ) ?? {
                notification_category: type.notification_category,
                ...DEFAULT_CATEGORY_PREF,
              };
              const digestEligible = DIGEST_ELIGIBLE_CATEGORIES.includes(
                type.notification_category,
              );

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
                      aria-label={`${type.label} — ${t("settings.notifications.tableHeader.inApp")}`}
                      onCheckedChange={(val) =>
                        handleToggle(type.notification_category, "in_app", val)
                      }
                    />
                  </td>
                  <td className="px-6 py-5 text-center">
                    <Switch
                      checked={pref.email_enabled}
                      aria-label={`${type.label} — ${t("settings.notifications.tableHeader.email")}`}
                      onCheckedChange={(val) =>
                        handleToggle(type.notification_category, "email", val)
                      }
                    />
                  </td>
                  <td className="px-6 py-5 text-center">
                    <Switch
                      checked={pref.push_enabled}
                      aria-label={`${type.label} — ${t("settings.notifications.tableHeader.push")}`}
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
                          aria-label={`${type.label} — ${t("settings.notifications.tableHeader.digest")}`}
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
                onCheckedChange={(val) =>
                  handleQuietHoursChange({ enabled: val })
                }
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
              onChange={(e) =>
                handleQuietHoursChange({ start_time: e.target.value })
              }
              className="max-w-[140px]"
            />
            <Input
              label={t("settings.notifications.quietHours.end")}
              type="time"
              value={localQuietHours.end_time}
              disabled={!localQuietHours.enabled}
              onChange={(e) =>
                handleQuietHoursChange({ end_time: e.target.value })
              }
              className="max-w-[140px]"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function BranchSettings({
  orgId,
  focusedBranchId,
}: {
  orgId?: string;
  focusedBranchId?: string;
}) {
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
  const [branchReasonChoice, setBranchReasonChoice] =
    useState("LOCATION_CLOSED");

  const isLastBranch = (branches?.length ?? 0) <= 1;

  const handleDeleteBranch = () => {
    if (!selectedBranchId) return;
    deleteBranch.mutate(
      { branchId: selectedBranchId, reason_choice: branchReasonChoice },
      {
        onSuccess: () => {
          setDeleteBranchOpen(false);
          setSelectedBranchId("");
        },
      },
    );
  };

  // Default to focusedBranchId from URL, then first branch
  useEffect(() => {
    if (!branches?.length || selectedBranchId) return;
    const target =
      focusedBranchId && branches.some((b) => b.id === focusedBranchId)
        ? focusedBranchId
        : branches[0].id;
    setSelectedBranchId(target);
  }, [branches, focusedBranchId, selectedBranchId]);

  const handleSave = (payload: UpdateBranchPayload) => {
    updateBranch.mutate(payload, {
      onSuccess: () => {
        toast.success(t("settings.branch.updated"));
      },
    });
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
          {selectedBranchId ? (
            <Link
              href={`/workspace/branches/${selectedBranchId}`}
              className="inline-flex h-12 items-center rounded-button border border-border-default px-4 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              {t("settings.branch.viewBranch")}
            </Link>
          ) : null}
        </div>
      </div>

      {branchOptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-[#1C1C1F] rounded-2xl">
          <Shop className="h-8 w-8 text-text-muted mb-3" />
          <p className="text-sm text-text-muted">
            {t("settings.branch.noBranchesYet")}
          </p>
          <Link
            href="/workspace/branches/new"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-[8px] bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-colors hover:bg-[#B8962E]"
          >
            <Plus className="h-4 w-4" />
            {t("settings.branch.createFirstBranch")}
          </Link>
        </div>
      ) : !selectedBranchId ? (
        <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-[#1C1C1F] rounded-2xl">
          <Shop className="h-8 w-8 text-text-muted mb-3" />
          <p className="text-sm text-text-muted">
            {t("settings.branch.noBranchSelected")}
          </p>
        </div>
      ) : loadingBranch || !branch ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
        </div>
      ) : (
        <div className="space-y-10">
          <BranchForm
            branch={branch}
            isSaving={updateBranch.isPending}
            onSubmit={handleSave}
          />

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

      <ModalShell
        open={deleteBranchOpen}
        title={t("settings.branch.delete.title")}
        description={t("settings.branch.delete.confirm", {
          name: branch?.name ?? "",
        })}
        onClose={() => setDeleteBranchOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteBranchOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteBranch.isPending}
              onClick={handleDeleteBranch}
            >
              {deleteBranch.isPending
                ? t("common.processing")
                : t("settings.branch.delete.button")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {t("settings.branch.delete.dataNote")}
          </p>
          <Select
            label={t("settings.branch.delete.reasonLabel")}
            value={branchReasonChoice}
            onChange={(v: string) => setBranchReasonChoice(v)}
            options={[
              {
                value: "LOCATION_CLOSED",
                label: t("settings.branch.deleteReasons.locationClosed"),
              },
              {
                value: "SEASONAL",
                label: t("settings.branch.deleteReasons.seasonal"),
              },
              {
                value: "CONSOLIDATING",
                label: t("settings.branch.deleteReasons.consolidating"),
              },
              {
                value: "TEST_DUPLICATE",
                label: t("settings.branch.deleteReasons.testDuplicate"),
              },
              {
                value: "SWITCHED_TOOL",
                label: t("settings.branch.deleteReasons.switchedTool"),
              },
              {
                value: "OTHER",
                label: t("settings.branch.deleteReasons.other"),
              },
            ]}
          />
        </div>
      </ModalShell>
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
  const { data: orgBranches } = useBranches(orgId || "");
  const addMember = useAddOrganizationMember(orgId || "");
  const updateMember = useUpdateOrganizationMember(orgId || "");
  const removeMember = useRemoveOrganizationMember(orgId || "");
  const createRole = useCreateOrganizationRole(orgId || "");
  const updateRole = useUpdateOrganizationRole(orgId || "");
  const deleteRole = useDeleteOrganizationRole(orgId || "");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    user_email: "",
    custom_role_slug: SYSTEM_ROLE_SLUG.MEMBER as string,
  });

  // Role editor — a null role means "create", a system role opens read-only.
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
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

  // The access drawer is the single place a person's role, locations and
  // individual permission grants are edited.
  const [drawerMember, setDrawerMember] = useState<OrganizationMember | null>(
    null,
  );

  // Ownership moves only through Transfer Ownership in the Danger Zone, so the
  // owner role is never offered as something to assign.
  const roleOptions = useMemo(
    () =>
      (roles ?? [])
        .filter((role) => role.slug !== SYSTEM_ROLE_SLUG.SUPER_ADMIN)
        .map((role) => ({ label: role.name, value: role.slug })),
    [roles],
  );

  const systemRoles = (roles ?? []).filter((role) => role.is_system);
  const customRoles = (roles ?? []).filter((role) => !role.is_system);

  const handleUpdateOrgRole = (userId: string, custom_role_slug: string) => {
    updateMember.mutate({ userId, custom_role_slug });
  };

  const handleAddMember = () => {
    addMember.mutate(newMember, {
      onSuccess: () => {
        setIsAddModalOpen(false);
        setNewMember({
          user_email: "",
          custom_role_slug: SYSTEM_ROLE_SLUG.MEMBER,
        });
      },
    });
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

  const handleOpenRoleModal = (role: Role | null) => {
    setEditingRole(role);
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = (values: RoleFormValues) => {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      permission_codes: values.permission_codes,
    };
    const onSuccess = () => {
      setIsRoleModalOpen(false);
      setEditingRole(null);
    };
    if (editingRole) {
      updateRole.mutate({ roleId: editingRole.id, payload }, { onSuccess });
    } else {
      createRole.mutate(payload, { onSuccess });
    }
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
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-surface-4 bg-surface-2 text-xs font-semibold text-brand-gold">
                {(
                  member.first_name?.[0] ||
                  member.email?.[0] ||
                  "?"
                ).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {`${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() ||
                    member.email}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {member.email}
                </p>
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
          return (
            <span className="text-sm text-text-secondary">
              {resolveMemberRoleLabel(member)}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "locations",
        header: t("settings.users.table.locations"),
        cell: (info) => {
          const member = info.row.original as OrganizationMember;
          const assignments = member.branch_assignments ?? [];
          if (assignments.length === 0) {
            return (
              <span className="text-xs text-text-muted">
                {t("settings.users.table.noLocations")}
              </span>
            );
          }
          return (
            <div className="flex flex-wrap gap-1">
              {assignments.slice(0, 2).map((assignment) => (
                <span
                  key={assignment.branch_id}
                  className="inline-flex items-center rounded-full border border-surface-4 bg-surface-2 px-2 py-0.5 text-[11px] text-text-secondary"
                  title={
                    assignment.role_name
                      ? `${assignment.branch_name} — ${assignment.role_name}`
                      : assignment.branch_name
                  }
                >
                  {assignment.branch_name}
                </span>
              ))}
              {assignments.length > 2 ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] text-text-muted">
                  {t("settings.roles.table.more", {
                    n: assignments.length - 2,
                  })}
                </span>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "extra",
        header: t("settings.users.table.extraPermissions"),
        cell: (info) => {
          const member = info.row.original as OrganizationMember;
          const count = member.extra_permission_codes?.length ?? 0;
          if (count === 0) {
            return <span className="text-xs text-text-muted">—</span>;
          }
          return (
            <Badge variant="default">
              {t("settings.users.table.extraCount", { n: count })}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: t("settings.users.table.actions"),
        cell: (info) => {
          const member = info.row.original as OrganizationMember;
          const label =
            `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() ||
            member.email;
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => setDrawerMember(member)}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-brand-gold transition-colors hover:bg-surface-3"
              >
                {t("settings.users.manageAccess")}
              </button>
              <button
                type="button"
                onClick={() => handleRemoveMember(member.user, label)}
                aria-label={t("settings.users.removeMember")}
                title={t("settings.users.removeMember")}
                className="p-2 text-text-muted transition-colors hover:text-status-critical"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members, t],
  );

  const table = useReactTable({
    data: members || [],
    columns,
  });

  if (membersLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const memberCount = members?.length ?? 0;
  const grantedCount =
    members?.filter(
      (member) => (member.extra_permission_codes?.length ?? 0) > 0,
    ).length ?? 0;

  return (
    <div className="space-y-14">
      {/* ── Roles ──────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeader
          eyebrow={t("settings.roles.eyebrow")}
          title={t("settings.roles.title")}
          supporting={
            <>
              <span>
                {t("settings.roles.stats.custom", { n: customRoles.length })}
              </span>
              <span>
                {t("settings.roles.stats.system", { n: systemRoles.length })}
              </span>
            </>
          }
          actions={
            <Button
              onClick={() => handleOpenRoleModal(null)}
              leftIcon={<Plus className="h-4 w-4" />}
              className="font-semibold px-4"
            >
              {t("settings.roles.newRole")}
            </Button>
          }
        />
        <p className="max-w-2xl text-sm text-text-secondary">
          {t("settings.roles.description")}
        </p>

        <ul className="divide-y divide-surface-4 border-y border-surface-4">
          {[...systemRoles, ...customRoles].map((role) => (
            <li
              key={role.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">
                    {role.name}
                  </p>
                  <Badge variant={role.is_system ? "secondary" : "default"}>
                    {role.is_system
                      ? t("settings.roles.badge.system")
                      : t("settings.roles.badge.custom")}
                  </Badge>
                </div>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-text-secondary">
                  {role.description || t("settings.roles.noDescription")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-text-muted">
                  {t("settings.roles.permissionCount", {
                    n: role.permission_codes.length,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenRoleModal(role)}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-brand-gold transition-colors hover:bg-surface-3"
                >
                  {role.is_system
                    ? t("settings.roles.viewRole")
                    : t("settings.roles.editRole")}
                </button>
                {role.is_system ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      setRoleToDelete({ id: role.id, name: role.name });
                      setIsConfirmRoleDeleteOpen(true);
                    }}
                    aria-label={t("settings.roles.deleteRole")}
                    title={t("settings.roles.deleteRole")}
                    className="p-2 text-text-muted transition-colors hover:text-status-critical"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Members ────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeader
          eyebrow={t("settings.users.eyebrow")}
          title={t("settings.users.title")}
          supporting={
            <>
              <span>
                {t("settings.users.stats.members", { n: memberCount })}
              </span>
              <span>
                {t("settings.users.stats.granted", { n: grantedCount })}
              </span>
            </>
          }
          actions={
            <Button
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
              className="font-semibold px-4"
            >
              {t("settings.users.addMember")}
            </Button>
          }
        />
        <p className="max-w-2xl text-sm text-text-secondary">
          {t("settings.users.description")}
        </p>

        {memberCount === 0 ? (
          <p className="rounded-lg border border-dashed border-surface-4 px-6 py-10 text-center text-sm text-text-muted">
            {t("settings.users.empty")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-4">
            <NativeTable
              table={table}
              headerClassName="bg-surface-2 border-b border-surface-4"
              bodyClassName="divide-y divide-surface-4"
              cellClassName="border-b border-surface-4 last:border-0 px-5 py-4"
            />
          </div>
        )}
      </section>

      {/* ── Add member ─────────────────────────────────────────────────── */}
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
            options={roleOptions}
          />
          <p className="text-xs leading-relaxed text-text-secondary">
            {t("settings.users.addMemberModal.hint")}
          </p>
          <div className="flex justify-end gap-3 pt-2">
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

      <MemberAccessDrawer
        open={Boolean(drawerMember)}
        orgId={orgId || ""}
        member={drawerMember}
        branches={orgBranches ?? []}
        permissions={permissions ?? []}
        roleOptions={roleOptions}
        onClose={() => setDrawerMember(null)}
        onChangeOrgRole={handleUpdateOrgRole}
        isChangingOrgRole={updateMember.isPending}
      />

      <RoleEditorModal
        open={isRoleModalOpen}
        role={editingRole}
        permissions={permissions ?? []}
        isSaving={createRole.isPending || updateRole.isPending}
        onClose={() => {
          setIsRoleModalOpen(false);
          setEditingRole(null);
        }}
        onSave={handleSaveRole}
      />

      <ConfirmActionModal
        open={isConfirmRoleDeleteOpen}
        title={
          roleToDelete
            ? t("settings.roles.deleteModal.title", { name: roleToDelete.name })
            : t("settings.roles.deleteModal.titleDefault")
        }
        description={
          roleToDelete
            ? t("settings.roles.deleteModal.description", {
                name: roleToDelete.name,
              })
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
            ? t("settings.users.removeModal.title", {
                label: memberToRemove.label,
              })
            : t("settings.users.removeModal.titleDefault")
        }
        description={
          memberToRemove
            ? t("settings.users.removeModal.description", {
                label: memberToRemove.label,
              })
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
