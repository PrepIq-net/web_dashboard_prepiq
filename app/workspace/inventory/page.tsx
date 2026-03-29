"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { Plus, EditPencil, ArrowRight } from "iconoir-react";
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
import {
  useIngredients,
  useMenuItems,
  useWasteAnalytics,
  usePrepBatches,
  useRecipes,
} from "@/services/inventory/hooks";
import { IngredientModal } from "@/components/dashboard/inventory/ingredient-modal";
import { MenuItemModal } from "@/components/dashboard/inventory/menu-item-modal";
import type { Ingredient, MenuItem, PrepBatch } from "@/services/inventory/types";

const EMPTY_LIST: never[] = [];
const CORE_ROW_MODEL = getCoreRowModel();

type TabId = "ingredients" | "recipes" | "waste" | "signals";

const TABS = (t: any): Array<{ id: TabId; label: string }> => [
  { id: "ingredients", label: t("workspace.inventory.tabs.ingredients") },
  { id: "recipes", label: t("workspace.inventory.tabs.recipes") },
  { id: "waste", label: t("workspace.inventory.tabs.waste") },
  { id: "signals", label: t("workspace.inventory.tabs.signals") },
];

const ingredientColumnHelper = createColumnHelper<Ingredient>();
const menuItemColumnHelper = createColumnHelper<MenuItem>();
const prepBatchColumnHelper = createColumnHelper<PrepBatch>();

