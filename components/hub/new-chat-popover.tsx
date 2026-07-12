"use client";

import { useState } from "react";
import { Check, Group, Sparks, Xmark } from "iconoir-react";
import { useHubDirectory, type DirectoryEntry } from "@/services/hub";
import { initials } from "./hub-utils";

/**
 * Direct creation flow: click a person → conversation opens instantly.
 * Toggling "group" allows multi-select; 3+ members auto-open a group whose
 * title is AI-generated server-side when left unnamed.
 */
export function NewChatPopover({
  onResolve,
  onClose,
  resolving,
}: {
  onResolve: (input: { participantIds: string[]; includeAssistant: boolean }) => void;
  onClose: () => void;
  resolving: boolean;
}) {
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [selected, setSelected] = useState<DirectoryEntry[]>([]);

  const directory = useHubDirectory(query);

  function pick(entry: DirectoryEntry) {
    if (!groupMode) {
      onResolve({ participantIds: [entry.user.id], includeAssistant: false });
      return;
    }
    setSelected((list) =>
      list.some((s) => s.user.id === entry.user.id)
        ? list.filter((s) => s.user.id !== entry.user.id)
        : [...list, entry],
    );
  }

  return (
    <div className="absolute left-3 right-3 top-14 z-30 rounded-xl border border-border-default bg-surface-2 p-3 shadow-[var(--shadow-level-2)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-primary">New conversation</p>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text-primary"
        >
          <Xmark className="h-4 w-4" />
        </button>
      </div>

      <input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search teammates…"
        className="mt-2 w-full rounded-lg border border-border-default bg-surface-3 px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-brand-gold focus:outline-none"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setGroupMode((mode) => !mode);
            setSelected([]);
          }}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            groupMode
              ? "bg-brand-gold/15 text-brand-gold"
              : "text-text-muted hover:bg-surface-3 hover:text-text-primary"
          }`}
        >
          <Group className="h-3.5 w-3.5" />
          Group
        </button>
        <button
          type="button"
          disabled={resolving}
          onClick={() => onResolve({ participantIds: [], includeAssistant: true })}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-brand-gold"
        >
          <Sparks className="h-3.5 w-3.5" />
          Ask PrepIQ
        </button>
      </div>

      {groupMode && selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((entry) => (
            <span
              key={entry.user.id}
              className="rounded-full bg-surface-4 px-2.5 py-0.5 text-xs text-text-secondary"
            >
              {entry.user.first_name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2 max-h-64 overflow-y-auto">
        {(directory.data ?? []).map((entry) => {
          const isSelected = selected.some((s) => s.user.id === entry.user.id);
          return (
            <button
              key={entry.user.id}
              type="button"
              disabled={resolving}
              onClick={() => pick(entry)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-3 disabled:opacity-60"
            >
              <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-4 text-xs font-medium text-text-secondary">
                {initials(entry.user)}
                {entry.online ? (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-2 bg-status-success" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text-primary">
                  {entry.user.first_name} {entry.user.last_name}
                </span>
                <span className="block truncate text-xs text-text-muted">
                  {entry.branches.length ? entry.branches.join(", ") : entry.organization_name}
                </span>
              </span>
              {isSelected ? <Check className="h-4 w-4 text-brand-gold" /> : null}
            </button>
          );
        })}
        {directory.isFetching ? (
          <p className="px-2.5 py-2 text-xs text-text-muted">Searching…</p>
        ) : (directory.data ?? []).length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-text-muted">No teammates found.</p>
        ) : null}
      </div>

      {groupMode ? (
        <button
          type="button"
          disabled={selected.length < 2 || resolving}
          onClick={() =>
            onResolve({
              participantIds: selected.map((s) => s.user.id),
              includeAssistant: false,
            })
          }
          className="mt-2 w-full rounded-lg bg-brand-gold py-2 text-sm font-medium text-surface-1 transition-colors hover:bg-brand-gold-hover disabled:opacity-50"
        >
          {resolving
            ? "Opening…"
            : selected.length < 2
              ? "Select at least 2 people"
              : `Start group (${selected.length + 1} members)`}
        </button>
      ) : null}
    </div>
  );
}
