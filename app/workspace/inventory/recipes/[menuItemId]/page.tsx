"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Trash, Plus, Search, Check, WarningTriangle } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUserProfile } from "@/services";
import {
  useIngredients,
  useRecipes,
  useCreateRecipe,
  useDeleteRecipe,
} from "@/services/inventory/hooks";
import type { Ingredient, Recipe } from "@/services/inventory/types";

// ============================================================================
// TYPES
// ============================================================================

// A pending line is one the user is building before saving
type PendingLine = {
  key: string; // local-only key for React
  ingredient: Ingredient;
  quantity: string;
  waste_factor: string;
  saving: boolean;
  error: string | null;
};

// ============================================================================
// PAGE SHELL
// ============================================================================

function RecipeBuilderContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ menuItemId: string }>();
  const searchParams = useSearchParams();
  const menuItemId = params.menuItemId;
  const menuItemName = searchParams.get("name") ?? "Menu Item";
  const branchId = searchParams.get("branch") ?? "";
  const orgId = searchParams.get("org") ?? "";

  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const resolvedOrgId = orgId || user?.organization_id || "";

  const ingredientsQuery = useIngredients(resolvedOrgId, Boolean(resolvedOrgId));
  const recipesQuery = useRecipes(menuItemId, Boolean(menuItemId));

  const ingredients = ingredientsQuery.data ?? [];
  const savedRecipes = recipesQuery.data ?? [];

  const createRecipeMutation = useCreateRecipe(menuItemId);
  const deleteRecipeMutation = useDeleteRecipe(menuItemId);

  // Search state for ingredient picker
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Pending lines (not yet saved)
  const [pendingLines, setPendingLines] = useState<PendingLine[]>([]);

  // Already-used ingredient IDs (saved + pending)
  const usedIngredientIds = useMemo(() => {
    const saved = new Set(savedRecipes.map((r) => r.ingredient));
    const pending = new Set(pendingLines.map((l) => l.ingredient.id));
    return new Set([...saved, ...pending]);
  }, [savedRecipes, pendingLines]);

  // Filtered ingredient list for picker
  const filteredIngredients = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ingredients
      .filter((i) => !usedIngredientIds.has(i.id))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [ingredients, usedIngredientIds, search]);

  // Cost estimate: sum of (quantity * ingredient standard_cost) — we don't have cost on ingredient
  // so we just show quantity totals grouped by category
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; lines: Array<{ name: string; qty: string; unit: string }> }> = {};
    for (const recipe of savedRecipes) {
      const ing = ingredients.find((i) => i.id === recipe.ingredient);
      const cat = ing?.category || "other";
      if (!map[cat]) map[cat] = { count: 0, lines: [] };
      map[cat].count += 1;
      map[cat].lines.push({
        name: recipe.ingredient_name ?? ing?.name ?? "—",
        qty: recipe.quantity,
        unit: recipe.unit,
      });
    }
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [savedRecipes, ingredients]);

  function openPicker() {
    setPickerOpen(true);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function selectIngredient(ingredient: Ingredient) {
    setPendingLines((prev) => [
      ...prev,
      {
        key: `${ingredient.id}-${Date.now()}`,
        ingredient,
        quantity: "",
        waste_factor: "0",
        saving: false,
        error: null,
      },
    ]);
    setPickerOpen(false);
    setSearch("");
  }

  function updatePendingLine(key: string, field: "quantity" | "waste_factor", value: string) {
    setPendingLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value, error: null } : l))
    );
  }

  function removePendingLine(key: string) {
    setPendingLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function saveLine(key: string) {
    const line = pendingLines.find((l) => l.key === key);
    if (!line) return;

    const qty = parseFloat(line.quantity);
    if (!line.quantity || isNaN(qty) || qty <= 0) {
      setPendingLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, error: t("workspace.inventory.recipes.quantityError") } : l))
      );
      return;
    }

    setPendingLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, saving: true, error: null } : l))
    );

    try {
      await createRecipeMutation.mutateAsync({
        ingredient: line.ingredient.id,
        quantity: qty,
        unit: line.ingredient.unit,
        waste_factor: parseFloat(line.waste_factor) / 100 || 0,
      });
      setPendingLines((prev) => prev.filter((l) => l.key !== key));
    } catch {
      setPendingLines((prev) =>
        prev.map((l) =>
          l.key === key ? { ...l, saving: false, error: t("workspace.inventory.recipes.saveFailed") } : l
        )
      );
    }
  }

  async function deleteRecipe(recipeId: string) {
    await deleteRecipeMutation.mutateAsync(recipeId);
  }

  const isLoading = ingredientsQuery.isLoading || recipesQuery.isLoading;
  const totalLines = savedRecipes.length + pendingLines.length;

  return (
    <WorkspaceShell
      eyebrow={t("workspace.inventory.recipes.eyebrow")}
      title={menuItemName}
      description={t("workspace.inventory.recipes.description")}
      insight={t("workspace.inventory.recipes.insight")}
    >
      {/* Back nav */}
      <div className="mb-8">
        <Link
          href={`/workspace/inventory?branch=${branchId}&tab=recipes`}
          className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("workspace.inventory.recipes.backToInventory")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* ================================================================
            LEFT: Recipe lines
        ================================================================ */}
        <div className="lg:col-span-2 space-y-6">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.inventory.recipes.ingredients")}
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
                {totalLines === 0
                  ? t("workspace.inventory.recipes.noIngredientsYet")
                  : t("workspace.inventory.recipes.ingredientCount", { count: savedRecipes.length })}
              </h3>
            </div>
            <button
              type="button"
              onClick={openPicker}
              disabled={isLoading}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-gold px-4 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              {t("workspace.inventory.recipes.addIngredient")}
            </button>
          </div>

          {/* Saved recipe lines */}
          {isLoading ? (
            <div className="bg-surface-2 rounded-xl border border-surface-4 p-8 text-center">
              <p className="text-sm text-text-muted">{t("workspace.inventory.recipes.loadingRecipe")}</p>
            </div>
          ) : savedRecipes.length === 0 && pendingLines.length === 0 ? (
            <div className="bg-surface-2 rounded-xl border border-surface-4 p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 border border-surface-4">
                <Plus className="h-5 w-5 text-text-muted" />
              </div>
              <p className="text-sm font-semibold text-text-secondary">{t("workspace.inventory.recipes.startBuilding")}</p>
              <p className="mt-1 text-xs text-text-muted">
                {t("workspace.inventory.recipes.addIngredientsHint")}
              </p>
              <button
                type="button"
                onClick={openPicker}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                {t("workspace.inventory.recipes.addFirstIngredient")}
              </button>
            </div>
          ) : (
            <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_140px_100px_48px] gap-4 border-b border-surface-4 bg-gradient-to-br from-surface-3 to-surface-2 px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">{t("workspace.inventory.recipes.ingredient")}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">{t("workspace.inventory.recipes.qtyPerServing")}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted" title={t("workspace.inventory.recipes.prepLossTooltip")}>
                  {t("workspace.inventory.recipes.prepLossPct")}
                </p>
                <span />
              </div>

              {/* Saved lines */}
              <div className="divide-y divide-surface-4">
                {savedRecipes.map((recipe) => (
                  <SavedRecipeLine
                    key={recipe.id}
                    recipe={recipe}
                    ingredient={ingredients.find((i) => i.id === recipe.ingredient)}
                    onDelete={() => deleteRecipe(recipe.id)}
                    isDeleting={deleteRecipeMutation.isPending}
                  />
                ))}

                {/* Pending lines */}
                {pendingLines.map((line) => (
                  <PendingRecipeLine
                    key={line.key}
                    line={line}
                    onQuantityChange={(v) => updatePendingLine(line.key, "quantity", v)}
                    onWasteChange={(v) => updatePendingLine(line.key, "waste_factor", v)}
                    onSave={() => saveLine(line.key)}
                    onRemove={() => removePendingLine(line.key)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================
            RIGHT: Summary panel
        ================================================================ */}
        <div className="space-y-6">
          {/* Recipe stats */}
          <div className="bg-surface-2 rounded-xl border border-surface-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-4">
              {t("workspace.inventory.recipes.recipeSummary")}
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">{t("workspace.inventory.recipes.totalIngredients")}</p>
                <p className="text-sm font-semibold text-text-primary">{savedRecipes.length}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">{t("workspace.inventory.recipes.perishable")}</p>
                <p className="text-sm font-semibold text-status-warning">
                  {savedRecipes.filter((r) => ingredients.find((i) => i.id === r.ingredient)?.is_perishable).length}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">{t("workspace.inventory.recipes.unsavedLines")}</p>
                <p className={`text-sm font-semibold ${pendingLines.length > 0 ? "text-brand-gold" : "text-text-muted"}`}>
                  {pendingLines.length}
                </p>
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-surface-2 rounded-xl border border-surface-4 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
                {t("workspace.inventory.recipes.byCategory")}
              </p>
              <div className="space-y-3">
                {categoryBreakdown.map(([cat, data]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold capitalize text-text-secondary">
                        {cat.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-text-muted">{data.count}</p>
                    </div>
                    <div className="h-1 w-full rounded-full bg-surface-3">
                      <div
                        className="h-1 rounded-full bg-brand-gold/50"
                        style={{ width: `${(data.count / savedRecipes.length) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tip */}
          <div className="rounded-xl border border-surface-4 bg-surface-2 p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-2">
                {t("workspace.inventory.recipes.qtyPerServing")}
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                {t("workspace.inventory.recipes.qtyPerServingTip")}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-2">
                {t("workspace.inventory.recipes.prepLossPct")}
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                {t("workspace.inventory.recipes.prepLossTip")}
              </p>
              <div className="mt-2 rounded-lg bg-surface-3 px-3 py-2 text-[11px] text-text-muted">
                {t("workspace.inventory.recipes.prepLossExample")}
              </div>
              <p className="mt-2 text-[11px] text-text-muted">{t("workspace.inventory.recipes.prepLossZero")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredient Picker Overlay */}
      {pickerOpen && (
        <IngredientPicker
          ingredients={filteredIngredients}
          search={search}
          searchRef={searchRef}
          onSearch={setSearch}
          onSelect={selectIngredient}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </WorkspaceShell>
  );
}

// ============================================================================
// SAVED RECIPE LINE
// ============================================================================

function SavedRecipeLine({
  recipe,
  ingredient,
  onDelete,
  isDeleting,
}: {
  recipe: Recipe;
  ingredient: Ingredient | undefined;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useTranslation();
  const wastePct = parseFloat(recipe.waste_factor ?? "0") * 100;

  return (
    <div className="grid grid-cols-[1fr_140px_100px_48px] gap-4 items-center px-5 py-4 transition-colors hover:bg-surface-3/40">
      {/* Ingredient info */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">
          {recipe.ingredient_name ?? ingredient?.name ?? "—"}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.06em] text-text-muted">
            {ingredient?.category?.replace(/_/g, " ") ?? "—"}
          </span>
          {ingredient?.is_perishable && (
            <span className="text-[10px] uppercase tracking-[0.06em] text-status-warning">
              · {t("workspace.inventory.recipes.perishable")}
            </span>
          )}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <p className="text-sm font-semibold text-brand-gold">
          {parseFloat(recipe.quantity).toFixed(3)}
        </p>
        <p className="text-[11px] uppercase text-text-muted">{recipe.unit}</p>
      </div>

      {/* Waste factor */}
      <div>
        {wastePct > 0 ? (
          <span className="inline-flex h-6 items-center rounded-md bg-surface-3 border border-surface-4 px-2 text-[11px] font-semibold text-text-muted">
            +{wastePct.toFixed(0)}%
          </span>
        ) : (
          <span className="text-[11px] text-text-muted">—</span>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-status-critical/10 hover:text-status-critical disabled:opacity-40"
        aria-label={t("workspace.inventory.recipes.removeIngredientAria")}
      >
        <Trash className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================================================
// PENDING RECIPE LINE (being edited before save)
// ============================================================================

function PendingRecipeLine({
  line,
  onQuantityChange,
  onWasteChange,
  onSave,
  onRemove,
}: {
  line: PendingLine;
  onQuantityChange: (v: string) => void;
  onWasteChange: (v: string) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const qtyRef = useRef<HTMLInputElement>(null);

  // Auto-focus quantity when line appears
  useEffect(() => {
    setTimeout(() => qtyRef.current?.focus(), 30);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onSave();
    if (e.key === "Escape") onRemove();
  }

  return (
    <div className={`grid grid-cols-[1fr_140px_100px_48px] gap-4 items-start px-5 py-4 bg-brand-gold/5 border-l-2 border-l-brand-gold`}>
      {/* Ingredient info */}
      <div className="min-w-0 pt-1">
        <p className="text-sm font-semibold text-text-primary truncate">{line.ingredient.name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.06em] text-text-muted">
            {line.ingredient.category?.replace(/_/g, " ") ?? "—"}
          </span>
          {line.ingredient.is_perishable && (
            <span className="text-[10px] uppercase tracking-[0.06em] text-status-warning">
              · {t("workspace.inventory.recipes.perishable")}
            </span>
          )}
        </div>
        {line.error && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-status-critical">
            <WarningTriangle className="h-3 w-3 flex-shrink-0" />
            {line.error}
          </p>
        )}
      </div>

      {/* Quantity input */}
      <div>
        <div className="flex items-center gap-1.5">
          <input
            ref={qtyRef}
            type="number"
            min="0.001"
            step="0.001"
            value={line.quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0.000"
            className={`w-full h-9 rounded-lg border px-3 text-sm font-semibold text-text-primary placeholder:text-text-muted bg-surface-3 focus:outline-none focus:ring-1 transition-colors ${
              line.error
                ? "border-status-critical/50 focus:border-status-critical focus:ring-status-critical/20"
                : "border-surface-4 focus:border-brand-gold/60 focus:ring-brand-gold/20"
            }`}
          />
          <span className="text-[11px] uppercase text-text-muted whitespace-nowrap">
            {line.ingredient.unit}
          </span>
        </div>
      </div>

      {/* Prep Loss % */}
      <div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={line.waste_factor}
            onChange={(e) => onWasteChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0"
            title={t("workspace.inventory.recipes.wasteInputTitle")}
            className="w-full h-9 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/20 transition-colors"
          />
          <span className="text-[11px] text-text-muted">%</span>
        </div>
      </div>

      {/* Save / remove */}
      <div className="flex flex-col gap-1 pt-0.5">
        <button
          type="button"
          onClick={onSave}
          disabled={line.saving}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold/20 border border-brand-gold/40 text-brand-gold transition-colors hover:bg-brand-gold/30 disabled:opacity-40"
          aria-label={t("workspace.inventory.recipes.saveLineAria")}
        >
          {line.saving ? (
            <span className="h-3 w-3 rounded-full border-2 border-brand-gold/40 border-t-brand-gold animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={line.saving}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-status-critical/10 hover:text-status-critical disabled:opacity-40"
          aria-label={t("common.cancel")}
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// INGREDIENT PICKER OVERLAY
// ============================================================================

const CATEGORY_ORDER = [
  "protein", "vegetable", "fruit", "dairy",
  "dry_goods", "spice", "sauce", "oil",
  "beverage", "bakery", "seafood", "other",
];

function IngredientPicker({
  ingredients,
  search,
  searchRef,
  onSearch,
  onSelect,
  onClose,
}: {
  ingredients: Ingredient[];
  search: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onSearch: (v: string) => void;
  onSelect: (i: Ingredient) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Group by category when no search, flat list when searching
  const grouped = useMemo(() => {
    if (search.trim()) return null;
    const map: Record<string, Ingredient[]> = {};
    for (const ing of ingredients) {
      const cat = ing.category || "other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(ing);
    }
    return CATEGORY_ORDER
      .filter((cat) => map[cat]?.length)
      .map((cat) => ({ cat, items: map[cat] }));
  }, [ingredients, search]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[70vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-surface-4 bg-surface-2 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t("workspace.inventory.recipes.selectIngredientAria")}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 border-b border-surface-4 px-4 py-3">
          <Search className="h-4 w-4 flex-shrink-0 text-text-muted" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("workspace.inventory.recipes.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch("")}
              className="text-xs text-text-muted hover:text-text-secondary"
            >
              {t("workspace.inventory.recipes.clear")}
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {ingredients.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-text-muted">
                {search ? t("workspace.inventory.recipes.noSearchResults") : t("workspace.inventory.recipes.allUsed")}
              </p>
            </div>
          ) : grouped ? (
            // Grouped by category
            grouped.map(({ cat, items }) => (
              <div key={cat}>
                <div className="sticky top-0 bg-surface-2/95 backdrop-blur-sm px-4 py-2 border-b border-surface-4/50">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted capitalize">
                    {cat.replace(/_/g, " ")}
                  </p>
                </div>
                {items.map((ing) => (
                  <IngredientPickerRow key={ing.id} ingredient={ing} onSelect={onSelect} />
                ))}
              </div>
            ))
          ) : (
            // Flat search results
            ingredients.map((ing) => (
              <IngredientPickerRow key={ing.id} ingredient={ing} onSelect={onSelect} />
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-surface-4 px-4 py-3">
          <p className="text-[11px] text-text-muted">
            {t("workspace.inventory.recipes.ingredientsAvailable", { count: ingredients.length })}
            {search ? t("workspace.inventory.recipes.matchingSearch", { search }) : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function IngredientPickerRow({
  ingredient,
  onSelect,
}: {
  ingredient: Ingredient;
  onSelect: (i: Ingredient) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onSelect(ingredient)}
      className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-surface-3/60 active:bg-surface-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{ingredient.name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          {ingredient.shelf_life_days && (
            <span className={`text-[11px] ${ingredient.shelf_life_days <= 5 ? "text-status-warning" : "text-text-muted"}`}>
              {t("workspace.inventory.recipes.shelfLife", { days: ingredient.shelf_life_days })}
            </span>
          )}
          {ingredient.is_perishable && (
            <span className="text-[10px] uppercase tracking-[0.06em] text-status-warning">{t("workspace.inventory.recipes.perishable")}</span>
          )}
        </div>
      </div>
      <span className="ml-4 flex-shrink-0 text-[11px] uppercase tracking-[0.06em] text-text-muted">
        {ingredient.unit}
      </span>
    </button>
  );
}

// ============================================================================
// EXPORT
// ============================================================================

export default function RecipeBuilderPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">{t("workspace.inventory.recipes.loadingBuilder")}</div>
      }
    >
      <RecipeBuilderContent />
    </Suspense>
  );
}