export default function InventoryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const role = user?.organization_role ?? "";
  const canAccess = [
    "STAFF_OPERATOR", "BRANCH_MANAGER", "GM",
    "OPS_DIRECTOR", "ORG_OWNER", "ORG_ADMIN",
  ].includes(role);

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const scopedBranchIds = new Set(accessibleBranches.map((b) => b.id));
  const scopedBranches =
    role === "STAFF_OPERATOR" || role === "BRANCH_MANAGER" || role === "GM"
      ? branches.filter((b) => (scopedBranchIds.size ? scopedBranchIds.has(b.id) : true))
      : branches;

  const defaultBranch =
    scopedBranches.find((b) => b.id === accessScope?.default_branch_id) ??
    scopedBranches.find((b) => b.is_primary) ??
    scopedBranches[0] ??
    null;

  const [branchId, setBranchId] = useState(defaultBranch?.id ?? "");
  const [activeTab, setActiveTab] = useState<TabId>("ingredients");

  useEffect(() => {
    if (!branchId && defaultBranch?.id) setBranchId(defaultBranch.id);
  }, [defaultBranch?.id, branchId]);

  useEffect(() => {
    if (!isLoading && !canAccess) router.replace("/");
  }, [isLoading, canAccess, router]);

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

  // Summary stats
  const perishableCount = ingredients.filter((i) => i.is_perishable).length;
  const totalWasteEvents = wasteAnalytics?.total_waste_events ?? 0;
  const topWasteIngredient = wasteAnalytics?.by_ingredient?.[0]?.ingredient_name ?? "—";

  return (
    <WorkspaceShell
      eyebrow={t("workspace.inventory.eyebrow")}
      title={t("workspace.inventory.title")}
      description={t("workspace.inventory.description")}
      insight={t("workspace.inventory.insight")}
    >
      {/* Controls */}
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Select
            label={t("common.branch")}
            options={branchOptions}
            value={branchId}
            onChange={setBranchId}
          />
          <div className="md:col-span-2 flex items-end">
            <p className="text-xs text-text-muted">
              {t("workspace.inventory.sharedDesc")}
            </p>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="mt-6 pt-6 border-t border-surface-4">
          <div className="flex flex-wrap gap-2">
            {TABS(t).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-10 items-center px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-brand-gold/20 text-brand-gold border border-brand-gold/40 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Summary KPIs */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-8">
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.inventory.tabs.ingredients")}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-text-primary">{ingredients.length}</p>
          <p className="mt-1 text-xs text-text-muted">{t("workspace.inventory.stats.orgCatalog")}</p>
        </article>
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.inventory.ingredients.table.perishable")}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-status-warning">{perishableCount}</p>
          <p className="mt-1 text-xs text-text-muted">{t("workspace.inventory.stats.perishableDesc")}</p>
        </article>
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.inventory.waste.totalEvents")}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-status-critical">{totalWasteEvents}</p>
          <p className="mt-1 text-xs text-text-muted">{t("workspace.inventory.stats.thisBranch")}</p>
        </article>
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.inventory.waste.topIngredient")}</p>
          <p className="mt-2 text-sm font-semibold text-text-primary truncate">{topWasteIngredient}</p>
          <p className="mt-1 text-xs text-text-muted">{t("workspace.inventory.stats.highestVolume")}</p>
        </article>
      </section>

      {/* Tab Content */}
      <section>
        {activeTab === "ingredients" && <IngredientsTab ingredients={ingredients} isLoading={ingredientsQuery.isLoading} organizationId={user?.organization_id ?? ""} />}
        {activeTab === "recipes" && <RecipesTab menuItems={menuItems} ingredients={ingredients} isLoading={menuItemsQuery.isLoading} branchId={branchId} orgId={user?.organization_id ?? ""} />}
        {activeTab === "waste" && <WasteTab wasteAnalytics={wasteAnalytics} isLoading={wasteAnalyticsQuery.isLoading} />}
        {activeTab === "signals" && <SignalsTab prepBatches={prepBatches} isLoading={prepBatchesQuery.isLoading} />}
      </section>
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
}: {
  ingredients: Ingredient[];
  isLoading: boolean;
  organizationId: string;
}) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null);

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
        header: t("workspace.inventory.ingredients.table.ingredient"),
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">{info.getValue()}</span>
        ),
      }),
      ingredientColumnHelper.accessor("category", {
        header: t("workspace.inventory.ingredients.table.category"),
        cell: (info) => (
          <span className="text-sm text-text-secondary capitalize">
            {info.getValue()?.toLowerCase().replace(/_/g, " ") || "—"}
          </span>
        ),
      }),
      ingredientColumnHelper.accessor("unit", {
        header: t("workspace.inventory.ingredients.table.unit"),
        cell: (info) => (
          <span className="text-sm text-text-secondary uppercase">{info.getValue()}</span>
        ),
      }),
      ingredientColumnHelper.accessor("shelf_life_days", {
        header: t("workspace.inventory.ingredients.table.shelfLife"),
        cell: (info) => {
          const val = info.getValue();
          return (
            <span className={`text-sm ${val && val <= 5 ? "text-status-warning" : "text-text-secondary"}`}>
              {val ? `${val}d` : "—"}
            </span>
          );
        },
      }),
      ingredientColumnHelper.accessor("is_perishable", {
        header: t("workspace.inventory.ingredients.table.perishable"),
        cell: (info) => (
          <span className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${
            info.getValue()
              ? "bg-status-warning/10 text-status-warning border border-status-warning/20"
              : "bg-surface-3 text-text-muted border border-surface-4"
          }`}>
            {info.getValue() ? t("workspace.today.closed.yes") : t("workspace.today.closed.no")}
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
            aria-label={`Edit ${info.row.original.name}`}
          >
            <EditPencil className="h-4 w-4" />
          </button>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({ data: ingredients, columns, getCoreRowModel: CORE_ROW_MODEL });

  return (
    <>
      <div>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">{t("workspace.inventory.ingredients.catalog")}</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">{t("workspace.inventory.ingredients.masterTitle")}</h3>
            <p className="mt-1 text-sm text-text-muted">{t("workspace.inventory.ingredients.sharedNote")}</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-gold px-4 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t("workspace.inventory.ingredients.addIngredient")}
          </button>
        </div>

        {isLoading ? (
          <LoadingState label={t("workspace.inventory.ingredients.loading")} />
        ) : ingredients.length === 0 ? (
          <div className="bg-surface-2 rounded-xl border border-surface-4 p-12 text-center">
            <p className="text-sm text-text-secondary">{t("workspace.inventory.ingredients.noIngredients")}</p>
            <p className="mt-1 text-xs text-text-muted">{t("workspace.inventory.ingredients.addFirstHint")}</p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t("workspace.inventory.ingredients.addFirstIngredient")}
            </button>
          </div>
        ) : (
          <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <NativeTable
                table={table}
                tableClassName="w-full min-w-[640px]"
                headerClassName="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4"
                bodyClassName="divide-y divide-surface-4"
                headerCellClassName="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                bodyRowClassName="transition-all duration-200 hover:bg-surface-3/50"
                cellClassName="px-6 py-4"
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
    </>
  );
}

// ============================================================================
// TAB 2: RECIPES
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

  if (isLoading) return <LoadingState label={t("workspace.inventory.recipes.loading")} />;
  if (!menuItems.length) return <EmptyState label={t("workspace.inventory.recipes.noItems")} hint={t("workspace.inventory.recipes.noItemsHint")} />;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">{t("workspace.inventory.recipes.menuItems")}</p>
              <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">{t("workspace.inventory.recipes.branchMenu")}</h3>
              <p className="mt-1 text-sm text-text-muted">{t("workspace.inventory.recipes.buildRecipeNote")}</p>
            </div>
            <button
              type="button"
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-gold px-4 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t("workspace.inventory.recipes.addItem")}
            </button>
          </div>
          <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead className="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">{t("workspace.inventory.recipes.menuItems")}</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">{t("workspace.inventory.ingredients.table.category")}</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">{t("common.status")}</th>
                    <th className="px-6 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4">
                  {menuItems.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedMenuItemId(item.id)}
                      className={`cursor-pointer transition-all duration-200 hover:bg-surface-3/50 ${
                        selectedMenuItemId === item.id ? "bg-brand-gold/5 border-l-2 border-l-brand-gold" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-9 w-9 rounded-lg object-cover border border-surface-4 shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-surface-3 border border-surface-4 shrink-0 flex items-center justify-center text-[10px] text-text-muted font-semibold">
                              {item.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-semibold text-text-primary">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-text-secondary">{item.category || "—"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                            item.is_active
                              ? "bg-status-success/10 text-status-success border border-status-success/20"
                              : "bg-surface-3 text-text-muted border border-surface-4"
                          }`}
                        >
                          {item.is_active
                            ? t("workspace.today.live.onTrack")
                            : t("common.none")}
                        </span>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { setEditTarget(item); setModalOpen(true); }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-4 text-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
                            aria-label={`Edit ${item.name}`}
                          >
                            <EditPencil className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/workspace/inventory/recipes/${item.id}?name=${encodeURIComponent(item.name)}&branch=${branchId}&org=${orgId}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-xs text-text-secondary hover:text-brand-gold hover:border-brand-gold/40 transition-colors"
                          >
                            {t("workspace.inventory.recipes.buildRecipe")}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          {selectedMenuItemId ? (
            <RecipeDetail
              menuItemId={selectedMenuItemId}
              ingredients={ingredients}
              menuItems={menuItems}
              branchId={branchId}
              orgId={orgId}
            />
          ) : (
            <div className="bg-surface-2 rounded-xl border border-surface-4 p-8 flex items-center justify-center h-full min-h-[200px]">
              <p className="text-sm text-text-muted text-center">{t("workspace.inventory.recipes.selectItemPreview")}</p>
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

function RecipeDetail({
  menuItemId,
  ingredients,
  menuItems,
  branchId,
  orgId,
}: {
  menuItemId: string;
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  branchId: string;
  orgId: string;
}) {
  const { t } = useTranslation();
  const recipesQuery = useRecipes(menuItemId, true);
  const recipes = recipesQuery.data ?? EMPTY_LIST;
  const menuItem = menuItems.find((m) => m.id === menuItemId);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">{t("workspace.inventory.recipes.preview")}</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
            {menuItem?.name ?? "—"}
          </h3>
        </div>
        <Link
          href={`/workspace/inventory/recipes/${menuItemId}?name=${encodeURIComponent(menuItem?.name ?? "")}&branch=${branchId}&org=${orgId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-gold/20 border border-brand-gold/40 px-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/30"
        >
          {t("common.edit")}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Item image */}
      {menuItem?.image_url && (
        <div className="mb-4 overflow-hidden rounded-xl border border-surface-4 bg-surface-3 h-40">
          <img
            src={menuItem.image_url}
            alt={menuItem.name}
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
          />
        </div>
      )}

      <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
        {recipesQuery.isLoading ? (
          <div className="p-6 text-sm text-text-muted">{t("workspace.inventory.recipes.loadingRecipe")}</div>
        ) : recipes.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-text-muted">{t("workspace.inventory.recipes.noRecipeLines")}</p>
            <Link
              href={`/workspace/inventory/recipes/${menuItemId}?name=${encodeURIComponent(menuItem?.name ?? "")}&branch=${branchId}&org=${orgId}`}
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-gold px-3 text-xs font-semibold text-[#141416] transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("workspace.inventory.recipes.buildRecipe")}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-surface-4">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{recipe.ingredient_name}</p>
                  <p className="text-xs text-text-muted mt-0.5 uppercase">{recipe.unit}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-brand-gold">{parseFloat(recipe.quantity).toFixed(3)}</p>
                  {parseFloat(recipe.waste_factor) > 0 && (
                    <p className="text-xs text-text-muted">{t("workspace.inventory.recipes.wasteFactor", { percent: (parseFloat(recipe.waste_factor) * 100).toFixed(0) })}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
  if (!wasteAnalytics) return <EmptyState label={t("workspace.inventory.waste.noData")} hint={t("workspace.inventory.waste.noDataHint")} />;

  const { by_ingredient, by_reason, total_waste_events } = wasteAnalytics;
  const topWaste = by_ingredient?.[0];

  return (
    <div className="space-y-8">
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">{t("workspace.inventory.waste.intelligence")}</p>
        <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">{t("workspace.inventory.waste.happeningTitle")}</h3>
        <p className="mt-1 text-sm text-text-muted">{t("workspace.inventory.waste.breakdownNote")}</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.inventory.waste.totalEvents")}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-status-critical">{total_waste_events ?? 0}</p>
        </article>
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.inventory.waste.topIngredient")}</p>
          <p className="mt-2 text-sm font-semibold text-text-primary">{topWaste?.ingredient_name ?? "—"}</p>
          {topWaste && (
            <p className="mt-1 text-xs text-text-muted">{parseFloat(topWaste.total_waste).toFixed(2)} units</p>
          )}
        </article>
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.inventory.waste.topReason")}</p>
          <p className="mt-2 text-sm font-semibold text-text-primary">
            {by_reason?.[0]?.reason?.replace(/_/g, " ") ?? "—"}
          </p>
          {by_reason?.[0] && (
            <p className="mt-1 text-xs text-text-muted">{parseFloat(by_reason[0].total_waste).toFixed(2)} units</p>
          )}
        </article>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* By Ingredient */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">{t("workspace.inventory.waste.byIngredient")}</p>
          {by_ingredient?.length ? (
            <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg divide-y divide-surface-4">
              {by_ingredient.map((item: any) => {
                const qty = parseFloat(item.total_waste);
                const maxQty = parseFloat(by_ingredient[0].total_waste);
                const pct = maxQty > 0 ? (qty / maxQty) * 100 : 0;
                return (
                  <div key={item.ingredient_id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{item.ingredient_name}</p>
                        {item.is_perishable && (
                          <span className="text-[10px] uppercase tracking-[0.08em] text-status-warning">{t("workspace.inventory.ingredients.table.perishable")}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-status-critical">{qty.toFixed(2)} units</p>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-3">
                      <div className="h-1.5 rounded-full bg-status-critical/60" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t("workspace.inventory.waste.noWasteByIngredient")}</p>
          )}
        </div>

        {/* By Reason */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">{t("workspace.inventory.waste.byReason")}</p>
          {by_reason?.length ? (
            <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg divide-y divide-surface-4">
              {by_reason.map((item: any) => {
                const qty = parseFloat(item.total_waste);
                const maxQty = parseFloat(by_reason[0].total_waste);
                const pct = maxQty > 0 ? (qty / maxQty) * 100 : 0;
                return (
                  <div key={item.reason} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-text-primary capitalize">
                        {item.reason.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <p className="text-sm font-semibold text-status-warning">{qty.toFixed(2)} units</p>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-3">
                      <div className="h-1.5 rounded-full bg-status-warning/60" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t("workspace.inventory.waste.noWasteByReason")}</p>
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
        header: t("workspace.inventory.ingredients.table.ingredient"),
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">{info.getValue() ?? "—"}</span>
        ),
      }),
      prepBatchColumnHelper.accessor("quantity_prepared", {
        header: t("workspace.inventory.signals.table.qtyPrepared"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {parseFloat(info.getValue()).toFixed(2)} {info.row.original.unit}
          </span>
        ),
      }),
      prepBatchColumnHelper.accessor("prepared_at", {
        header: t("workspace.inventory.signals.table.preparedAt"),
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
        header: t("workspace.inventory.signals.table.preparedBy"),
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
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">{t("workspace.inventory.signals.title")}</p>
        <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">{t("workspace.inventory.signals.activityTitle")}</h3>
        <p className="mt-1 text-sm text-text-muted">{t("workspace.inventory.signals.activityNote")}</p>
      </div>

      {/* Top prepped */}
      {byIngredient.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">{t("workspace.inventory.signals.mostPrepped")}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {byIngredient.map((item) => (
              <article key={item.name} className="bg-surface-2 rounded-xl p-4 border border-surface-4">
                <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
                <p className="mt-2 font-display text-2xl font-semibold text-brand-gold">
                  {item.total.toFixed(1)}
                </p>
                <p className="text-xs text-text-muted uppercase">
                  {item.unit} · {item.batches === 1 ? t("workspace.inventory.signals.nBatches", { count: 1 }) : t("workspace.inventory.signals.nBatchesPlural", { count: item.batches })}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Recent batches table */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
          {t("workspace.inventory.signals.recentActivity")}
        </p>
        {recentBatches.length === 0 ? (
          <p className="text-sm text-text-muted">{t("workspace.inventory.signals.noActivity")}</p>
        ) : (
          <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <NativeTable
                table={table}
                tableClassName="w-full min-w-[560px]"
                headerClassName="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4"
                bodyClassName="divide-y divide-surface-4"
                headerCellClassName="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                bodyRowClassName="transition-all duration-200 hover:bg-surface-3/50"
                cellClassName="px-6 py-4"
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
