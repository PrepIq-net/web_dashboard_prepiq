"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { useRecomputeIngredientRequirement } from "@/services/production-intelligence/hooks";
import type {
  IngredientRequirement,
  IngredientRequirementLine,
} from "@/services/production-intelligence/types";

type Props = {
  branchId: string;
  targetDate: string;
  orgId: string;
  requirement: IngredientRequirement | null | undefined;
  isPlanLocked: boolean;
};

type Translate = ReturnType<typeof useTranslation>["t"];

function formatQty(value: number): string {
  if (value === 0) return "0";
  if (Number.isInteger(value)) return value.toFixed(0);
  return value < 1 ? value.toFixed(3) : value.toFixed(1);
}

/**
 * What the locked plan needs from the store room.
 *
 * Quantities are computed when the chef locks the plan, so this reads a stored
 * answer rather than asking them to press Calculate and then discarding the
 * result on navigation. The number that matters is the shortfall, not the
 * requirement: "you need 12kg of tomatoes" is trivia when there are 12kg in the
 * walk-in.
 */
export function IngredientRequirements({
  branchId,
  targetDate,
  orgId,
  requirement,
  isPlanLocked,
}: Props) {
  const { t } = useTranslation();
  const recompute = useRecomputeIngredientRequirement();

  const recipesHref = `/workspace/inventory?branch=${branchId}&org=${orgId}&tab=recipes`;
  const lines = requirement?.lines ?? [];
  const noRecipeItems = requirement?.items_with_no_recipe ?? [];
  const shortCount = lines.filter((line) => line.net_need > 0).length;

  return (
    <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-surface-4 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("today.ingredients.title")}
          </p>
          <p className="mt-0.5 text-sm text-text-secondary">
            {requirement
              ? summaryLine(t, requirement)
              : t("today.ingredients.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            recompute.mutate({ branch_id: branchId, date: targetDate })
          }
          disabled={recompute.isPending}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/20 disabled:opacity-50"
        >
          {recompute.isPending ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-gold/40 border-t-brand-gold" />
              {t("today.ingredients.calculating")}
            </>
          ) : (
            t("today.ingredients.recalculate")
          )}
        </button>
      </div>

      {recompute.isError ? (
        <div className="px-5 py-6">
          <p className="text-sm text-status-critical">
            {t("today.ingredients.error")}
          </p>
          <Link
            href={recipesHref}
            className="mt-2 inline-flex text-xs text-brand-gold hover:underline"
          >
            {t("today.ingredients.setUpRecipes")}
          </Link>
        </div>
      ) : !requirement ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-text-muted">
            {isPlanLocked
              ? t("today.ingredients.emptyLocked")
              : t("today.ingredients.emptyUnlocked")}
          </p>
        </div>
      ) : lines.length === 0 ? (
        <div className="px-5 py-6">
          <p className="text-sm text-text-secondary">
            {t("today.ingredients.noRecipeData")}
          </p>
          <Link
            href={recipesHref}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-gold/40 px-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10"
          >
            {t("today.ingredients.buildRecipes")}
          </Link>
        </div>
      ) : (
        <div>
          {shortCount > 0 ? (
            <div className="border-b border-surface-4 bg-status-warning/5 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-status-warning">
                {t("today.ingredients.shortHeading", { count: shortCount })}
              </p>
            </div>
          ) : null}

          <div className="divide-y divide-surface-4">
            {lines.map((line) => (
              <IngredientRow key={line.ingredient_id} line={line} t={t} />
            ))}
          </div>

          {noRecipeItems.length > 0 ? (
            <div className="border-t border-surface-4 bg-status-warning/5 px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-status-warning">
                {t("today.ingredients.missingRecipes", {
                  count: noRecipeItems.length,
                })}
              </p>
              <p className="mb-2 text-xs text-text-muted">
                {t("today.ingredients.missingRecipesHint")}
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
                href={recipesHref}
                className="mt-3 inline-flex text-xs text-brand-gold hover:underline"
              >
                {t("today.ingredients.addMissingRecipes")}
              </Link>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-surface-4 px-5 py-3">
            <p className="text-xs text-text-muted">
              {requirement.source === "PLAN_LOCK"
                ? t("today.ingredients.footerFromLock")
                : t("today.ingredients.footerFromManual")}
            </p>
            {shortCount > 0 ? (
              <Link
                href={`/workspace/purchasing?branch=${branchId}&org=${orgId}`}
                className="text-xs text-brand-gold hover:underline"
              >
                {t("today.ingredients.goToPurchasing")}
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function IngredientRow({
  line,
  t,
}: {
  line: IngredientRequirementLine;
  t: Translate;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-3/40">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">
          {line.ingredient_name}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-text-muted">
          {t("today.ingredients.need")} {formatQty(line.needed)} {line.unit}
          {line.stock_known
            ? ` · ${t("today.ingredients.onHand")} ${formatQty(line.on_hand)}`
            : ""}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {!line.stock_known ? (
          // Without a stock count, net_need is the whole requirement rather than
          // a shortfall. Calling it "short" would invent a fact.
          <span className="text-xs text-text-muted">
            {t("today.ingredients.stockUnknown")}
          </span>
        ) : line.net_need > 0 ? (
          <>
            <p className="text-sm font-semibold tabular-nums text-status-warning">
              {t("today.ingredients.short")} {formatQty(line.net_need)}{" "}
              {line.unit}
            </p>
            {line.estimated_cost ? (
              <p className="text-xs tabular-nums text-text-muted">
                ~{formatMoney(line.estimated_cost)}
                {line.supplier_name ? ` · ${line.supplier_name}` : ""}
              </p>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-status-positive">
            {t("today.ingredients.covered")}
          </span>
        )}
      </div>
    </div>
  );
}

function summaryLine(t: Translate, requirement: IngredientRequirement): string {
  const parts = [
    t("today.ingredients.countSummary", { count: requirement.ingredient_count }),
  ];
  const uncounted = requirement.lines.filter((line) => !line.stock_known).length;

  if (requirement.shortfall_count > 0) {
    parts.push(
      t("today.ingredients.shortSummary", { count: requirement.shortfall_count }),
    );
    // Only quote a cost when suppliers are actually priced. The backend sends
    // null for an unpriced shortfall, and "$0" would read as "free".
    if (requirement.total_estimated_cost) {
      parts.push(
        t("today.ingredients.costSummary", {
          amount: formatMoney(requirement.total_estimated_cost),
        }),
      );
    }
  } else if (requirement.ingredient_count > uncounted) {
    parts.push(t("today.ingredients.allCovered"));
  }

  // Never let "all covered" stand alone while some of the shelf was never
  // counted — that reads as a guarantee the data cannot support.
  if (uncounted > 0) {
    parts.push(t("today.ingredients.uncountedSummary", { count: uncounted }));
  }

  return parts.join(" · ");
}
