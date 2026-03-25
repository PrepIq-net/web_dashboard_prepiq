"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { Ingredient, MenuItem, PrepBatch } from "@/services/inventory/types";

const EMPTY_LIST: never[] = [];
const CORE_ROW_MODEL = getCoreRowModel();

type TabId = "ingredients" | "recipes" | "waste" | "signals";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "ingredients", label: "Ingredients" },
  { id: "recipes", label: "Recipes" },
  { id: "waste", label: "Waste" },
  { id: "signals", label: "Stock Signals" },
];

const ingredientColumnHelper = createColumnHelper<Ingredient>();
const menuItemColumnHelper = createColumnHelper<MenuItem>();
const prepBatchColumnHelper = createColumnHelper<PrepBatch>();

export default function InventoryPage() {
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
      eyebrow="Inventory"
      title="Kitchen Intelligence"
      description="What ingredients do you have? How much is needed? What's being wasted? What's at risk?"
      insight="Inventory precision compounds when ingredient planning is tied to actual usage patterns and waste is reviewed daily."
    >
      {/* Controls */}
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Select
            label="Branch"
            options={branchOptions}
            value={branchId}
            onChange={setBranchId}
          />
          <div className="md:col-span-2 flex items-end">
            <p className="text-xs text-text-muted">
              Ingredients are shared across all branches. Menu items, recipes, prep batches, and waste are branch-specific.
            </p>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="mt-6 pt-6 border-t border-surface-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
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
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Ingredients</p>
          <p className="mt-2 font-display text-3xl font-semibold text-text-primary">{ingredients.length}</p>
          <p className="mt-1 text-xs text-text-muted">org-wide catalog</p>
        </article>
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Perishable</p>
          <p className="mt-2 font-display text-3xl font-semibold text-status-warning">{perishableCount}</p>
          <p className="mt-1 text-xs text-text-muted">need daily tracking</p>
        </article>
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Waste Events</p>
          <p className="mt-2 font-display text-3xl font-semibold text-status-critical">{totalWasteEvents}</p>
          <p className="mt-1 text-xs text-text-muted">this branch</p>
        </article>
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Top Waste Item</p>
          <p className="mt-2 text-sm font-semibold text-text-primary truncate">{topWasteIngredient}</p>
          <p className="mt-1 text-xs text-text-muted">highest waste volume</p>
        </article>
      </section>

      {/* Tab Content */}
      <section>
        {activeTab === "ingredients" && <IngredientsTab ingredients={ingredients} isLoading={ingredientsQuery.isLoading} />}
        {activeTab === "recipes" && <RecipesTab menuItems={menuItems} ingredients={ingredients} isLoading={menuItemsQuery.isLoading} />}
        {activeTab === "waste" && <WasteTab wasteAnalytics={wasteAnalytics} isLoading={wasteAnalyticsQuery.isLoading} />}
        {activeTab === "signals" && <SignalsTab prepBatches={prepBatches} isLoading={prepBatchesQuery.isLoading} />}
      </section>
    </WorkspaceShell>
  );
}

// ============================================================================
// TAB 1: INGREDIENTS
// ============================================================================

