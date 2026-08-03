"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Lock, Search } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import {
  groupPermissionsByCategory,
  type Permission,
} from "@/services/organizations/types";

/**
 * How a single permission reads in the list.
 *
 * - `on`      — selected here, and can be turned off
 * - `off`     — available to select
 * - `locked`  — already held, but not from this surface (it comes from the
 *               member's role), so it shows as satisfied and is not clickable
 */
export type PermissionState = "on" | "off" | "locked";

type PermissionPickerProps = {
  permissions: Permission[];
  getState: (code: string) => PermissionState;
  onToggle: (code: string) => void;
  /** Trailing content for a row — e.g. the branch a grant is scoped to. */
  renderMeta?: (permission: Permission) => ReactNode;
  /** Copy shown against a locked row, explaining where the access came from. */
  lockedHint?: string;
  /** Per-category select-all / clear-all. Off in review-style surfaces. */
  allowBulkSelect?: boolean;
  onBulkChange?: (codes: string[], select: boolean) => void;
  emptyLabel?: string;
  className?: string;
};

/**
 * Grouped, searchable permission list that explains every entry.
 *
 * Permissions are the sharpest thing a manager can hand out on this screen, so
 * the description is not a tooltip — it sits under the label where it cannot be
 * missed. Wording comes from the API so the dashboard, mobile and any future
 * client all describe a permission identically.
 */
export function PermissionPicker({
  permissions,
  getState,
  onToggle,
  renderMeta,
  lockedHint,
  allowBulkSelect = false,
  onBulkChange,
  emptyLabel,
  className = "",
}: PermissionPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? permissions.filter(
          (permission) =>
            permission.label.toLowerCase().includes(needle) ||
            permission.code.toLowerCase().includes(needle) ||
            permission.description.toLowerCase().includes(needle) ||
            permission.category_label.toLowerCase().includes(needle),
        )
      : permissions;
    return groupPermissionsByCategory(matching);
  }, [permissions, query]);

  if (permissions.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-muted">
        {emptyLabel ?? t("settings.permissions.none")}
      </p>
    );
  }

  return (
    <div className={`space-y-5 ${className}`}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("settings.permissions.searchPlaceholder")}
          aria-label={t("settings.permissions.searchPlaceholder")}
          className="w-full rounded-lg border border-surface-4 bg-surface-1 py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold"
        />
      </div>

      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">
          {t("settings.permissions.noMatches", { query: query.trim() })}
        </p>
      ) : (
        groups.map((group) => {
          const selectable = group.permissions.filter(
            (permission) => getState(permission.code) !== "locked",
          );
          const allSelected =
            selectable.length > 0 &&
            selectable.every(
              (permission) => getState(permission.code) === "on",
            );

          return (
            <section key={group.category} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {group.label}
                </h4>
                {allowBulkSelect && selectable.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      onBulkChange?.(
                        selectable.map((permission) => permission.code),
                        !allSelected,
                      )
                    }
                    className="text-xs font-medium text-brand-gold transition-colors hover:text-brand-gold-hover"
                  >
                    {allSelected
                      ? t("settings.permissions.clearGroup")
                      : t("settings.permissions.selectGroup")}
                  </button>
                ) : null}
              </div>

              <ul className="space-y-1.5">
                {group.permissions.map((permission) => {
                  const state = getState(permission.code);
                  const isLocked = state === "locked";
                  const isOn = state === "on";

                  return (
                    <li key={permission.code}>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => onToggle(permission.code)}
                        aria-pressed={isOn}
                        className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                          isLocked
                            ? "cursor-default border-surface-4 bg-surface-2/60"
                            : isOn
                              ? "border-brand-gold bg-brand-gold/10"
                              : "border-surface-4 bg-surface-2 hover:border-brand-gold/60 hover:bg-surface-3"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            isOn
                              ? "border-brand-gold bg-brand-gold text-surface-1"
                              : isLocked
                                ? "border-surface-4 bg-surface-3 text-text-muted"
                                : "border-surface-4 text-transparent"
                          }`}
                        >
                          {isLocked ? (
                            <Lock className="h-3 w-3" />
                          ) : (
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">
                              {permission.label}
                            </span>
                            {isLocked && lockedHint ? (
                              <span className="rounded-full border border-surface-4 px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                                {lockedHint}
                              </span>
                            ) : null}
                            {renderMeta?.(permission)}
                          </span>
                          {permission.description ? (
                            <span className="mt-1 block text-xs leading-relaxed text-text-secondary">
                              {permission.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
