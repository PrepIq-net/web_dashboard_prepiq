"use client";

import { useState } from "react";
import Link from "next/link";
import { useIngredientDemand } from "@/services/inventory/hooks";
import type { IngredientDemand } from "@/services/inventory/types";

type Props = {
  branchId: string;
  targetDate: string;
  orgId: string;
};

export function IngredientRequirements({ branchId, targetDate, orgId }: Props) {
  const [result, setResult] = useState<IngredientDemand | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  const mutation = useIngredientDemand(branchId, targetDate);

  async function calculate() {
    try {
      const data = await mutation.mutateAsync();
      setResult(data);
      setHasCalculated(true);
    } catch {
      setHasCalculated(true);
    }
  }

  const ingredients = result?.ingredients ?? [];
  const noRecipeItems = result?.items_with_no_recipe ?? [];

  // Group by unit for a cleaner display
  const byCategory = ingredients.reduce<Record<string, typeof ingredients>>((acc, ing) => {
    const unit = ing.unit || "unit";
    if (!acc[unit]) acc[unit] = [];
    acc[unit].push(ing);
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            Ingredient Requirements
          </p>
          <p className="mt-0.5 text-sm text-text-secondary">
            What your kitchen needs to prep today's plan
          </p>
        </div>
        <button
          type="button"
          onClick={calculate}
          disabled={mutation.isPending}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/20 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-brand-gold/40 border-t-brand-gold animate-spin" />
              Calculating…
            </>
          ) : hasCalculated ? (
            "Recalculate"
          ) : (
            "Calculate"
          )}
        </button>
      </div>

      {/* Content */}
      {!hasCalculated ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-text-muted">
            Click Calculate to see exactly how much of each ingredient you need today.
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Based on your prep plan × recipe quantities.
          </p>
        </div>
      ) : mutation.isError ? (
        <div className="px-5 py-6">
          <p className="text-sm text-status-critical">
            Could not calculate ingredient demand. Make sure recipes are set up for your menu items.
          </p>
          <Link
            href={`/workspace/inventory?branch=${branchId}&org=${orgId}&tab=recipes`}
            className="mt-2 inline-flex text-xs text-brand-gold hover:underline"
          >
            Set up recipes →
          </Link>
        </div>
      ) : ingredients.length === 0 ? (
        <div className="px-5 py-6">
          <p className="text-sm text-text-secondary">No ingredient data found.</p>
          <p className="mt-1 text-xs text-text-muted">
            Link your menu items to recipes in the Inventory section to unlock ingredient forecasting.
          </p>
          <Link
            href={`/workspace/inventory?branch=${branchId}&org=${orgId}&tab=recipes`}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-gold/40 px-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10"
          >
            Build recipes →
          </Link>
        </div>
      ) : (
        <div>
          {/* Ingredient list */}
          <div className="divide-y divide-surface-4">
            {ingredients.map((ing) => {
              const qty = parseFloat(ing.predicted_usage ?? "0");
              const isHighQty = qty > 5;
              return (
                <div
                  key={ing.ingredient_id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-3/40 transition-colors"
                >
                  <p className="text-sm font-medium text-text-primary">{ing.ingredient_name}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold tabular-nums ${isHighQty ? "text-text-primary" : "text-text-secondary"}`}>
                      {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(3)}
                    </span>
                    <span className="text-xs uppercase text-text-muted w-8 text-right">
                      {ing.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Items missing recipes */}
          {noRecipeItems.length > 0 && (
            <div className="border-t border-surface-4 px-5 py-4 bg-status-warning/5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-status-warning mb-2">
                {noRecipeItems.length} item{noRecipeItems.length !== 1 ? "s" : ""} missing recipes
              </p>
              <p className="text-xs text-text-muted mb-2">
                These items are in your prep plan but have no recipe defined:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {noRecipeItems.map((name) => (
                  <span
                    key={name}
                    className="inline-flex h-6 items-center rounded-md border border-status-warning/30 bg-status-warning/10 px-2 text-[11px] text-status-warning"
                  >
                    {name}
                  </span>
                ))}
              </div>
              <Link
                href={`/workspace/inventory?branch=${branchId}&org=${orgId}&tab=recipes`}
                className="mt-3 inline-flex text-xs text-brand-gold hover:underline"
              >
                Add missing recipes →
              </Link>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-surface-4 px-5 py-3 flex items-center justify-between">
            <p className="text-xs text-text-muted">
              {ingredients.length} ingredient{ingredients.length !== 1 ? "s" : ""} · based on today's prep plan
            </p>
            <p className="text-xs text-text-muted">{targetDate}</p>
          </div>
        </div>
      )}
    </div>
  );
}