function IngredientsTab({ ingredients, isLoading }: { ingredients: Ingredient[]; isLoading: boolean }) {
  const columns = useMemo(
    () => [
      ingredientColumnHelper.accessor("name", {
        header: "Ingredient",
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">{info.getValue()}</span>
        ),
      }),
      ingredientColumnHelper.accessor("category", {
        header: "Category",
        cell: (info) => (
          <span className="text-sm text-text-secondary capitalize">
            {info.getValue()?.toLowerCase().replace(/_/g, " ") || "—"}
          </span>
        ),
      }),
      ingredientColumnHelper.accessor("unit", {
        header: "Unit",
        cell: (info) => (
          <span className="text-sm text-text-secondary uppercase">{info.getValue()}</span>
        ),
      }),
      ingredientColumnHelper.accessor("shelf_life_days", {
        header: "Shelf Life",
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
        header: "Perishable",
        cell: (info) => (
          <span className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${
            info.getValue()
              ? "bg-status-warning/10 text-status-warning border border-status-warning/20"
              : "bg-surface-3 text-text-muted border border-surface-4"
          }`}>
            {info.getValue() ? "Yes" : "No"}
          </span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({ data: ingredients, columns, getCoreRowModel: CORE_ROW_MODEL });

  if (isLoading) return <LoadingState label="Loading ingredients..." />;
  if (!ingredients.length) return <EmptyState label="No ingredients found." hint="Run the seed command or add ingredients to get started." />;

  return (
    <div>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Ingredient Catalog</p>
        <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
          Org-wide ingredient master
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          Shared across all branches. Perishable items need daily tracking.
        </p>
      </div>
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
    </div>
  );
}

// ============================================================================
// TAB 2: RECIPES
// ============================================================================

function RecipesTab({
  menuItems,
  ingredients,
  isLoading,
}: {
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  isLoading: boolean;
}) {
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string | null>(null);

  const columns = useMemo(
    () => [
      menuItemColumnHelper.accessor("name", {
        header: "Menu Item",
        cell: (info) => (
          <button
            type="button"
            onClick={() => setSelectedMenuItemId(info.row.original.id)}
            className="text-sm font-semibold text-text-primary hover:text-brand-gold transition-colors text-left"
          >
            {info.getValue()}
          </button>
        ),
      }),
      menuItemColumnHelper.accessor("category", {
        header: "Category",
        cell: (info) => (
          <span className="text-sm text-text-secondary">{info.getValue() || "—"}</span>
        ),
      }),
      menuItemColumnHelper.accessor("is_active", {
        header: "Status",
        cell: (info) => (
          <span className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${
            info.getValue()
              ? "bg-status-success/10 text-status-success border border-status-success/20"
              : "bg-surface-3 text-text-muted border border-surface-4"
          }`}>
            {info.getValue() ? "Active" : "Inactive"}
          </span>
        ),
      }),
      menuItemColumnHelper.display({
        id: "action",
        header: "",
        cell: (info) => (
          <button
            type="button"
            onClick={() => setSelectedMenuItemId(info.row.original.id)}
            className="inline-flex h-8 items-center rounded-lg border border-surface-4 px-3 text-xs text-text-secondary hover:text-brand-gold hover:border-brand-gold/40 transition-colors"
          >
            View Recipe
          </button>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({ data: menuItems, columns, getCoreRowModel: CORE_ROW_MODEL });

  if (isLoading) return <LoadingState label="Loading menu items..." />;
  if (!menuItems.length) return <EmptyState label="No menu items found." hint="Menu items are branch-specific. Add items to this branch to build recipes." />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Menu Items</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">Branch menu</h3>
          <p className="mt-1 text-sm text-text-muted">Select an item to view its recipe.</p>
        </div>
        <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <NativeTable
              table={table}
              tableClassName="w-full min-w-[480px]"
              headerClassName="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4"
              bodyClassName="divide-y divide-surface-4"
              headerCellClassName="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
              bodyRowClassName={(row) =>
                `transition-all duration-200 hover:bg-surface-3/50 ${
                  selectedMenuItemId === row.original.id ? "bg-brand-gold/5 border-l-2 border-l-brand-gold" : ""
                }`
              }
              cellClassName="px-6 py-4"
            />
          </div>
        </div>
      </div>

      <div>
        {selectedMenuItemId ? (
          <RecipeDetail menuItemId={selectedMenuItemId} ingredients={ingredients} menuItems={menuItems} />
        ) : (
          <div className="bg-surface-2 rounded-xl border border-surface-4 p-8 flex items-center justify-center h-full min-h-[200px]">
            <p className="text-sm text-text-muted text-center">Select a menu item to view its recipe</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipeDetail({
  menuItemId,
  ingredients,
  menuItems,
}: {
  menuItemId: string;
  ingredients: Ingredient[];
  menuItems: MenuItem[];
}) {
  const recipesQuery = useRecipes(menuItemId, true);
  const recipes = recipesQuery.data ?? EMPTY_LIST;
  const menuItem = menuItems.find((m) => m.id === menuItemId);

  return (
    <div>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Recipe</p>
        <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
          {menuItem?.name ?? "—"}
        </h3>
      </div>
      <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
        {recipesQuery.isLoading ? (
          <div className="p-6 text-sm text-text-muted">Loading recipe...</div>
        ) : recipes.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">No recipe lines yet.</div>
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
                    <p className="text-xs text-text-muted">+{(parseFloat(recipe.waste_factor) * 100).toFixed(0)}% waste</p>
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
  if (isLoading) return <LoadingState label="Loading waste analytics..." />;
  if (!wasteAnalytics) return <EmptyState label="No waste data available." hint="Waste events will appear here once recorded for this branch." />;

  const { by_ingredient, by_reason, total_waste_events } = wasteAnalytics;
  const topWaste = by_ingredient?.[0];

  return (
    <div className="space-y-8">
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Waste Intelligence</p>
        <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">Where waste is happening</h3>
        <p className="mt-1 text-sm text-text-muted">Breakdown by ingredient and by reason.</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Total Events</p>
          <p className="mt-2 font-display text-3xl font-semibold text-status-critical">{total_waste_events ?? 0}</p>
        </article>
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Top Waste Ingredient</p>
          <p className="mt-2 text-sm font-semibold text-text-primary">{topWaste?.ingredient_name ?? "—"}</p>
          {topWaste && (
            <p className="mt-1 text-xs text-text-muted">{parseFloat(topWaste.total_waste).toFixed(2)} units</p>
          )}
        </article>
        <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Top Waste Reason</p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">By Ingredient</p>
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
                          <span className="text-[10px] uppercase tracking-[0.08em] text-status-warning">perishable</span>
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
            <p className="text-sm text-text-muted">No waste by ingredient recorded.</p>
          )}
        </div>

        {/* By Reason */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">By Reason</p>
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
            <p className="text-sm text-text-muted">No waste reasons recorded.</p>
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
        header: "Ingredient",
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">{info.getValue() ?? "—"}</span>
        ),
      }),
      prepBatchColumnHelper.accessor("quantity_prepared", {
        header: "Qty Prepared",
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {parseFloat(info.getValue()).toFixed(2)} {info.row.original.unit}
          </span>
        ),
      }),
      prepBatchColumnHelper.accessor("prepared_at", {
        header: "Prepared At",
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
        header: "Prepared By",
        cell: (info) => (
          <span className="text-sm text-text-muted">{info.getValue() ?? "—"}</span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({ data: recentBatches, columns, getCoreRowModel: CORE_ROW_MODEL });

  if (isLoading) return <LoadingState label="Loading stock signals..." />;

  return (
    <div className="space-y-8">
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Stock Signals</p>
        <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">Prep activity and volume</h3>
        <p className="mt-1 text-sm text-text-muted">Most prepped ingredients and recent batch activity.</p>
      </div>

      {/* Top prepped */}
      {byIngredient.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">Most Prepped Ingredients</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {byIngredient.map((item) => (
              <article key={item.name} className="bg-surface-2 rounded-xl p-4 border border-surface-4">
                <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
                <p className="mt-2 font-display text-2xl font-semibold text-brand-gold">
                  {item.total.toFixed(1)}
                </p>
                <p className="text-xs text-text-muted uppercase">{item.unit} · {item.batches} batch{item.batches !== 1 ? "es" : ""}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Recent batches table */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
          Recent Prep Activity (last 24h)
        </p>
        {recentBatches.length === 0 ? (
          <p className="text-sm text-text-muted">No prep activity in the last 24 hours.</p>
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
