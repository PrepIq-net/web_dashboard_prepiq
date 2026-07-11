"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, EditPencil, ArrowRight, MediaImage, SparksSolid, Check } from "iconoir-react";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  NativeTable,
} from "@/components/ui/native-table";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
} from "@/services";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import { useSelectedBranch } from "@/services/context/branch-store";
import {
  useIngredients,
  useMenuItems,
  useWasteAnalytics,
  usePrepBatches,
  useRecipes,
  useOnHand,
  useLogOnHand,
  useIngredientSuppliers,
  useCreateIngredientSupplier,
  useBatchRule,
  useUpsertBatchRule,
  useAvailabilityOverrides,
  useDeactivateAvailabilityOverride,
  useConfirmMenuItemReview,
} from "@/services/inventory/hooks";
import { useItemHistory } from "@/services/production-intelligence/hooks";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { IngredientModal } from "@/components/dashboard/inventory/ingredient-modal";
import { MenuItemModal } from "@/components/dashboard/inventory/menu-item-modal";
import { SupplierModal } from "@/components/dashboard/inventory/supplier-modal";
import { OnHandModal } from "@/components/dashboard/inventory/on-hand-modal";
import { MarkUnavailableModal } from "@/components/dashboard/today/mark-unavailable-modal";
import type { Ingredient, MenuItem, PrepBatch, ItemAvailabilityOverride } from "@/services/inventory/types";
import type { ItemTimeSeriesRow } from "@/services/production-intelligence/types";
import { useTranslation } from "@/lib/i18n";

const EMPTY_LIST: never[] = [];
const CORE_ROW_MODEL = getCoreRowModel();

type TabId = "ingredients" | "stock" | "recipes" | "waste" | "signals";

const TAB_IDS: TabId[] = ["ingredients", "stock", "recipes", "waste", "signals"];

const ingredientColumnHelper = createColumnHelper<Ingredient>();
const prepBatchColumnHelper = createColumnHelper<PrepBatch>();

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryPageContent />
    </Suspense>
  );
}

function InventoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const urlBranchId = searchParams.get("branch") ?? "";
  const urlTab = searchParams.get("tab") as TabId | null;
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.VIEW_INVENTORY);
  const canSeeAllBranches =
    permissions.has(PERMISSIONS.VIEW_ALL_BRANCHES) ||
    permissions.has(PERMISSIONS.MANAGE_BRANCHES);

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const scopedBranchIds = new Set(accessibleBranches.map((b) => b.id));
  const scopedBranches = canSeeAllBranches
    ? branches
    : branches.filter((b) => (scopedBranchIds.size ? scopedBranchIds.has(b.id) : true));

  const defaultBranch =
    scopedBranches.find((b) => b.id === accessScope?.default_branch_id) ??
    scopedBranches.find((b) => b.is_primary) ??
    scopedBranches[0] ??
    null;

  // Branch selection is shared across workspace pages (persists over navigation
  // and full reloads) via the branch store.
  const [branchId, setBranchId] = useSelectedBranch({
    branches: scopedBranches,
    defaultBranchId: defaultBranch?.id,
    urlBranchId,
  });
  const [activeTab, setActiveTab] = useState<TabId>(
    urlTab && TAB_IDS.some((id) => id === urlTab) ? urlTab : "ingredients"
  );

  useEffect(() => {
    if (!isLoading && !canAccess) router.replace("/");
  }, [isLoading, canAccess, router]);

  const { isLoading: subLoading, shouldBlockAccess, gateVariant } = useSubscriptionTier(branchId || undefined);
  const canLoadData = Boolean(branchId && user?.organization_id);

  const ingredientsQuery = useIngredients(user?.organization_id ?? "", canLoadData);
  const menuItemsQuery = useMenuItems(branchId, canLoadData);
  const wasteAnalyticsQuery = useWasteAnalytics(branchId, canLoadData);
  const prepBatchesQuery = usePrepBatches(branchId, canLoadData);

  const ingredients = ingredientsQuery.data ?? EMPTY_LIST;
  const menuItems = menuItemsQuery.data ?? EMPTY_LIST;
  const wasteAnalytics = wasteAnalyticsQuery.data;
  const prepBatches = prepBatchesQuery.data ?? EMPTY_LIST;

  const branchOptions = scopedBranches.map((b) => ({ value: b.id, label: b.name }));

  const perishableCount = ingredients.filter((i) => i.is_perishable).length;
  const totalWasteEvents = wasteAnalytics?.total_waste_events ?? 0;
  const topWasteIngredient = wasteAnalytics?.by_ingredient?.[0]?.ingredient_name ?? "—";

  return (
    <WorkspaceShell
      eyebrow={t("workspace.inventory.page.eyebrow")}
      title={t("workspace.inventory.page.title")}
      description={t("workspace.inventory.page.description")}
      insight={t("workspace.inventory.page.insight")}
    >
      {/* Slim context bar */}
      <div className="mb-6 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-6">
        <div className="flex-1 min-w-45 max-w-xs">
          <Select
            label={t("workspace.inventory.page.branchLabel")}
            options={branchOptions}
            value={branchId}
            onChange={setBranchId}
          />
        </div>
        <p className="pb-1 text-xs text-text-muted">
          {t("workspace.inventory.page.branchNote")}
        </p>
      </div>

      {branchId && !subLoading && shouldBlockAccess ? (
        <SubscriptionRequiredState variant={gateVariant} compact />
      ) : (
        <>
      {/* KPI strip */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="text-text-muted">
          <span className="font-semibold text-text-primary">{ingredients.length}</span>{" "}
          {t("workspace.inventory.kpi.ingredients")}
        </span>
        <span className="text-text-muted">
          <span className={`font-semibold ${perishableCount > 0 ? "text-status-warning" : "text-text-primary"}`}>
            {perishableCount}
          </span>{" "}
          {t("workspace.inventory.kpi.perishable")}
        </span>
        <span className="text-text-muted">
          <span className={`font-semibold ${totalWasteEvents > 0 ? "text-status-critical" : "text-text-primary"}`}>
            {totalWasteEvents}
          </span>{" "}
          {t("workspace.inventory.kpi.wasteEvents")}
        </span>
        {topWasteIngredient !== "—" && (
          <span className="text-text-muted">
            {t("workspace.inventory.kpi.topWaste")}{" "}
            <span className="font-semibold text-text-primary">{topWasteIngredient}</span>
          </span>
        )}
        <span className="text-text-muted">
          <span className="font-semibold text-text-primary">{menuItems.length}</span>{" "}
          {t("workspace.inventory.kpi.menuItems")}
        </span>
      </div>

      {/* Tab bar — production style */}
      <div className="mb-6 flex gap-1 border-b border-surface-4/60">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`inline-flex h-10 items-center px-4 text-sm font-medium transition-colors ${
              activeTab === id
                ? "border-b-2 border-brand-gold text-brand-gold"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {id === "stock" ? "Stock" : t(`workspace.inventory.tab.${id}`)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "ingredients" && (
        <IngredientsTab
          ingredients={ingredients}
          isLoading={ingredientsQuery.isLoading}
          organizationId={user?.organization_id ?? ""}
          branchId={branchId}
        />
      )}
      {activeTab === "stock" && (
        <StockTab
          branchId={branchId}
          ingredients={ingredients}
          isLoading={canLoadData ? false : false}
        />
      )}
      {activeTab === "recipes" && (
        <RecipesTab
          menuItems={menuItems}
          ingredients={ingredients}
          isLoading={menuItemsQuery.isLoading}
          branchId={branchId}
          orgId={user?.organization_id ?? ""}
        />
      )}
      {activeTab === "waste" && (
        <WasteTab wasteAnalytics={wasteAnalytics} isLoading={wasteAnalyticsQuery.isLoading} />
      )}
      {activeTab === "signals" && (
        <SignalsTab prepBatches={prepBatches} isLoading={prepBatchesQuery.isLoading} />
      )}
        </>
      )}
    </WorkspaceShell>
  );
}

// ============================================================================
// TAB 1: INGREDIENTS
// ============================================================================

function IngredientsTab({
  ingredients,
  isLoading,
  organizationId,
  branchId,
}: {
  ingredients: Ingredient[];
  isLoading: boolean;
  organizationId: string;
  branchId: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const { t } = useTranslation();

  const overridesQuery = useAvailabilityOverrides(branchId, Boolean(branchId));
  const activeOverrides = (overridesQuery.data ?? []).filter((ov) => ov.is_active);
  const deactivateMutation = useDeactivateAvailabilityOverride(branchId);

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function openEdit(ingredient: Ingredient) {
    setEditTarget(ingredient);
    setModalOpen(true);
  }

  const columns = useMemo(
    () => [
      ingredientColumnHelper.accessor("name", {
        header: t("workspace.inventory.ingredients.colIngredient"),
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">{info.getValue()}</span>
        ),
      }),
      ingredientColumnHelper.accessor("category", {
        header: t("workspace.inventory.ingredients.colCategory"),
        cell: (info) => (
          <span className="text-sm text-text-secondary capitalize">
            {info.getValue()?.toLowerCase().replace(/_/g, " ") || "—"}
          </span>
        ),
      }),
      ingredientColumnHelper.accessor("unit", {
        header: t("workspace.inventory.ingredients.colUnit"),
        cell: (info) => (
          <span className="text-sm text-text-secondary uppercase">{info.getValue()}</span>
        ),
      }),
      ingredientColumnHelper.accessor("shelf_life_days", {
        header: t("workspace.inventory.ingredients.colShelfLife"),
        cell: (info) => {
          const val = info.getValue();
          return (
            <span className={`text-sm ${val && val <= 5 ? "text-status-warning font-semibold" : "text-text-secondary"}`}>
              {val ? `${val}${t("workspace.inventory.ingredients.shelfLifeAbbr")}` : "—"}
            </span>
          );
        },
      }),
      ingredientColumnHelper.accessor("is_perishable", {
        header: t("workspace.inventory.ingredients.colPerishable"),
        cell: (info) => (
          <span
            className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              info.getValue()
                ? "border-status-warning/30 bg-status-warning/10 text-status-warning"
                : "border-surface-4 bg-surface-3 text-text-muted"
            }`}
          >
            {info.getValue() ? t("workspace.inventory.ingredients.badgePerishable") : t("workspace.inventory.ingredients.badgeStable")}
          </span>
        ),
      }),
      ingredientColumnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <button
            type="button"
            onClick={() => openEdit(info.row.original)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-4 text-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
            aria-label={t("workspace.inventory.ingredients.editAria", { name: info.row.original.name })}
          >
            <EditPencil className="h-4 w-4" />
          </button>
        ),
      }),
    ],
    [t],
  );

  const table = useReactTable({ data: ingredients, columns, getCoreRowModel: CORE_ROW_MODEL });

  return (
    <>
      <div>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.inventory.ingredients.sectionLabel")}
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              {t("workspace.inventory.ingredients.title")}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {t("workspace.inventory.ingredients.summary", { count: ingredients.length, perishableCount: ingredients.filter((i) => i.is_perishable).length })}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t("workspace.inventory.ingredients.addButton")}
          </button>
        </div>

        {isLoading ? (
          <LoadingState label={t("workspace.inventory.ingredients.loading")} />
        ) : ingredients.length === 0 ? (
          <div className="rounded-xl border border-surface-4 bg-surface-2 p-12 text-center">
            <p className="text-sm text-text-secondary">{t("workspace.inventory.ingredients.emptyTitle")}</p>
            <p className="mt-1 text-xs text-text-muted">
              {t("workspace.inventory.ingredients.emptyHint")}
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t("workspace.inventory.ingredients.addFirstButton")}
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
            <div className="overflow-x-auto">
              <NativeTable
                table={table}
                tableClassName="w-full min-w-[640px]"
                headerClassName="border-b border-surface-4/80 bg-surface-3/40"
                bodyClassName="divide-y divide-surface-4/50"
                headerCellClassName="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                bodyRowClassName="transition-colors hover:bg-surface-3/20"
                cellClassName="px-4 py-3"
              />
            </div>
          </div>
        )}
      </div>

      <IngredientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        organizationId={organizationId}
        ingredient={editTarget}
      />

      {/* Active availability overrides strip */}
      {branchId && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Availability Overrides
              </p>
              <h3 className="mt-0.5 font-display text-lg font-semibold text-text-primary">
                Active Item Restrictions
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setOverrideModalOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
            >
              <Plus className="h-3.5 w-3.5" /> Add Override
            </button>
          </div>

          {activeOverrides.length === 0 ? (
            <div className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-6 text-center">
              <p className="text-sm text-text-muted">No items marked unavailable.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/50">
              {activeOverrides.map((ov) => (
                <div key={ov.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {ov.item_title ?? ov.item_id}
                    </p>
                    {ov.reason && (
                      <p className="mt-0.5 text-xs text-text-muted truncate">{ov.reason}</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      ov.suppressed_demand
                        ? "border-brand-gold/30 bg-brand-gold/10 text-brand-gold"
                        : "border-status-warning/30 bg-status-warning/10 text-status-warning"
                    }`}
                  >
                    {ov.suppressed_demand ? "Demand Suppressed" : "Supply Constrained"}
                  </span>
                  <span className="text-xs text-text-muted shrink-0">
                    {ov.end_date ? `Until ${ov.end_date}` : "Open-ended"}
                  </span>
                  <button
                    type="button"
                    disabled={deactivateMutation.isPending}
                    onClick={() => deactivateMutation.mutate(ov.id)}
                    className="shrink-0 text-xs text-text-muted transition-colors hover:text-status-critical disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <MarkUnavailableModal
        open={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        branchId={branchId}
        item={null}
      />
    </>
  );
}

// ============================================================================
// TAB 1b: STOCK (on-hand + suppliers)
// ============================================================================

function StockTab({
  branchId,
  ingredients,
}: {
  branchId: string;
  ingredients: Ingredient[];
  isLoading: boolean;
}) {
  const [onHandModalOpen, setOnHandModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

  const onHandQuery = useOnHand(branchId, Boolean(branchId));
  const suppliersQuery = useIngredientSuppliers(branchId, Boolean(branchId));
  const onHandRows = onHandQuery.data ?? EMPTY_LIST;
  const supplierRows = suppliersQuery.data ?? EMPTY_LIST;

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left — On-Hand Log */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">On-Hand Stock</p>
            <h3 className="mt-0.5 font-display text-lg font-semibold text-text-primary">Current Stock Levels</h3>
          </div>
          <button
            type="button"
            onClick={() => setOnHandModalOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
          >
            <Plus className="h-3.5 w-3.5" /> Log Stock
          </button>
        </div>

        {onHandQuery.isLoading ? (
          <LoadingState label="Loading stock levels…" />
        ) : onHandRows.length === 0 ? (
          <div className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-10 text-center">
            <p className="text-sm font-semibold text-text-secondary">No stock entries yet</p>
            <p className="mt-1 text-xs text-text-muted">
              Log on-hand quantities so the purchase forecast can calculate net need.
            </p>
            <button
              type="button"
              onClick={() => setOnHandModalOpen(true)}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416]"
            >
              <Plus className="h-3.5 w-3.5" /> Log First Entry
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
            <table className="w-full">
              <thead className="border-b border-surface-4/80 bg-surface-3/40">
                <tr>
                  {["Ingredient", "Qty", "Unit", "As-of Date", "Notes"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-4/50">
                {onHandRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-3/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-text-primary">{row.ingredient_name ?? row.ingredient_id}</td>
                    <td className="px-4 py-3 text-sm text-brand-gold font-semibold">{Number(row.quantity).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs uppercase text-text-muted">{row.unit}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{row.as_of_date}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{row.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right — Ingredient Suppliers */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Suppliers</p>
            <h3 className="mt-0.5 font-display text-lg font-semibold text-text-primary">Ingredient Suppliers</h3>
          </div>
          <button
            type="button"
            onClick={() => setSupplierModalOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
          >
            <Plus className="h-3.5 w-3.5" /> Add Supplier
          </button>
        </div>

        {suppliersQuery.isLoading ? (
          <LoadingState label="Loading suppliers…" />
        ) : supplierRows.length === 0 ? (
          <div className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-10 text-center">
            <p className="text-sm font-semibold text-text-secondary">No suppliers configured</p>
            <p className="mt-1 text-xs text-text-muted">
              Add suppliers with pack size and cost so the purchase forecast can suggest order quantities.
            </p>
            <button
              type="button"
              onClick={() => setSupplierModalOpen(true)}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416]"
            >
              <Plus className="h-3.5 w-3.5" /> Add First Supplier
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
            <table className="w-full">
              <thead className="border-b border-surface-4/80 bg-surface-3/40">
                <tr>
                  {["Ingredient", "Supplier", "Pack Size", "Cost/Pack", "Lead Time", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-4/50">
                {supplierRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-3/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-text-primary">{row.ingredient_name ?? row.ingredient_id}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{row.supplier_name}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {row.pack_size != null ? `${row.pack_size} ${row.pack_unit}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {row.cost_per_pack != null ? `$${Number(row.cost_per_pack).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{row.lead_time_days}d</td>
                    <td className="px-4 py-3">
                      {row.is_primary && (
                        <span className="inline-flex h-5 items-center rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-gold">
                          Primary
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OnHandModal
        open={onHandModalOpen}
        onClose={() => setOnHandModalOpen(false)}
        branchId={branchId}
        ingredients={ingredients}
      />
      <SupplierModal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        branchId={branchId}
        ingredients={ingredients}
      />
    </div>
  );
}

// ============================================================================
// TAB 2: RECIPES & TRACK RECORD
// ============================================================================

function RecipesTab({
  menuItems,
  ingredients,
  isLoading,
  branchId,
  orgId,
}: {
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  isLoading: boolean;
  branchId: string;
  orgId: string;
}) {
  const { t } = useTranslation();
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const selectedItem = menuItems.find((m) => m.id === selectedMenuItemId) ?? null;

  if (isLoading) return <LoadingState label={t("workspace.inventory.recipes.loading")} />;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left — menu items list */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.inventory.recipes.sectionLabel")}
              </p>
              <h3 className="mt-0.5 font-display text-xl font-semibold text-text-primary">
                {menuItems.length}{" "}
                {menuItems.length === 1
                  ? t("workspace.inventory.recipes.item")
                  : t("workspace.inventory.recipes.items")}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-gold px-3 text-xs font-semibold text-[#141416] transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("workspace.inventory.recipes.addButton")}
            </button>
          </div>

          {menuItems.length === 0 ? (
            <div className="rounded-xl border border-surface-4 bg-surface-2 p-8 text-center">
              <p className="text-sm text-text-secondary">{t("workspace.inventory.recipes.emptyTitle")}</p>
              <p className="mt-1 text-xs text-text-muted">
                {t("workspace.inventory.recipes.emptyHint")}
              </p>
              <button
                type="button"
                onClick={() => { setEditTarget(null); setModalOpen(true); }}
                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416]"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("workspace.inventory.recipes.addFirstButton")}
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/50">
              {menuItems.map((item) => {
                const isSelected = selectedMenuItemId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedMenuItemId(isSelected ? null : item.id)}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-3/30 ${
                      isSelected ? "bg-brand-gold/5 border-l-[3px] border-l-brand-gold" : "border-l-[3px] border-l-transparent"
                    }`}
                  >
                    {/* Thumbnail */}
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-9 w-9 shrink-0 rounded-lg border border-surface-4 object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-4 bg-surface-3 text-[10px] font-bold text-text-muted">
                        {item.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    {/* Name + category */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">{item.name}</p>
                      <p className="text-[11px] text-text-muted truncate">
                        {item.category || t("workspace.inventory.recipes.uncategorized")}
                      </p>
                    </div>

                    {/* Status badges only — edit is in the detail panel */}
                    <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {item.needs_review && (
                        <span
                          className="inline-flex h-5 items-center gap-1 rounded-full border border-status-warning/30 bg-status-warning/10 px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-status-warning"
                          title={t("workspace.inventory.recipes.aiReviewTooltip")}
                        >
                          <SparksSolid className="h-3 w-3" />
                          {t("workspace.inventory.recipes.aiReviewBadge")}
                        </span>
                      )}
                      <span
                        className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                          item.is_active
                            ? "border-status-success/30 bg-status-success/10 text-status-success"
                            : "border-surface-4 bg-surface-3 text-text-muted"
                        }`}
                      >
                        {item.is_active ? t("workspace.inventory.recipes.statusActive") : t("workspace.inventory.recipes.statusInactive")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right — detail panel */}
        <div className="lg:col-span-3">
          {selectedItem ? (
            <ItemDetailPanel
              menuItem={selectedItem}
              ingredients={ingredients}
              branchId={branchId}
              orgId={orgId}
              onEdit={() => { setEditTarget(selectedItem); setModalOpen(true); }}
            />
          ) : (
            <div className="flex h-full min-h-75 items-center justify-center rounded-xl border border-surface-4 bg-surface-2">
              <div className="text-center px-6">
                <p className="text-sm font-semibold text-text-secondary">{t("workspace.inventory.recipes.selectHint")}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {t("workspace.inventory.recipes.selectDescription")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <MenuItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        branchId={branchId}
        menuItem={editTarget}
      />
    </>
  );
}

// ============================================================================
// ITEM DETAIL PANEL — track record + recipe
// ============================================================================

function ItemDetailPanel({
  menuItem,
  ingredients,
  branchId,
  orgId,
  onEdit,
}: {
  menuItem: MenuItem;
  ingredients: Ingredient[];
  branchId: string;
  orgId: string;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const historyQuery = useItemHistory(menuItem.id, { branch_id: branchId, days });
  const recipesQuery = useRecipes(menuItem.id, Boolean(menuItem.id));
  const confirmReview = useConfirmMenuItemReview(branchId);

  const summary = historyQuery.data?.summary ?? null;
  const insights = historyQuery.data?.ai_insights ?? null;
  const timeSeries = historyQuery.data?.time_series ?? EMPTY_LIST;
  const recipes = recipesQuery.data ?? EMPTY_LIST;
  const aiReview = menuItem.needs_review ? menuItem.ai_review ?? null : null;

  return (
    <div className="space-y-4">
      {/* AI-review banner — connector matched or created this item; a human
          confirms (or edits/deletes) before it's considered settled. */}
      {menuItem.needs_review && (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-status-warning">
                <SparksSolid className="h-4 w-4 shrink-0" />
                {aiReview?.ai_provisioned
                  ? t("workspace.inventory.detail.aiReviewCreatedTitle")
                  : t("workspace.inventory.detail.aiReviewMatchedTitle")}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {aiReview?.source_pos_name && (
                  <>
                    {t("workspace.inventory.detail.aiReviewSource")}{" "}
                    <span className="font-semibold text-text-primary">
                      &ldquo;{aiReview.source_pos_name}&rdquo;
                    </span>
                    {" · "}
                  </>
                )}
                {typeof aiReview?.confidence === "number" && (
                  <>
                    {Math.round(aiReview.confidence * 100)}%{" "}
                    {t("workspace.inventory.detail.aiReviewConfidence")}
                  </>
                )}
              </p>
              {(aiReview?.pending_aliases?.length ?? 0) > 0 && (
                <p className="mt-1 text-xs text-text-muted">
                  {t("workspace.inventory.detail.aiReviewAliases")}:{" "}
                  {aiReview!.pending_aliases!
                    .map((a) =>
                      typeof a.confidence === "number"
                        ? `"${a.name}" (${Math.round(a.confidence * 100)}%)`
                        : `"${a.name}"`
                    )
                    .join(", ")}
                </p>
              )}
              <p className="mt-1.5 text-[11px] text-text-muted">
                {t("workspace.inventory.detail.aiReviewHint")}
              </p>
            </div>
            <button
              type="button"
              disabled={confirmReview.isPending}
              onClick={() => confirmReview.mutate(menuItem.id)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-status-warning px-3 text-xs font-semibold text-[#141416] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {confirmReview.isPending
                ? t("workspace.inventory.detail.aiReviewConfirming")
                : t("workspace.inventory.detail.aiReviewConfirm")}
            </button>
          </div>
        </div>
      )}

      {/* Item header card — clearly separated from recipe actions */}
      <div className="rounded-xl border border-surface-4 bg-surface-2 p-4">
        <div className="flex items-start gap-4">
          {/* Thumbnail — clicking it opens the edit modal */}
          <button
            type="button"
            onClick={onEdit}
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-surface-4 bg-surface-3 transition-opacity hover:opacity-80"
            aria-label={t("workspace.inventory.detail.editImageAria")}
          >
            {menuItem.image ? (
              <img
                src={menuItem.image}
                alt={menuItem.name}
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-text-muted">
                {menuItem.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <MediaImage className="h-4 w-4 text-white" />
            </div>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold text-text-primary truncate">
                  {menuItem.name}
                </h3>
                <p className="mt-0.5 text-sm text-text-muted">
                  {menuItem.category || t("workspace.inventory.detail.uncategorized")}
                  {" · "}
                  <span className={menuItem.is_active ? "text-status-success" : "text-text-muted"}>
                    {menuItem.is_active ? t("workspace.inventory.detail.statusActive") : t("workspace.inventory.detail.statusInactive")}
                  </span>
                </p>
              </div>
              {/* "Edit Item" — clearly for name/image/status, not recipe */}
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
              >
                <EditPencil className="h-3.5 w-3.5" />
                {t("workspace.inventory.detail.editButton")}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-text-muted">
              {t("workspace.inventory.detail.editNote")}
            </p>
          </div>
        </div>
      </div>

      {/* Track record window selector — outside the item card */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
          {t("workspace.inventory.detail.trackRecordLabel")}
        </p>
        <div className="flex items-center gap-1">
          {[7, 14, 30].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                days === w
                  ? "bg-brand-gold/20 text-brand-gold"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {t("workspace.inventory.detail.dayButton", { d: w })}
            </button>
          ))}
        </div>
      </div>

      {/* ── Track record ── */}
      <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
        <div className="border-b border-surface-4/60 px-4 py-2.5 flex items-center justify-end">
          <Link
            href={`/workspace/items/${menuItem.id}?branch=${branchId}`}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-brand-gold transition-colors"
          >
            {t("workspace.inventory.detail.fullHistory")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {historyQuery.isLoading ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-text-muted">{t("workspace.inventory.detail.loadingTrack")}</p>
          </div>
        ) : !summary ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-text-muted">
              {historyQuery.data?.data_note ?? t("workspace.inventory.detail.noHistory")}
            </p>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-4 divide-x divide-surface-4/50">
              <TrackKPI
                label={t("workspace.inventory.detail.revenue")}
                value={`$${summary.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                sub={t("workspace.inventory.detail.trackedDays", { d: summary.days_tracked })}
              />
              <TrackKPI
                label={t("workspace.inventory.detail.wasteCost")}
                value={`$${summary.total_waste_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                sub={summary.total_waste_cost > 0 ? t("workspace.inventory.detail.overPrepLoss") : t("workspace.inventory.detail.none")}
                tone={summary.total_waste_cost > 0 ? "warning" : "neutral"}
              />
              <TrackKPI
                label={t("workspace.inventory.detail.stockoutDays")}
                value={String(summary.stockout_days)}
                sub={summary.stockout_days > 0 ? t("workspace.inventory.detail.missedRevenue", { amount: summary.total_lost_revenue.toFixed(0) }) : t("workspace.inventory.detail.neverRanShort")}
                tone={summary.stockout_days > 0 ? "critical" : "neutral"}
              />
              <TrackKPI
                label={t("workspace.inventory.detail.aiAccuracy")}
                value={`${summary.avg_accuracy.toFixed(0)}%`}
                sub={
                  insights
                    ? insights.accuracy_trend === "improving"
                      ? t("workspace.inventory.detail.improving")
                      : insights.accuracy_trend === "declining"
                        ? t("workspace.inventory.detail.declining")
                        : t("workspace.inventory.detail.stable")
                    : t("workspace.inventory.detail.vsActual")
                }
                tone={
                  insights?.accuracy_trend === "improving"
                    ? "success"
                    : insights?.accuracy_trend === "declining"
                      ? "warning"
                      : "neutral"
                }
              />
            </div>

            {/* Mini sparkline */}
            {timeSeries.length > 0 && (
              <div className="border-t border-surface-4/50 px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("workspace.inventory.detail.plannedVsSold")}
                </p>
                <MiniSparkline
                  timeSeries={timeSeries}
                  unit={historyQuery.data?.unit ?? ""}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Recipe ── */}
      <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
        <div className="border-b border-surface-4/60 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.inventory.detail.recipeLabel")}
            </p>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {recipes.length > 0
                ? recipes.length === 1
                  ? t("workspace.inventory.detail.recipeSummary", { count: recipes.length })
                  : t("workspace.inventory.detail.recipeSummaryPlural", { count: recipes.length })
                : t("workspace.inventory.detail.recipeMissing")}
            </p>
          </div>
          <Link
            href={`/workspace/inventory/recipes/${menuItem.id}?name=${encodeURIComponent(menuItem.name)}&branch=${branchId}&org=${orgId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-gold px-3 text-xs font-semibold text-[#141416] transition-opacity hover:opacity-90"
          >
            {recipes.length > 0 ? t("workspace.inventory.detail.editRecipe") : t("workspace.inventory.detail.buildRecipe")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recipesQuery.isLoading ? (
          <div className="px-4 py-5 text-center">
            <p className="text-xs text-text-muted">{t("workspace.inventory.detail.loadingRecipe")}</p>
          </div>
        ) : recipes.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-semibold text-text-secondary">{t("workspace.inventory.detail.noRecipeLines")}</p>
            <p className="mt-1 text-xs text-text-muted max-w-xs mx-auto">
              {t("workspace.inventory.detail.recipeHint")}
            </p>
            <Link
              href={`/workspace/inventory/recipes/${menuItem.id}?name=${encodeURIComponent(menuItem.name)}&branch=${branchId}&org=${orgId}`}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("workspace.inventory.detail.buildRecipeNow")}
            </Link>
          </div>
        ) : (
          <div>
            {/* Recipe accuracy hint */}
            {summary && summary.avg_accuracy < 80 && (
              <div className="border-b border-surface-4/50 bg-status-warning/5 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[11px] text-status-warning font-medium">
                  {t("workspace.inventory.detail.accuracyWarning", { accuracy: summary.avg_accuracy.toFixed(0) })}
                </span>
              </div>
            )}

            {/* Recipe lines */}
            <div className="divide-y divide-surface-4/50">
              {recipes.map((recipe) => {
                const ing = ingredients.find((i) => i.id === recipe.ingredient);
                const wastePct = parseFloat(recipe.waste_factor ?? "0") * 100;
                return (
                  <div key={recipe.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {recipe.ingredient_name ?? ing?.name ?? "—"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] uppercase text-text-muted">
                          {ing?.category?.replace(/_/g, " ") ?? ""}
                        </span>
                        {ing?.is_perishable && (
                          <span className="text-[10px] text-status-warning uppercase tracking-[0.06em]">
                            {t("workspace.inventory.detail.perishableLabel")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <p className="text-sm font-semibold text-brand-gold">
                        {parseFloat(recipe.quantity).toFixed(3)}{" "}
                        <span className="text-[11px] font-normal text-text-muted uppercase">{recipe.unit}</span>
                      </p>
                      {wastePct > 0 && (
                        <p className="text-[11px] text-text-muted">{t("workspace.inventory.detail.wastePercent", { pct: wastePct.toFixed(0) })}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer: category breakdown */}
            {recipes.length > 2 && (
              <div className="border-t border-surface-4/50 px-4 py-3 flex items-center gap-4">
                  <p className="text-[11px] text-text-muted">
                    {t("workspace.inventory.detail.perishableCount", { count: recipes.filter((r) => ingredients.find((i) => i.id === r.ingredient)?.is_perishable).length })}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {t("workspace.inventory.detail.avgWaste", { pct: (recipes.reduce((sum, r) => sum + parseFloat(r.waste_factor ?? "0"), 0) / recipes.length * 100).toFixed(1) })}
                  </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Batch Rules ── */}
      <BatchRuleCard menuItem={menuItem} />
    </div>
  );
}

function BatchRuleCard({ menuItem }: { menuItem: MenuItem }) {
  const itemId = (menuItem as { catalog_item?: string }).catalog_item ?? menuItem.id;
  const batchQuery = useBatchRule(itemId, Boolean(itemId));
  const upsertMutation = useUpsertBatchRule(itemId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ batch_size: "", min_prep: "", max_prep: "", notes: "" });
  const [saveError, setSaveError] = useState<string | null>(null);

  const rule = batchQuery.data ?? null;

  function startEdit() {
    setForm({
      batch_size: rule?.batch_size != null ? String(rule.batch_size) : "",
      min_prep: rule?.min_prep != null ? String(rule.min_prep) : "",
      max_prep: rule?.max_prep != null ? String(rule.max_prep) : "",
      notes: rule?.notes ?? "",
    });
    setSaveError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaveError(null);
    try {
      await upsertMutation.mutateAsync({
        batch_size: form.batch_size ? parseFloat(form.batch_size) : null,
        min_prep: form.min_prep ? parseFloat(form.min_prep) : null,
        max_prep: form.max_prep ? parseFloat(form.max_prep) : null,
        notes: form.notes.trim(),
      });
      setEditing(false);
    } catch {
      setSaveError("Failed to save. Please try again.");
    }
  }

  const fieldClass =
    "w-full h-9 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30 transition-colors";

  return (
    <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
      <div className="border-b border-surface-4/60 px-4 py-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Batch Rules
        </p>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-surface-4 px-2.5 text-xs text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
          >
            <EditPencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>

      {batchQuery.isLoading ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-text-muted">Loading…</p>
        </div>
      ) : editing ? (
        <div className="px-4 py-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "batch_size", label: "Batch Size" },
              { key: "min_prep", label: "Min Prep" },
              { key: "max_prep", label: "Max Prep" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
                  {label}
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder="—"
                  className={fieldClass}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
              Notes
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional note"
              className={fieldClass}
            />
          </div>
          {saveError && (
            <p className="text-xs text-status-critical">{saveError}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={upsertMutation.isPending}
              className="h-8 rounded-lg border border-surface-4 px-3 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={upsertMutation.isPending}
              className="h-8 rounded-lg bg-brand-gold px-4 text-xs font-semibold text-[#141416] hover:opacity-90 disabled:opacity-50"
            >
              {upsertMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : rule == null ? (
        <div className="px-4 py-5 text-center">
          <p className="text-sm text-text-muted">No batch rule — suggested quantities are used as-is.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-surface-4/50">
          {[
            { label: "Batch Size", value: rule.batch_size },
            { label: "Min Prep", value: rule.min_prep },
            { label: "Max Prep", value: rule.max_prep },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{value != null ? value : "—"}</p>
            </div>
          ))}
          {rule.notes && (
            <div className="col-span-3 border-t border-surface-4/50 px-4 py-2.5">
              <p className="text-xs text-text-muted">{rule.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrackKPI({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "neutral" | "success" | "warning" | "critical";
}) {
  const valueClass =
    tone === "success"
      ? "text-status-success"
      : tone === "warning"
        ? "text-status-warning"
        : tone === "critical"
          ? "text-status-critical"
          : "text-text-primary";
  return (
    <div className="px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className={`mt-1.5 font-display text-xl font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-text-muted">{sub}</p>
    </div>
  );
}

// Mini inline sparkline — simplified version of the full chart
function MiniSparkline({
  timeSeries,
  unit,
}: {
  timeSeries: ItemTimeSeriesRow[];
  unit: string;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);

  const maxVal = useMemo(
    () => Math.max(...timeSeries.flatMap((r) => [r.planned_qty, r.actual_sales]), 1),
    [timeSeries],
  );

  const W = 500;
  const H = 72;
  const PAD_X = 4;
  const PAD_Y = 6;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;
  const n = timeSeries.length;
  if (!n) return null;

  const slotW = chartW / n;
  const barW = Math.max(2, slotW * 0.55);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: 72 }}
      >
        {timeSeries.map((row, i) => {
          const cx = PAD_X + (i + 0.5) * slotW;
          const actualH = (row.actual_sales / maxVal) * chartH;
          const plannedH = (row.planned_qty / maxVal) * chartH;
          const isStockout = row.stockout_flag;
          const wasteRatio = row.planned_qty > 0 ? row.waste_qty / row.planned_qty : 0;
          const hasWaste = !isStockout && wasteRatio > 0.08;
          const actualColor = isStockout ? "#ef4444" : hasWaste ? "#f59e0b" : "#22c55e";
          const isHov = hovered === i;

          return (
            <g
              key={row.date}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                x={cx - barW / 2}
                y={H - PAD_Y - plannedH}
                width={barW}
                height={plannedH}
                fill="white"
                fillOpacity={isHov ? 0.15 : 0.06}
                rx={1}
              />
              <rect
                x={cx - barW / 2}
                y={H - PAD_Y - actualH}
                width={barW}
                height={actualH}
                fill={actualColor}
                fillOpacity={isHov ? 0.9 : 0.65}
                rx={1}
              />
            </g>
          );
        })}
      </svg>

      {hovered !== null && timeSeries[hovered] && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 z-10">
          <div className="rounded-lg border border-surface-4 bg-surface-1 px-2.5 py-1.5 shadow-xl text-[11px] text-text-secondary whitespace-nowrap">
            <span className="font-semibold text-text-primary">
              {new Date(`${timeSeries[hovered].date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
            {" · "}{t("workspace.inventory.sparkline.soldValue", { value: timeSeries[hovered].actual_sales.toFixed(1), unit })}
            {timeSeries[hovered].stockout_flag && <span className="ml-1 text-status-critical">{t("workspace.inventory.sparkline.ranShortStatus")}</span>}
            {timeSeries[hovered].waste_qty > 0 && (
              <span className="ml-1 text-status-warning">
                {t("workspace.inventory.sparkline.wasteValue", { value: timeSeries[hovered].waste_qty.toFixed(1) })}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-sm bg-white/20" />{t("workspace.inventory.sparkline.planned")}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-sm bg-status-success/70" />{t("workspace.inventory.sparkline.sold")}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-sm bg-status-warning/70" />{t("workspace.inventory.sparkline.waste")}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-sm bg-status-critical/70" />{t("workspace.inventory.sparkline.ranShort")}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 3: WASTE
// ============================================================================

function WasteTab({ wasteAnalytics, isLoading }: { wasteAnalytics: any; isLoading: boolean }) {
  const { t } = useTranslation();
  if (isLoading) return <LoadingState label={t("workspace.inventory.waste.loading")} />;
  if (!wasteAnalytics) return <EmptyState label={t("workspace.inventory.waste.emptyTitle")} hint={t("workspace.inventory.waste.emptyHint")} />;

  const { by_ingredient, by_reason, total_waste_events } = wasteAnalytics;
  const topWaste = by_ingredient?.[0];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
          {t("workspace.inventory.waste.sectionLabel")}
        </p>
        <h3 className="mt-0.5 font-display text-xl font-semibold text-text-primary">
          {t("workspace.inventory.waste.title")}
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          {t("workspace.inventory.waste.summary", { count: total_waste_events })}
        </p>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="text-text-muted">
          <span className="font-semibold text-status-critical">{total_waste_events ?? 0}</span>{" "}
          {t("workspace.inventory.waste.totalEvents")}
        </span>
        {topWaste && (
          <span className="text-text-muted">
            {t("workspace.inventory.waste.top")}{" "}
            <span className="font-semibold text-text-primary">{topWaste.ingredient_name}</span>{" "}
            ({parseFloat(topWaste.total_waste).toFixed(2)} {t("workspace.inventory.waste.units")})
          </span>
        )}
        {by_reason?.[0] && (
          <span className="text-text-muted">
            {t("workspace.inventory.waste.topReason")}{" "}
            <span className="font-semibold text-text-primary capitalize">
              {by_reason[0].reason?.replace(/_/g, " ")}
            </span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By Ingredient */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            {t("workspace.inventory.waste.byIngredient")}
          </p>
          {by_ingredient?.length ? (
            <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/50">
              {by_ingredient.map((item: any) => {
                const qty = parseFloat(item.total_waste);
                const maxQty = parseFloat(by_ingredient[0].total_waste);
                const pct = maxQty > 0 ? (qty / maxQty) * 100 : 0;
                return (
                  <div key={item.ingredient_id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{item.ingredient_name}</p>
                        {item.is_perishable && (
                          <span className="text-[10px] uppercase tracking-[0.06em] text-status-warning">
                            {t("workspace.inventory.waste.perishable")}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-status-critical">
                        {qty.toFixed(2)} {t("workspace.inventory.waste.units")}
                      </p>
                    </div>
                    <div className="h-1 w-full rounded-full bg-surface-3">
                      <div className="h-1 rounded-full bg-status-critical/50" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t("workspace.inventory.waste.noByIngredient")}</p>
          )}
        </div>

        {/* By Reason */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            {t("workspace.inventory.waste.byReason")}
          </p>
          {by_reason?.length ? (
            <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/50">
              {by_reason.map((item: any) => {
                const qty = parseFloat(item.total_waste);
                const maxQty = parseFloat(by_reason[0].total_waste);
                const pct = maxQty > 0 ? (qty / maxQty) * 100 : 0;
                return (
                  <div key={item.reason} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-text-primary capitalize">
                        {item.reason.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <p className="text-sm font-semibold text-status-warning">
                        {qty.toFixed(2)} {t("workspace.inventory.waste.units")}
                      </p>
                    </div>
                    <div className="h-1 w-full rounded-full bg-surface-3">
                      <div className="h-1 rounded-full bg-status-warning/50" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t("workspace.inventory.waste.noByReason")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 4: STOCK SIGNALS
// ============================================================================

function SignalsTab({ prepBatches, isLoading }: { prepBatches: PrepBatch[]; isLoading: boolean }) {
  const { t } = useTranslation();
  const now = new Date();

  const byIngredient = useMemo(() => {
    const map: Record<string, { name: string; total: number; unit: string; batches: number }> = {};
    for (const batch of prepBatches) {
      const key = batch.ingredient as string;
      const qty = parseFloat(batch.quantity_prepared ?? "0");
      if (!map[key]) map[key] = { name: batch.ingredient_name ?? key, total: 0, unit: batch.unit, batches: 0 };
      map[key].total += qty;
      map[key].batches += 1;
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [prepBatches]);

  const recentBatches = useMemo(
    () =>
      prepBatches
        .filter((b) => now.getTime() - new Date(b.prepared_at).getTime() < 24 * 60 * 60 * 1000)
        .slice(0, 8),
    [prepBatches],
  );

  const columns = useMemo(
    () => [
      prepBatchColumnHelper.accessor("ingredient_name", {
        header: t("workspace.inventory.signals.colIngredient"),
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">{info.getValue() ?? "—"}</span>
        ),
      }),
      prepBatchColumnHelper.accessor("quantity_prepared", {
        header: t("workspace.inventory.signals.colQty"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {parseFloat(info.getValue()).toFixed(2)} {info.row.original.unit}
          </span>
        ),
      }),
      prepBatchColumnHelper.accessor("prepared_at", {
        header: t("workspace.inventory.signals.colPreparedAt"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {new Date(info.getValue()).toLocaleString([], {
              month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </span>
        ),
      }),
      prepBatchColumnHelper.accessor("prepared_by_display", {
        header: t("workspace.inventory.signals.colPreparedBy"),
        cell: (info) => (
          <span className="text-sm text-text-muted">{info.getValue() ?? "—"}</span>
        ),
      }),
    ],
    [t],
  );

  const table = useReactTable({ data: recentBatches, columns, getCoreRowModel: CORE_ROW_MODEL });

  if (isLoading) return <LoadingState label={t("workspace.inventory.signals.loading")} />;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
          {t("workspace.inventory.signals.sectionLabel")}
        </p>
        <h3 className="mt-0.5 font-display text-xl font-semibold text-text-primary">
          {t("workspace.inventory.signals.title")}
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          {t("workspace.inventory.signals.description")}
        </p>
      </div>

      {byIngredient.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            {t("workspace.inventory.signals.mostPrepped")}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {byIngredient.map((item) => (
              <article key={item.name} className="rounded-xl border border-surface-4 bg-surface-2 p-4">
                <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
                <p className="mt-2 font-display text-2xl font-semibold text-brand-gold">
                  {item.total.toFixed(1)}
                </p>
                <p className="text-[11px] text-text-muted uppercase">
                  {item.unit} · {item.batches} {item.batches === 1 ? t("workspace.inventory.signals.batch") : t("workspace.inventory.signals.batches")}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
          {t("workspace.inventory.signals.recentActivity")}
        </p>
        {recentBatches.length === 0 ? (
          <p className="text-sm text-text-muted">{t("workspace.inventory.signals.noActivity")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
            <div className="overflow-x-auto">
              <NativeTable
                table={table}
                tableClassName="w-full min-w-[560px]"
                headerClassName="border-b border-surface-4/80 bg-surface-3/40"
                bodyClassName="divide-y divide-surface-4/50"
                headerCellClassName="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                bodyRowClassName="transition-colors hover:bg-surface-3/20"
                cellClassName="px-4 py-3"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

function LoadingState({ label }: { label: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-text-muted">{label}</p>
    </div>
  );
}

function EmptyState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-text-secondary">{label}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
