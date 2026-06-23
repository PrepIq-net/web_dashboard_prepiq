"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Page, NavArrowRight, HandCash, Sparks, WarningTriangle } from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";
import { useProductionIntelligenceAccessScope } from "@/services/production-intelligence/hooks";
import {
  useMenuItems,
  useCreateMenuItem,
  useAutoGenerateRecipe,
} from "@/services/inventory/hooks";
import { useTranslation } from "@/lib/i18n";

const CATEGORIES = [
  "Pastries",
  "Beverages",
  "Mains",
  "Sides",
  "Retail",
  "Uncategorized",
];

interface DraftItem {
  id: string;       // temp client-side id before creation
  name: string;
  category: string;
  isNew: boolean;   // true = needs to be POSTed
}

export default function ItemConfirmationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const scopeQuery = useProductionIntelligenceAccessScope();

  const branchId = useMemo(() => {
    const scope = scopeQuery.data;
    if (!scope) return "";
    return scope.default_branch_id || scope.accessible_branches[0]?.id || "";
  }, [scopeQuery.data]);

  const menuItemsQuery = useMenuItems(branchId, Boolean(branchId));
  const createMenuItem = useCreateMenuItem(branchId);
  const autoGenerateRecipe = useAutoGenerateRecipe();

  // Local edits on top of server data
  const [overrides, setOverrides] = useState<Record<string, { category?: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipeProgress, setRecipeProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => {
    return (menuItemsQuery.data ?? []).map((item) => ({
      ...item,
      category: overrides[item.id]?.category ?? item.category,
    }));
  }, [menuItemsQuery.data, overrides]);

  function handleCategoryChange(id: string, category: string) {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], category } }));
  }

  async function handleConfirm() {
    if (!items.length) {
      router.push("/setup/forecast");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Patch any category overrides (PATCH each changed item)
      // We skip this for now since MenuItemCreateSerializer handles category on create.
      // Category changes on existing items would need a PATCH endpoint — skipping for setup flow.

      // 2. Auto-generate recipes for all items
      setRecipeProgress({ done: 0, total: items.length });
      for (let i = 0; i < items.length; i++) {
        try {
          await autoGenerateRecipe.mutateAsync(items[i].id);
        } catch {
          // Non-fatal — recipe generation failure shouldn't block setup
        }
        setRecipeProgress({ done: i + 1, total: items.length });
      }

      router.push("/setup/forecast");
    } catch (err) {
      setError(t("setup.items.errorMessage"));
      setIsSubmitting(false);
      setRecipeProgress(null);
    }
  }

  const loading = scopeQuery.isLoading || menuItemsQuery.isLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center">
        <Spinner size="lg" color="#A8821F" />
      </div>
    );
  }

  if (!branchId) {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[12px] border border-[#C44949]/50 bg-[#1C1C1F] p-6">
          <WarningTriangle className="h-5 w-5 text-[#C44949] mb-3" />
          <p className="text-[14px] text-[#F5F5F7] font-semibold mb-1">{t("setup.items.noBranchFound")}</p>
          <p className="text-[13px] text-[#8E8E93]">
            {t("setup.items.setUpBranchFirst")}
          </p>
          <button
            onClick={() => router.push("/setup/branch")}
            className="mt-4 h-10 px-5 bg-[#A8821F] hover:bg-[#B8962E] text-[#141416] text-sm font-semibold rounded-[8px] transition-colors"
          >
            {t("setup.branchPrompt.submit")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141416] p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl mt-12 mb-20">
        {/* Step Context */}
        <div className="flex items-center gap-2 mb-8">
          <Page className="h-4 w-4 text-[#A8821F]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            {t("setup.items.step")}
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-3">
          {items.length > 0
            ? items.length === 1
              ? t("setup.items.titleDetected_one")
              : t("setup.items.titleDetected", { count: items.length })
            : t("setup.items.titleNone")}
        </h1>
        <p className="text-[14px] leading-[22px] text-[#8E8E93] max-w-2xl mb-8">
          {t("setup.items.descriptionText")}
        </p>

        {/* Recipe generation progress */}
        {recipeProgress && (
          <div className="bg-[#A8821F]/10 border border-[#A8821F]/40 rounded-[8px] p-4 flex items-center gap-3 mb-6">
            <Sparks className="h-5 w-5 text-[#A8821F] shrink-0 animate-pulse" />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[#F5F5F7]">
                {t("setup.items.generatingRecipes", { done: recipeProgress.done, total: recipeProgress.total })}
              </p>
              <div className="mt-2 h-1.5 bg-[#2E2E33] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#A8821F] rounded-full transition-all duration-300"
                  style={{ width: `${(recipeProgress.done / recipeProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-[#C44949]/10 border border-[#C44949]/50 rounded-[8px] p-4 flex items-center gap-3 mb-6">
            <WarningTriangle className="h-5 w-5 text-[#C44949] shrink-0" />
            <p className="text-[13px] text-[#F5F5F7]">{error}</p>
          </div>
        )}

        {items.length === 0 ? (
          <div className="bg-[#1C1C1F] border border-[#2E2E33] rounded-[12px] p-8 text-center mb-8">
            <HandCash className="h-8 w-8 text-[#5A5A60] mx-auto mb-3" />
            <p className="text-[14px] text-[#8E8E93]">
              {t("setup.items.noMenuImported")}
            </p>
            <button
              onClick={() => router.push("/setup/sales")}
              className="mt-4 h-10 px-5 bg-[#232327] hover:bg-[#2E2E33] border border-[#2E2E33] text-[#C7C7CC] text-sm font-medium rounded-[8px] transition-colors"
            >
              {t("setup.items.goSalesSetup")}
            </button>
          </div>
        ) : (
          <div className="bg-[#1C1C1F] border border-[#2E2E33] rounded-[12px] overflow-hidden mb-8">
            {/* Header */}
            <div className="grid grid-cols-[2fr_1.5fr] gap-4 p-4 border-b border-[#2E2E33] bg-[#232327]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                {t("setup.items.itemNameHeader")}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                {t("setup.items.categoryHeader")}
              </div>
            </div>
            {/* Rows */}
            <div className="divide-y divide-[#2E2E33]">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[2fr_1.5fr] gap-4 p-3 items-center hover:bg-[#232327]/50 transition-colors"
                >
                  <div className="text-[14px] font-medium text-[#F5F5F7] pl-1 truncate">
                    {item.name}
                  </div>
                  <div>
                    <select
                      value={item.category}
                      onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                      disabled={isSubmitting}
                      className="w-full h-9 bg-[#141416] border border-[#2E2E33] rounded-[6px] px-3 text-[13px] text-[#F5F5F7] focus:outline-none focus:border-[#A8821F] appearance-none disabled:opacity-50"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {t(`setup.items.categories.${cat}` as any)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#2E2E33] pt-6">
          <button
            onClick={() => router.push("/setup/sales")}
            disabled={isSubmitting}
            className="text-[13px] text-[#5A5A60] hover:text-[#8E8E93] transition-colors font-medium disabled:opacity-40"
          >
            {t("setup.items.back")}
          </button>

          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="h-11 px-6 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-50 disabled:cursor-not-allowed text-[#141416] text-[14px] font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" color="#141416" />
                {recipeProgress
                  ? t("setup.items.generatingRecipesDots", { done: recipeProgress.done, total: recipeProgress.total })
                  : t("setup.items.processing")}
              </>
            ) : (
              <>
                {items.length > 0 ? t("setup.items.confirmGenerate") : t("setup.items.continue")}
                <NavArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
