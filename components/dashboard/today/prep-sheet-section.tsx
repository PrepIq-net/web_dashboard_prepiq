"use client";

import { Fragment, useMemo, useState } from "react";
import { NavArrowDown, NavArrowUp } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { MorningBrief } from "@/services/production-intelligence/types";

/**
 * BOM-exploded ingredient prep sheet from the morning brief — the day's
 * item plan pushed through recipes into ingredient quantities, grouped by
 * ingredient category as a station proxy. Open section, subtle separators.
 */

type PrepSheetSectionProps = {
  prepSheet: MorningBrief["prep_sheet"];
};

export function PrepSheetSection({ prepSheet }: PrepSheetSectionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [expandedIngredient, setExpandedIngredient] = useState<string | null>(
    null,
  );

  const groups = useMemo(() => {
    const byCategory = new Map<string, MorningBrief["prep_sheet"]>();
    for (const entry of prepSheet) {
      const list = byCategory.get(entry.category) ?? [];
      list.push(entry);
      byCategory.set(entry.category, list);
    }
    return [...byCategory.entries()];
  }, [prepSheet]);

  if (!prepSheet.length) return null;

  return (
    <section className="mt-10 border-t border-surface-4/50 pt-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.prepSheet.eyebrow")}
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-text-primary">
            {t("today.prepSheet.title", { count: prepSheet.length })}
          </p>
        </div>
        {open ? (
          <NavArrowUp className="h-4 w-4 text-text-muted" />
        ) : (
          <NavArrowDown className="h-4 w-4 text-text-muted" />
        )}
      </button>

      {open ? (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
          {groups.map(([category, entries]) => (
            <div key={category} className="mb-6 last:mb-0">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {category}
              </p>
              <ul className="divide-y divide-surface-4/50">
                {entries.map((entry) => {
                  const isExpanded = expandedIngredient === entry.ingredient_id;
                  return (
                    <Fragment key={entry.ingredient_id}>
                      <li>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedIngredient(
                              isExpanded ? null : entry.ingredient_id,
                            )
                          }
                          className="flex w-full items-center justify-between gap-4 py-2.5 text-left"
                          aria-expanded={isExpanded}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm text-text-primary">
                              {entry.ingredient_name}
                            </span>
                            {entry.is_perishable ? (
                              <span className="shrink-0 rounded-full border border-status-warning/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-status-warning">
                                {t("today.prepSheet.perishable")}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">
                            {entry.total_quantity} {entry.unit}
                          </span>
                        </button>
                        {isExpanded && entry.items.length ? (
                          <ul className="mb-2.5 ml-1 space-y-1 border-l border-surface-4 pl-3">
                            {entry.items.map((usage) => (
                              <li
                                key={`${entry.ingredient_id}-${usage.menu_item}`}
                                className="flex items-center justify-between text-xs text-text-secondary"
                              >
                                <span>{usage.menu_item}</span>
                                <span className="tabular-nums">
                                  {usage.quantity} {entry.unit}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    </Fragment>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
