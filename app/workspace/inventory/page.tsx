"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import {
  useIngredients,
  useMenuItems,
  useWasteAnalytics,
  usePrepBatches,
  useRecipes,
} from "@/services/inventory/hooks";
import { useItemHistory } from "@/services/production-intelligence/hooks";
import { IngredientModal } from "@/components/dashboard/inventory/ingredient-modal";
import { MenuItemModal } from "@/components/dashboard/inventory/menu-item-modal";
import type { Ingredient, MenuItem, PrepBatch } from "@/services/inventory/types";
import type { ItemTimeSeriesRow } from "@/services/production-intelligence/types";

const EMPTY_LIST: never[] = [];
const CORE_ROW_MODEL = getCoreRowModel();

type TabId = "ingredients" | "recipes" | "waste" | "signals";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "ingredients", label: "Ingredients" },
  { id: "recipes", label: "Recipes & Track Record" },
  { id: "waste", label: "Waste" },
  { id: "signals", label: "Stock Signals" },
];

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

  const [branchId, setBranchId] = useState(defaultBranch?.id ?? "");
  const [activeTab, setActiveTab] = useState<TabId>(
    urlTab && TABS.some((t) => t.id === urlTab) ? urlTab : "ingredients"
  );

  useEffect(() => {
    if (urlBranchId && scopedBranches.some((b) => b.id === urlBranchId)) {
      setBranchId(urlBranchId);
    } else if (!branchId && defaultBranch?.id) {
      setBranchId(defaultBranch.id);
    }
  }, [urlBranchId, scopedBranches, defaultBranch?.id, branchId]);

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

  const perishableCount = ingredients.filter((i) => i.is_perishable).length;
  const totalWasteEvents = wasteAnalytics?.total_waste_events ?? 0;
  const topWasteIngredient = wasteAnalytics?.by_ingredient?.[0]?.ingredient_name ?? "—";

  return (
    <WorkspaceShell
      eyebrow="Inventory"
      title="Kitchen Intelligence"
      description="Ingredients, recipes, waste, and what's moving — everything the AI needs to forecast accurately."
      insight="Recipe accuracy is the single biggest lever on forecast quality. Every ingredient line you define here feeds the model."
    >
      {/* Slim context bar */}
      <div className="mb-6 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-6">
        <div className="flex-1 min-w-45 max-w-xs">
          <Select
            label="Branch"
            options={branchOptions}
            value={branchId}
            onChange={setBranchId}
          />
        </div>
        <p className="pb-1 text-xs text-text-muted">
          Ingredients are org-wide. Recipes, waste, and prep are branch-specific.
        </p>
      </div>

      {/* KPI strip */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="text-text-muted">
          <span className="font-semibold text-text-primary">{ingredients.length}</span>{" "}
          ingredients
        </span>
        <span className="text-text-muted">
          <span className={`font-semibold ${perishableCount > 0 ? "text-status-warning" : "text-text-primary"}`}>
            {perishableCount}
          </span>{" "}
          perishable
        </span>
        <span className="text-text-muted">
          <span className={`font-semibold ${totalWasteEvents > 0 ? "text-status-critical" : "text-text-primary"}`}>
            {totalWasteEvents}
          </span>{" "}
          waste events
        </span>
        {topWasteIngredient !== "—" && (
          <span className="text-text-muted">
            top waste:{" "}
            <span className="font-semibold text-text-primary">{topWasteIngredient}</span>
          </span>
        )}
        <span className="text-text-muted">
          <span className="font-semibold text-text-primary">{menuItems.length}</span>{" "}
          menu items
        </span>
      </div>

      {/* Tab bar — production style */}
      <div className="mb-6 flex gap-1 border-b border-surface-4/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex h-10 items-center px-4 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-brand-gold text-brand-gold"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "ingredients" && (
        <IngredientsTab
          ingredients={ingredients}
          isLoading={ingredientsQuery.isLoading}
          organizationId={user?.organization_id ?? ""}
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
            <span className={`text-sm ${val && val <= 5 ? "text-status-warning font-semibold" : "text-text-secondary"}`}>
              {val ? `${val}d` : "—"}
            </span>
          );
        },
      }),
      ingredientColumnHelper.accessor("is_perishable", {
        header: "Perishable",
        cell: (info) => (
          <span
            className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              info.getValue()
                ? "border-status-warning/30 bg-status-warning/10 text-status-warning"
                : "border-surface-4 bg-surface-3 text-text-muted"
            }`}
          >
            {info.getValue() ? "Perishable" : "Stable"}
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Ingredient Catalog
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              Org-wide ingredient master
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {ingredients.length} ingredients · {ingredients.filter((i) => i.is_perishable).length} perishable
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add Ingredient
          </button>
        </div>

        {isLoading ? (
          <LoadingState label="Loading ingredients..." />
        ) : ingredients.length === 0 ? (
          <div className="rounded-xl border border-surface-4 bg-surface-2 p-12 text-center">
            <p className="text-sm text-text-secondary">No ingredients yet.</p>
            <p className="mt-1 text-xs text-text-muted">
              Add ingredients to start building recipes and enabling demand forecasting.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add First Ingredient
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
    </>
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
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const selectedItem = menuItems.find((m) => m.id === selectedMenuItemId) ?? null;

  if (isLoading) return <LoadingState label="Loading menu items..." />;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left — menu items list */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Menu Items
              </p>
              <h3 className="mt-0.5 font-display text-xl font-semibold text-text-primary">
                {menuItems.length} item{menuItems.length !== 1 ? "s" : ""}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-gold px-3 text-xs font-semibold text-[#141416] transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </button>
          </div>

          {menuItems.length === 0 ? (
            <div className="rounded-xl border border-surface-4 bg-surface-2 p-8 text-center">
              <p className="text-sm text-text-secondary">No menu items for this branch.</p>
              <p className="mt-1 text-xs text-text-muted">
                Menu items are branch-specific. Add items to build recipes.
              </p>
              <button
                type="button"
                onClick={() => { setEditTarget(null); setModalOpen(true); }}
                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Item
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
                        {item.category || "Uncategorized"}
                      </p>
                    </div>

                    {/* Status + actions */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span
                        className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                          item.is_active
                            ? "border-status-success/30 bg-status-success/10 text-status-success"
                            : "border-surface-4 bg-surface-3 text-text-muted"
                        }`}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setEditTarget(item); setModalOpen(true); }}
                        className="text-[10px] text-text-muted hover:text-brand-gold transition-colors"
                        aria-label={`Edit ${item.name}`}
                      >
                        Edit
                      </button>
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
            />
          ) : (
            <div className="flex h-full min-h-75 items-center justify-center rounded-xl border border-surface-4 bg-surface-2">
              <div className="text-center px-6">
                <p className="text-sm font-semibold text-text-secondary">Select a menu item</p>
                <p className="mt-1 text-xs text-text-muted">
                  See its track record — sales, waste, revenue — and manage its recipe.
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
}: {
  menuItem: MenuItem;
  ingredients: Ingredient[];
  branchId: string;
  orgId: string;
}) {
  const [days, setDays] = useState(30);
  const historyQuery = useItemHistory(menuItem.id, { branch_id: branchId, days });
  const recipesQuery = useRecipes(menuItem.id, Boolean(menuItem.id));

  const summary = historyQuery.data?.summary ?? null;
  const insights = historyQuery.data?.ai_insights ?? null;
  const timeSeries = historyQuery.data?.time_series ?? EMPTY_LIST;
  const recipes = recipesQuery.data ?? EMPTY_LIST;

  return (
    <div className="space-y-4">
      {/* Item header */}
      <div className="flex items-start gap-4">
        {menuItem.image && (
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-surface-4 bg-surface-3">
            <img
              src={menuItem.image}
              alt={menuItem.name}
              className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            Selected Item
          </p>
          <h3 className="mt-0.5 font-display text-xl font-semibold text-text-primary truncate">
            {menuItem.name}
          </h3>
          {menuItem.category && (
            <p className="text-sm text-text-muted">{menuItem.category}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
              {w}d
            </button>
          ))}
        </div>
      </div>

      {/* ── Track record ── */}
      <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
        <div className="border-b border-surface-4/60 px-4 py-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            Track Record · {days}d
          </p>
          <Link
            href={`/workspace/items/${menuItem.id}?branch=${branchId}`}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-brand-gold transition-colors"
          >
            Full history
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {historyQuery.isLoading ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-text-muted">Loading track record…</p>
          </div>
        ) : !summary ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-text-muted">
              {historyQuery.data?.data_note ?? "No sales history yet. Once this item is tracked in production, performance data will appear here."}
            </p>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-4 divide-x divide-surface-4/50">
              <TrackKPI
                label="Revenue"
                value={`$${summary.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                sub={`${summary.days_tracked}d tracked`}
              />
              <TrackKPI
                label="Waste cost"
                value={`$${summary.total_waste_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                sub={summary.total_waste_cost > 0 ? "over-prep loss" : "none"}
                tone={summary.total_waste_cost > 0 ? "warning" : "neutral"}
              />
              <TrackKPI
                label="Stockout days"
                value={String(summary.stockout_days)}
                sub={summary.stockout_days > 0 ? `$${summary.total_lost_revenue.toFixed(0)} missed` : "never ran short"}
                tone={summary.stockout_days > 0 ? "critical" : "neutral"}
              />
              <TrackKPI
                label="AI accuracy"
                value={`${summary.avg_accuracy.toFixed(0)}%`}
                sub={
                  insights
                    ? insights.accuracy_trend === "improving"
                      ? "↑ improving"
                      : insights.accuracy_trend === "declining"
                        ? "↓ declining"
                        : "→ stable"
                    : "vs actual"
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
                  Planned vs Sold
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
              Recipe
            </p>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {recipes.length > 0
                ? `${recipes.length} ingredient${recipes.length !== 1 ? "s" : ""} · each line feeds the forecast model`
                : "No recipe yet — without this, forecasting cannot calculate ingredient demand"}
            </p>
          </div>
          <Link
            href={`/workspace/inventory/recipes/${menuItem.id}?name=${encodeURIComponent(menuItem.name)}&branch=${branchId}&org=${orgId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-gold px-3 text-xs font-semibold text-[#141416] transition-opacity hover:opacity-90"
          >
            {recipes.length > 0 ? "Edit Recipe" : "Build Recipe"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recipesQuery.isLoading ? (
          <div className="px-4 py-5 text-center">
            <p className="text-xs text-text-muted">Loading recipe…</p>
          </div>
        ) : recipes.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-semibold text-text-secondary">No recipe lines yet</p>
            <p className="mt-1 text-xs text-text-muted max-w-xs mx-auto">
              Define ingredients per serving so the AI can calculate how much to prep daily.
              A missing recipe means inaccurate forecasts — fix this first.
            </p>
            <Link
              href={`/workspace/inventory/recipes/${menuItem.id}?name=${encodeURIComponent(menuItem.name)}&branch=${branchId}&org=${orgId}`}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Build Recipe Now
            </Link>
          </div>
        ) : (
          <div>
            {/* Recipe accuracy hint */}
            {summary && summary.avg_accuracy < 80 && (
              <div className="border-b border-surface-4/50 bg-status-warning/5 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[11px] text-status-warning font-medium">
                  Forecast accuracy is {summary.avg_accuracy.toFixed(0)}%. Review recipe quantities — inaccurate portions cause over/under-prep.
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
                            perishable
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
                        <p className="text-[11px] text-text-muted">+{wastePct.toFixed(0)}% waste</p>
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
                  {recipes.filter((r) => ingredients.find((i) => i.id === r.ingredient)?.is_perishable).length} perishable ingredients
                </p>
                <p className="text-[11px] text-text-muted">
                  avg waste: {(recipes.reduce((sum, r) => sum + parseFloat(r.waste_factor ?? "0"), 0) / recipes.length * 100).toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        )}
      </div>
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
            {" · "}Sold {timeSeries[hovered].actual_sales.toFixed(1)} {unit}
            {timeSeries[hovered].stockout_flag && <span className="ml-1 text-status-critical">ran short</span>}
            {timeSeries[hovered].waste_qty > 0 && (
              <span className="ml-1 text-status-warning">
                +{timeSeries[hovered].waste_qty.toFixed(1)} waste
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-sm bg-white/20" />Planned
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-sm bg-status-success/70" />Sold
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-sm bg-status-warning/70" />Waste
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-sm bg-status-critical/70" />Ran short
        </span>
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
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
          Waste Intelligence
        </p>
        <h3 className="mt-0.5 font-display text-xl font-semibold text-text-primary">
          Where waste is happening
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          {total_waste_events} waste events · breakdown by ingredient and reason.
        </p>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="text-text-muted">
          <span className="font-semibold text-status-critical">{total_waste_events ?? 0}</span>{" "}
          total events
        </span>
        {topWaste && (
          <span className="text-text-muted">
            top:{" "}
            <span className="font-semibold text-text-primary">{topWaste.ingredient_name}</span>{" "}
            ({parseFloat(topWaste.total_waste).toFixed(2)} units)
          </span>
        )}
        {by_reason?.[0] && (
          <span className="text-text-muted">
            top reason:{" "}
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
            By Ingredient
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
                            perishable
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-status-critical">
                        {qty.toFixed(2)} units
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
            <p className="text-sm text-text-muted">No waste by ingredient recorded.</p>
          )}
        </div>

        {/* By Reason */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            By Reason
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
                        {qty.toFixed(2)} units
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
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
          Stock Signals
        </p>
        <h3 className="mt-0.5 font-display text-xl font-semibold text-text-primary">
          Prep activity and volume
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          Most prepped ingredients and recent batch activity.
        </p>
      </div>

      {byIngredient.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            Most Prepped Ingredients
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {byIngredient.map((item) => (
              <article key={item.name} className="rounded-xl border border-surface-4 bg-surface-2 p-4">
                <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
                <p className="mt-2 font-display text-2xl font-semibold text-brand-gold">
                  {item.total.toFixed(1)}
                </p>
                <p className="text-[11px] text-text-muted uppercase">
                  {item.unit} · {item.batches} batch{item.batches !== 1 ? "es" : ""}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
          Recent Prep Activity (last 24h)
        </p>
        {recentBatches.length === 0 ? (
          <p className="text-sm text-text-muted">No prep activity in the last 24 hours.</p>
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
