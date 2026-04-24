"use client";

import { useState, useEffect, useMemo } from "react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import {
  useCurrentUserProfile,
  useMyOrganizations,
  useDeleteAccount,
} from "@/services";
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
} from "iconoir-react";
import {
  useOrganizationDetail,
  useUpdateOrganization,
  useOrganizationMembers,
  useAddOrganizationMember,
  useUpdateOrganizationMember,
  useRemoveOrganizationMember,
  useDeleteOrganization,
} from "@/services/organizations/hooks";
import {
  useBranches,
  useBranch,
  useUpdateBranch,
  useDeleteBranch,
} from "@/services/branches/hooks";
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
} from "@/services/notifications/hooks";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  createColumnHelper,
  useReactTable,
  NativeTable,
} from "@/components/ui/native-table";
import { ModalShell } from "@/components/ui/modal-shell";
import type { OrganizationMemberRole } from "@/services/organizations/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import Image from "next/image";

const columnHelper = createColumnHelper<any>();

type SettingsTab =
  | "organization"
  | "branches"
  | "users-roles"
  | "integrations"
  | "notifications"
  | "security"
  | "data-ai";

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("organization");
  const { data: user } = useCurrentUserProfile();
  const { data: organizations } = useMyOrganizations();
  const org = organizations?.[0];

  const tabs: TabItem[] = [
    {
      id: "organization",
      label: "Organization",
      icon: <Building className="h-4 w-4" />,
      roles: ["ORG_OWNER", "ORG_ADMIN", "OPS_DIRECTOR"],
    },
    {
      id: "branches",
      label: "Branches",
      icon: <Shop className="h-4 w-4" />,
      roles: ["ORG_OWNER", "OPS_DIRECTOR", "BRANCH_MANAGER"],
    },
    {
      id: "users-roles",
      label: "Users & Roles",
      icon: <Group className="h-4 w-4" />,
      roles: ["ORG_OWNER", "ORG_ADMIN"],
    },
    {
      id: "integrations",
      label: "Integrations",
      icon: <CloudSync className="h-4 w-4" />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <BellNotification className="h-4 w-4" />,
    },
    {
      id: "security",
      label: "Security",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      id: "data-ai",
      label: "Data & AI Preferences",
      icon: <Brain className="h-4 w-4" />,
    },
  ];

  const filteredTabs = tabs.filter(
    (tab) =>
      !tab.roles ||
      (user?.organization_role && tab.roles.includes(user.organization_role)),
  );

  return (
    <WorkspaceShell
      eyebrow="System"
      title="Settings"
      description="Workspace configuration, access controls, and platform preferences."
      insight="Enable branch-level default context to reduce navigation friction for operators."
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
          {activeTab === "branches" && <BranchSettings orgId={org?.id} />}
          {activeTab === "users-roles" && <UserRoleSettings orgId={org?.id} />}
          {activeTab === "integrations" && (
            <IntegrationsSettings orgId={org?.id} />
          )}
          {activeTab === "notifications" && <NotificationsSettings />}
          {activeTab === "security" && <SecuritySettings />}
          {/* Add more tabs content here as they are implemented */}
          {![
            "organization",
            "branches",
            "users-roles",
            "integrations",
            "notifications",
            "security",
          ].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-12 w-12 rounded-full bg-[#1C1C1F] flex items-center justify-center mb-4">
                {tabs.find((t) => t.id === activeTab)?.icon}
              </div>
              <h3 className="text-lg font-medium text-text-primary">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h3>
              <p className="text-sm text-text-muted mt-1">
                This section is currently under development.
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
        toast.success("Organization settings updated");
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
            Organization Settings
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Manage global business identity and operational defaults.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateOrg.isPending}
          className="font-semibold px-6"
        >
          {updateOrg.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* General Settings */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <InfoCircle className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            General
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Organization Name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="e.g. PrepIQ Kitchen"
          />
          <Select
            label="Business Type"
            value={formData.business_type}
            onChange={(val: string) => handleChange("business_type", val)}
            options={[
              { label: "Restaurant", value: "RESTAURANT" },
              { label: "Hotel", value: "HOTEL" },
              { label: "Bakery", value: "BAKERY" },
              { label: "Cloud Kitchen", value: "CLOUD_KITCHEN" },
              { label: "Catering", value: "CATERING" },
              { label: "Institutional", value: "INSTITUTIONAL" },
            ]}
          />
          <Select
            label="Timezone"
            value={formData.timezone}
            onChange={(val: string) => handleChange("timezone", val)}
            options={[
              { label: "UTC", value: "UTC" },
              { label: "Eastern Time (ET)", value: "America/New_York" },
              { label: "Pacific Time (PT)", value: "America/Los_Angeles" },
              { label: "London (GMT)", value: "Europe/London" },
              { label: "East Africa (EAT)", value: "Africa/Nairobi" },
            ]}
          />
          <Select
            label="Default Currency"
            value={formData.currency}
            onChange={(val: string) => handleChange("currency", val)}
            options={[
              { label: "USD ($)", value: "USD" },
              { label: "EUR (€)", value: "EUR" },
              { label: "GBP (£)", value: "GBP" },
              { label: "KES (KSh)", value: "KES" },
            ]}
          />
        </div>
      </section>

      {/* Branding */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <Building className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Branding
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <span className="text-sm font-medium text-text-secondary">
              Organization Logo
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
                  Update Logo
                </p>
                <p className="text-xs text-text-muted">
                  SVG, PNG or JPG (max 2MB)
                </p>
                <Button
                  variant="secondary"
                  className="mt-2 text-[11px] h-8 px-3"
                >
                  Upload New
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex gap-3 items-end">
              <Input
                label="Brand Color"
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
              label="Receipt Name"
              value={formData.receipt_name}
              onChange={(e) => handleChange("receipt_name", e.target.value)}
              placeholder="e.g. PREPIQ KITCHEN LTD"
            />
          </div>
        </div>
      </section>

      {/* Operational Defaults */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <Brain className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Operational Defaults
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Default Prep Buffer (Minutes)"
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
            label="Forecast Horizon (Days)"
            type="number"
            value={formData.forecast_horizon_days}
            onChange={(e) =>
              handleChange("forecast_horizon_days", parseInt(e.target.value))
            }
          />
        </div>
      </section>
      {/* Danger Zone */}
      <section className="pt-10 border-t border-red-500/20">
        <div className="flex items-center gap-2 pb-2">
          <Trash className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-red-500">
            Danger Zone
          </h3>
        </div>

        <div className="mt-4 p-6 rounded-2xl bg-red-500/5 border border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h4 className="text-base font-semibold text-text-primary">
              Delete Organization
            </h4>
            <p className="text-sm text-text-muted mt-1 max-w-xl">
              Permanently remove this organization and all associated branches,
              data, and users. This action cannot be undone.
            </p>
          </div>
          <OrganizationDeleteModal orgId={orgId} orgName={org?.name} />
        </div>
      </section>
    </div>
  );
}

function IntegrationsSettings({ orgId }: { orgId?: string }) {
  const { isLoading } = useIntegrationsOverview({
    organization_id: orgId || "00000000-0000-0000-0000-000000000000",
  });
  const squareOAuth = useSquareOAuthStart();
  const toastOAuth = useToastOAuthStart();
  const loyverseOAuth = useLoyverseOAuthStart();
  const cloverOAuth = useCloverOAuthStart();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  const posSystems = [
    {
      id: "toast",
      name: "Toast",
      icon: <Shop className="h-6 w-6" />,
      status: "Disconnected",
    },
    {
      id: "square",
      name: "Square",
      icon: <Shop className="h-6 w-6" />,
      status: "Disconnected",
    },
    {
      id: "clover",
      name: "Clover",
      icon: <Shop className="h-6 w-6" />,
      status: "Disconnected",
    },
    {
      id: "lightspeed",
      name: "Lightspeed",
      icon: <Shop className="h-6 w-6" />,
      status: "Disconnected",
    },
  ];

  const handleConnect = (id: string) => {
    const branch_id = "00000000-0000-0000-0000-000000000000"; // Dummy UUID for now
    if (id === "square") {
      squareOAuth.mutate({ branch_id });
    } else if (id === "toast") {
      toastOAuth.mutate({
        branch_id,
        client_id: "placeholder",
        client_secret: "placeholder",
      });
    } else if (id === "loyverse") {
      loyverseOAuth.mutate({ branch_id });
    } else if (id === "clover") {
      cloverOAuth.mutate({ branch_id });
    } else {
      toast.error(`${id} connection not implemented yet.`);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          Integrations
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Connect your POS, accounting, and reservation systems to PrepIQ.
        </p>
      </div>

      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <Shop className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            POS Systems
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posSystems.map((pos) => (
            <div
              key={pos.id}
              className="p-5 rounded-2xl bg-[#1C1C1F]/50 border border-[#1C1C1F] flex items-center justify-between group hover:border-[#2A2A2E] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#1C1C1F] flex items-center justify-center text-text-muted group-hover:text-brand-gold transition-colors">
                  {pos.icon}
                </div>
                <div>
                  <p className="font-medium text-text-primary">{pos.name}</p>
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px] opacity-60"
                  >
                    {pos.status}
                  </Badge>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => handleConnect(pos.id)}
                className="h-9 px-4 text-xs font-semibold"
              >
                Connect
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <CloudSync className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Accounting & Reservations
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
    </div>
  );
}

function NotificationsSettings() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const [localPrefs, setLocalPrefs] = useState<any[]>([]);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  const handleToggle = (domain: string, channel: string, enabled: boolean) => {
    const updated = localPrefs.map((p) =>
      p.domain === domain ? { ...p, [`${channel}_enabled`]: enabled } : p,
    );
    setLocalPrefs(updated);
    updatePreferences.mutate(updated);
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
      domain: "PRODUCTION",
      label: "Production & Prep",
      description: "Prep plan updates and completion alerts",
    },
    {
      domain: "INVENTORY",
      label: "Inventory & Waste",
      description: "Stockout risks and high-waste threshold alerts",
    },
    {
      domain: "PROCUREMENT",
      label: "Supplier & Purchasing",
      description: "Order reminders and delivery status",
    },
    {
      domain: "STAFF",
      label: "Staff & Performance",
      description: "Shift assignments and daily summaries",
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          Notification Settings
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Control how and when you receive operational alerts.
        </p>
      </div>

      <div className="rounded-2xl border border-[#1C1C1F] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#1C1C1F]/50">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Notification Type
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-center">
                In-App
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-center">
                Email
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-center">
                Push
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1C1C1F]/50">
            {notificationTypes.map((type) => {
              const pref = localPrefs.find((p) => p.domain === type.domain) || {
                domain: type.domain,
                in_app_enabled: true,
                email_enabled: true,
                push_enabled: true,
              };

              return (
                <tr
                  key={type.domain}
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
                        handleToggle(type.domain, "in_app", val)
                      }
                    />
                  </td>
                  <td className="px-6 py-5 text-center">
                    <Switch
                      checked={pref.email_enabled}
                      onCheckedChange={(val) =>
                        handleToggle(type.domain, "email", val)
                      }
                    />
                  </td>
                  <td className="px-6 py-5 text-center">
                    <Switch
                      checked={pref.push_enabled}
                      onCheckedChange={(val) =>
                        handleToggle(type.domain, "push", val)
                      }
                    />
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
            Operational Escalation
          </h4>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Critical system alerts (like server downtime or major inventory
            discrepancies) bypass these settings and are always sent via all
            available channels to ensure operational continuity.
          </p>
        </div>
      </div>
    </div>
  );
}

function BranchSettings({ orgId }: { orgId?: string }) {
  const { data: branches, isLoading: loadingBranches } = useBranches(
    orgId || "",
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const { data: branch, isLoading: loadingBranch } = useBranch(
    orgId || "",
    selectedBranchId,
  );
  const updateBranch = useUpdateBranch(orgId || "", selectedBranchId);
  const [formData, setFormData] = useState<any>(null);

  // Default to first branch if none selected
  useEffect(() => {
    if (branches?.length && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

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
        toast.success("Branch settings updated");
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
            Branch Settings
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Configure kitchen capacity, schedules, and local demand signals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-48">
            <Select
              value={selectedBranchId}
              onChange={setSelectedBranchId}
              options={branchOptions}
              placeholder="Select Branch"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={updateBranch.isPending || !selectedBranchId}
            className="font-semibold px-6"
          >
            {updateBranch.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {!selectedBranchId ? (
        <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-[#1C1C1F] rounded-2xl">
          <Shop className="h-8 w-8 text-text-muted mb-3" />
          <p className="text-sm text-text-muted">
            Select a branch to configure its settings.
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
                General
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Branch Name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
              <Input
                label="Address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
              <Select
                label="Timezone"
                value={formData.timezone}
                onChange={(val: string) => handleChange("timezone", val)}
                options={[
                  { label: "UTC", value: "UTC" },
                  { label: "Eastern Time (ET)", value: "America/New_York" },
                  { label: "Pacific Time (PT)", value: "America/Los_Angeles" },
                  { label: "London (GMT)", value: "Europe/London" },
                  { label: "East Africa (EAT)", value: "Africa/Nairobi" },
                ]}
              />
            </div>
          </section>

          {/* Kitchen Configuration */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
              <Brain className="h-4 w-4 text-brand-gold" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                Kitchen Configuration
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Kitchen Capacity (Units)"
                type="number"
                value={formData.capacity}
                onChange={(e) =>
                  handleChange("capacity", parseInt(e.target.value))
                }
              />
              <Input
                label="Average Prep Time (Minutes)"
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
                label="Service Start Time"
                type="time"
                value={formData.service_start_time}
                onChange={(e) =>
                  handleChange("service_start_time", e.target.value)
                }
              />
              <Input
                label="Service End Time"
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
                Demand Context
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Seasonality Profile"
                value={formData.seasonality_profile}
                onChange={(e) =>
                  handleChange("seasonality_profile", e.target.value)
                }
                placeholder="e.g. Campus-Heavy, Tourist"
              />
              <div className="p-4 rounded-xl bg-[#1C1C1F]/50 border border-[#2A2A2E] flex items-start gap-3">
                <InfoCircle className="h-5 w-5 text-brand-gold shrink-0 mt-0.5" />
                <p className="text-xs text-text-muted leading-relaxed">
                  Advanced demand patterns (nearby venues, events) are currently
                  managed via the
                  <span className="text-brand-gold font-medium">
                    {" "}
                    PrepIQ Intelligence Engine
                  </span>{" "}
                  automatically.
                </p>
              </div>
            </div>
          </section>

          {/* Inventory Rules */}
          <section className="space-y-6 pb-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
              <ShieldCheck className="h-4 w-4 text-brand-gold" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                Inventory Rules
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input
                label="Min Stock Buffer (%)"
                type="number"
                value={formData.min_stock_buffer}
                onChange={(e) =>
                  handleChange("min_stock_buffer", parseInt(e.target.value))
                }
              />
              <Input
                label="Waste Threshold (%)"
                type="number"
                step="0.01"
                value={formData.waste_threshold}
                onChange={(e) =>
                  handleChange("waste_threshold", parseFloat(e.target.value))
                }
              />
              <Input
                label="Reorder Buffer"
                type="number"
                value={formData.reorder_buffer}
                onChange={(e) =>
                  handleChange("reorder_buffer", parseInt(e.target.value))
                }
              />
            </div>
          </section>

          {/* Danger Zone */}
          <section className="pt-10 border-t border-red-500/20">
            <div className="flex items-center gap-2 pb-2">
              <Trash className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-red-500">
                Danger Zone
              </h3>
            </div>

            <div className="mt-4 p-6 rounded-2xl bg-red-500/5 border border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h4 className="text-base font-semibold text-text-primary">
                  Delete Branch
                </h4>
                <p className="text-sm text-text-muted mt-1 max-w-xl">
                  Permanently remove this branch and its historical data from
                  forecasts and reporting. This action cannot be undone.
                </p>
              </div>
              <BranchDeleteModal
                orgId={orgId}
                branchId={selectedBranchId}
                branchName={branch?.name}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function UserRoleSettings({ orgId }: { orgId?: string }) {
  const { data: members, isLoading } = useOrganizationMembers(orgId || "");
  const addMember = useAddOrganizationMember(orgId || "");
  const updateMember = useUpdateOrganizationMember(orgId || "");
  const removeMember = useRemoveOrganizationMember(orgId || "");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMember, setNewMember] = useState<{
    user_email: string;
    role: OrganizationMemberRole;
  }>({
    user_email: "",
    role: "STAFF_OPERATOR",
  });

  const handleAddMember = () => {
    addMember.mutate(newMember, {
      onSuccess: () => {
        setIsAddModalOpen(false);
        setNewMember({ user_email: "", role: "STAFF_OPERATOR" });
      },
    });
  };

  const handleUpdateRole = (userId: string, newRole: string) => {
    updateMember.mutate({ userId, role: newRole });
  };

  const handleRemoveMember = (userId: string) => {
    if (window.confirm("Are you sure you want to remove this member?")) {
      removeMember.mutate(userId);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "user",
        header: "User",
        cell: (info) => {
          const member = info.row.original;
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
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => (
          <select
            value={info.getValue()}
            onChange={(e) =>
              handleUpdateRole(info.row.original.user, e.target.value)
            }
            className="bg-[#1C1C1F] text-brand-gold text-[10px] font-semibold border border-brand-gold/20 rounded-md px-2 py-1 outline-none cursor-pointer"
          >
            <option value="ORG_OWNER">OWNER</option>
            <option value="ORG_ADMIN">ADMIN</option>
            <option value="OPS_DIRECTOR">OPS DIRECTOR</option>
            <option value="GM">GM</option>
            <option value="BRANCH_MANAGER">BRANCH MANAGER</option>
            <option value="STAFF_OPERATOR">STAFF OPERATOR</option>
          </select>
        ),
      }),
      columnHelper.accessor("branch_name", {
        header: "Branch",
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {info.getValue() || "All Branches"}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => (
          <button
            onClick={() => handleRemoveMember(info.row.original.user)}
            className="p-2 text-text-muted hover:text-red-500 transition-colors"
            title="Remove Member"
          >
            <Trash className="h-4 w-4" />
          </button>
        ),
      }),
    ],
    [members],
  );

  const table = useReactTable({
    data: members || [],
    columns,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            Users & Roles
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Manage team access, permissions, and role-based assignments.
          </p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
          className="font-semibold px-4"
        >
          Add Member
        </Button>
      </div>

      <div className="rounded-xl border border-[#1C1C1F] overflow-hidden">
        <NativeTable
          table={table}
          headerClassName="bg-[#1C1C1F]/50 border-b border-[#1C1C1F]"
          cellClassName="border-b border-[#1C1C1F]/50 last:border-0"
        />
      </div>

      {/* Add Member Modal */}
      <ModalShell
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Organization Member"
        description="Invite a new member to join your organization."
      >
        <div className="space-y-6 py-4 px-1">
          <Input
            label="User Email"
            type="email"
            value={newMember.user_email}
            onChange={(e) =>
              setNewMember({ ...newMember, user_email: e.target.value })
            }
            placeholder="colleague@example.com"
          />
          <Select
            label="Assign Role"
            value={newMember.role}
            onChange={(val: string) =>
              setNewMember({
                ...newMember,
                role: val as OrganizationMemberRole,
              })
            }
            options={[
              { label: "Admin", value: "ORG_ADMIN" },
              { label: "Operations Director", value: "OPS_DIRECTOR" },
              { label: "General Manager", value: "GM" },
              { label: "Branch Manager", value: "BRANCH_MANAGER" },
              { label: "Staff Operator", value: "STAFF_OPERATOR" },
            ]}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={addMember.isPending || !newMember.user_email}
            >
              {addMember.isPending ? "Adding..." : "Add Member"}
            </Button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

function OrganizationDeleteModal({
  orgId,
  orgName,
}: {
  orgId?: string;
  orgName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const deleteOrg = useDeleteOrganization(orgId || "");

  const reasons = [
    { value: "NO_LONGER_NEEDED", label: "I no longer need PrepIQ" },
    { value: "TOO_EXPENSIVE", label: "Too expensive" },
    { value: "FEATURES_MISSING", label: "Features missing" },
    { value: "SWITCHING_PLATFORM", label: "Switching to another platform" },
    { value: "OTHER", label: "Other" },
  ];

  const handleDelete = () => {
    deleteOrg.mutate(
      {
        reason_choice: reason,
        reason_details: reason === "OTHER" ? otherReason : "",
        confirm_name: confirmName,
      },
      {
        onSuccess: () => {
          setIsOpen(false);
          window.location.href = "/workspace";
        },
      },
    );
  };

  return (
    <>
      <Button
        variant="ghost"
        className="border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
        onClick={() => setIsOpen(true)}
      >
        Delete organization
      </Button>
      <ModalShell
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Delete Organization"
        description="This is a permanent action. Please read carefully."
      >
        <div className="space-y-6 py-4 px-1">
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm font-medium text-red-500">
                  Wait! Before you go...
                </p>
                <p className="text-xs text-text-muted mt-2 leading-relaxed">
                  Deleting your organization will immediately terminate access
                  for all members and wipe all historical forecasts. If you're
                  having trouble with features or pricing, our support team is
                  available 24/7.
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-text-primary">
                  Why are you leaving?
                </p>
                {reasons.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      reason === r.value
                        ? "bg-brand-gold/5 border-brand-gold/30"
                        : "bg-[#1C1C1F]/50 border-[#2A2A2E] hover:border-[#3A3A3E]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={(e) => setReason(e.target.value)}
                      className="accent-brand-gold"
                    />
                    <span className="text-sm text-text-secondary">
                      {r.label}
                    </span>
                  </label>
                ))}
                {reason === "OTHER" && (
                  <Input
                    placeholder="Please tell us more..."
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    type="text"
                    label={"Tell us more"}
                  />
                )}
              </div>
              <Button
                className="w-full mt-6"
                disabled={!reason}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  To confirm, please type{" "}
                  <span className="font-bold text-text-primary break-all italic">
                    {orgName}
                  </span>{" "}
                  below:
                </p>
                <Input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Type organization name"
                  type="text"
                  autoFocus
                  label={"Type organization name"}
                />
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#1C1C1F]/50 border border-[#2A2A2E]">
                <input
                  type="checkbox"
                  id="confirm-check"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 accent-red-500"
                />
                <label
                  htmlFor="confirm-check"
                  className="text-xs text-text-muted leading-relaxed cursor-pointer"
                >
                  I understand that this will permanently delete{" "}
                  <span className="text-red-500 font-medium">all data</span>,
                  branches, and user access for this organization. This action
                  cannot be undone.
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={
                    confirmName !== orgName || !agreed || deleteOrg.isPending
                  }
                  onClick={handleDelete}
                >
                  {deleteOrg.isPending ? "Deleting..." : "Permanently Delete"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </ModalShell>
    </>
  );
}

function BranchDeleteModal({
  orgId,
  branchId,
  branchName,
}: {
  orgId?: string;
  branchId: string;
  branchName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [agreed, setAgreed] = useState(false);
  const deleteBranch = useDeleteBranch(orgId || "");

  const reasons = [
    { value: "NO_LONGER_NEEDED", label: "I no longer need this branch" },
    { value: "TOO_EXPENSIVE", label: "Too expensive" },
    { value: "FEATURES_MISSING", label: "Features missing" },
    { value: "MOVING_SOLUTION", label: "Moving to a different solution" },
    { value: "OTHER", label: "Other" },
  ];

  const handleDelete = () => {
    deleteBranch.mutate(
      {
        branchId,
        payload: {
          reason_choice: reason,
          reason_details: reason === "OTHER" ? otherReason : "",
          confirm: agreed,
        },
      },
      {
        onSuccess: () => {
          setIsOpen(false);
        },
      },
    );
  };

  return (
    <>
      <Button
        variant="ghost"
        className="border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
        onClick={() => setIsOpen(true)}
      >
        Delete branch
      </Button>
      <ModalShell
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Delete Branch"
        description="This will remove the branch from your organization."
      >
        <div className="space-y-6 py-4 px-1">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              You are about to delete{" "}
              <span className="text-text-primary font-bold italic">
                {branchName}
              </span>
              . This action cannot be reversed.
            </p>

            <div className="space-y-3">
              <p className="text-sm font-medium text-text-primary">
                Reason for deletion
              </p>
              {reasons.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                    reason === r.value
                      ? "bg-brand-gold/5 border-brand-gold/30"
                      : "bg-[#1C1C1F]/50 border-[#2A2A2E] hover:border-[#3A3A3E]"
                  }`}
                >
                  <input
                    type="radio"
                    name="branch-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="accent-brand-gold"
                  />
                  <span className="text-sm text-text-secondary">{r.label}</span>
                </label>
              ))}
              {reason === "OTHER" && (
                <Input
                  placeholder="Please tell us more..."
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  type="text"
                  label={"Tell us more"}
                />
              )}
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-[#1C1C1F]/50 border border-[#2A2A2E]">
              <input
                type="checkbox"
                id="confirm-branch-check"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 accent-red-500"
              />
              <label
                htmlFor="confirm-branch-check"
                className="text-xs text-text-muted cursor-pointer leading-relaxed"
              >
                I confirm that I want to delete this branch and all its
                associated configuration and data.
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={!reason || !agreed || deleteBranch.isPending}
              onClick={handleDelete}
            >
              {deleteBranch.isPending ? "Deleting..." : "Delete Branch"}
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  );
}

function SecuritySettings() {
  const { data: user } = useCurrentUserProfile();

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          Security & Account
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Manage your account security and personal data.
        </p>
      </div>

      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1C1C1F]">
          <ShieldCheck className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Account Access
          </h3>
        </div>
        <div className="p-6 rounded-2xl bg-[#1C1C1F]/30 border border-[#2A2A2E] flex items-center justify-between">
          <div>
            <h4 className="text-base font-semibold text-text-primary">
              Password
            </h4>
            <p className="text-sm text-text-muted mt-1">
              Change your password frequently to keep your account secure.
            </p>
          </div>
          <Button
            variant="ghost"
            className="border-[#2A2A2E] hover:border-brand-gold/50"
          >
            Change Password
          </Button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="pt-10 border-t border-red-500/20">
        <div className="flex items-center gap-2 pb-2">
          <Trash className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-red-500">
            Danger Zone
          </h3>
        </div>

        <div className="mt-4 p-6 rounded-2xl bg-red-500/5 border border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h4 className="text-base font-semibold text-text-primary">
              Close Account
            </h4>
            <p className="text-sm text-text-muted mt-1 max-w-xl">
              Permanently delete your user account and personal data. This will
              not affect your organization or branches if you are not the last
              owner.
            </p>
          </div>
          <AccountDeleteModal userEmail={user?.email} />
        </div>
      </section>
    </div>
  );
}

function AccountDeleteModal({ userEmail }: { userEmail?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const deleteAccount = useDeleteAccount();

  const reasons = [
    { value: "NO_LONGER_NEEDED", label: "I no longer need PrepIQ" },
    { value: "TOO_EXPENSIVE", label: "Too expensive" },
    { value: "FEATURES_MISSING", label: "Features missing" },
    { value: "SWITCHING_PLATFORM", label: "Switching to another platform" },
    { value: "OTHER", label: "Other" },
  ];

  const handleDelete = () => {
    deleteAccount.mutate(
      {
        reason_choice: reason as any,
        reason_details: reason === "OTHER" ? otherReason : "",
        confirm: true,
      },
      {
        onSuccess: () => {
          window.location.href = "/login";
        },
      },
    );
  };

  return (
    <>
      <Button
        variant="ghost"
        className="border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
        onClick={() => setIsOpen(true)}
      >
        Delete account
      </Button>
      <ModalShell
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Close Account"
        description="We're sorry to see you go."
      >
        <div className="space-y-6 py-4 px-1">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              You are about to delete your account{" "}
              <span className="text-text-primary font-bold italic">
                {userEmail}
              </span>
              .
            </p>

            <div className="space-y-3">
              <p className="text-sm font-medium text-text-primary">
                Reason for leaving
              </p>
              {reasons.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                    reason === r.value
                      ? "bg-brand-gold/5 border-brand-gold/30"
                      : "bg-[#1C1C1F]/50 border-[#2A2A2E] hover:border-[#3A3A3E]"
                  }`}
                >
                  <input
                    type="radio"
                    name="account-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="accent-brand-gold"
                  />
                  <span className="text-sm text-text-secondary">{r.label}</span>
                </label>
              ))}
              {reason === "OTHER" && (
                <Input
                  placeholder="Please tell us more..."
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  type="text"
                  label={"Tell us more"}
                />
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={!reason || deleteAccount.isPending}
              onClick={handleDelete}
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete My Account"}
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
