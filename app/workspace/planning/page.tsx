"use client";

import { Suspense, useMemo, useState } from "react";
import { Plus, NavArrowLeft, NavArrowRight, Xmark, Shop, Search } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useCatalogItems,
} from "@/services";
import {
  usePlanningCalendar,
  usePlanningForecastContext,
  useCreatePlanningEvent,
  useDeletePlanningEvent,
} from "@/services/planning/hooks";
import type {
  CalendarEventList,
  CreateCalendarEventPayload,
  EventType,
} from "@/services/planning/types";
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_DOT,
  eventTypeEnum,
} from "@/services/planning/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_LIST: never[] = [];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function calendarGrid(month: Date): Date[] {
  const start = monthStart(month);
  const end = monthEnd(month);
  // Monday-first grid
  const dow = (start.getDay() + 6) % 7; // 0=Mon
  const grid: Date[] = [];
  for (let i = -dow; i <= end.getDate() - 1; i++) {
    const d = new Date(start);
    d.setDate(1 + i);
    grid.push(d);
  }
  // Pad to full rows of 7
  while (grid.length % 7 !== 0) {
    const last = grid[grid.length - 1];
    const d = new Date(last);
    d.setDate(last.getDate() + 1);
    grid.push(d);
  }
  return grid;
}

function formatImpact(impact: number | null | undefined): string {
  if (impact == null) return "";
  const sign = impact >= 0 ? "+" : "";
  return `${sign}${(impact * 100).toFixed(0)}%`;
}

function impactTone(impact: number): string {
  if (impact <= -0.1) return "text-status-critical";
  if (impact >= 0.1) return "text-status-success";
  return "text-text-muted";
}

// ─────────────────────────────────────────────────────────────────────────────
// Create event modal
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_EVENT_TYPE: EventType = "RESERVATION";

const INPUT_CLS =
  "w-full rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-brand-gold/50 focus:outline-none";

const LABEL_CLS =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`h-5 w-9 rounded-full transition-colors ${checked ? "bg-brand-gold" : "bg-surface-4"}`} />
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}

function ItemPicker({
  orgId,
  selected,
  onChange,
}: {
  orgId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: items = [], isLoading } = useCatalogItems(orgId, !!orgId);

  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  };

  return (
    <div>
      <label className={LABEL_CLS}>
        Affected menu items
        {selected.length > 0 ? (
          <span className="ml-1.5 rounded-full bg-status-success/20 px-1.5 py-0.5 text-[9px] font-bold text-status-success">
            {selected.length} selected
          </span>
        ) : null}
      </label>
      <p className="mb-2 text-[11px] text-text-muted">
        The forecast engine will boost predicted demand for these items when this promotion is active.
      </p>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-full rounded-xl border border-surface-4 bg-surface-2 py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-brand-gold/50 focus:outline-none"
        />
      </div>

      {/* List */}
      <div className="max-h-36 overflow-y-auto rounded-xl border border-surface-4 bg-surface-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-text-muted">
            {items.length === 0 ? "No items in catalog yet." : "No items match."}
          </p>
        ) : (
          filtered.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2 ${
                  isSelected ? "bg-status-success/5" : ""
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors ${
                    isSelected
                      ? "border-status-success bg-status-success text-white"
                      : "border-surface-4"
                  }`}
                >
                  {isSelected ? "✓" : ""}
                </span>
                <span className="text-sm text-text-primary">{item.title}</span>
                {item.unit ? (
                  <span className="ml-auto text-[10px] text-text-muted">{item.unit}</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function CreateEventModal({
  defaultDate,
  branchId,
  orgId,
  onClose,
}: {
  defaultDate: string;
  branchId: string;
  orgId: string;
  onClose: () => void;
}) {
  const createMutation = useCreatePlanningEvent();

  const [form, setForm] = useState({
    title: "",
    event_type: DEFAULT_EVENT_TYPE as EventType,
    start_date: defaultDate,
    start_time: "09:00",
    end_time: "17:00",
    description: "",
    expected_demand_impact: "",
    all_branches: false,
    // Promotion sub-fields
    promotion_name: "",
    expected_uplift: "",
    discount_type: "PERCENTAGE",
    promotion_channel: "IN_STORE",
    // Reservation sub-fields
    guest_count: "",
    reservation_type: "OTHER",
    confirmed: false,
    // Closure sub-fields
    closure_reason: "",
    full_day: true,
    // Delivery sub-fields
    supplier_name: "",
    // Operational note
    note_content: "",
  });

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const buildDetails = (): Record<string, unknown> => {
    switch (form.event_type) {
      case "PROMOTION":
        return {
          promotion_name: form.promotion_name || form.title,
          discount_type: form.discount_type,
          discount_value: "0",
          promotion_channel: form.promotion_channel,
          expected_uplift: form.expected_uplift !== "" ? Number(form.expected_uplift) / 100 : null,
          is_recurring: false,
          affected_items: selectedItemIds,
        };
      case "RESERVATION":
        return {
          guest_count: Number(form.guest_count) || 1,
          reservation_type: form.reservation_type,
          service_period: "ALL_DAY",
          confirmed: form.confirmed,
        };
      case "CLOSURE":
        return {
          reason: form.closure_reason || "Closed",
          partial_day: !form.full_day,
          full_day: form.full_day,
        };
      case "DELIVERY":
        return {
          supplier_name: form.supplier_name,
          delivery_date: form.start_date,
          items: [],
          delivery_status: "PENDING",
        };
      case "OPERATIONAL_NOTE":
        return {
          note_type: "OTHER",
          content: form.note_content || form.description,
        };
      default:
        return {};
    }
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (form.event_type === "RESERVATION" && !form.guest_count) {
      setError("Guest count is required for reservations.");
      return;
    }
    if (form.event_type === "DELIVERY" && !form.supplier_name.trim()) {
      setError("Supplier name is required for deliveries.");
      return;
    }
    setError("");

    const startDt = `${form.start_date}T${form.start_time}:00`;
    const endDt = `${form.start_date}T${form.end_time}:00`;
    const details = buildDetails();

    const payload: CreateCalendarEventPayload = {
      title: form.title.trim(),
      event_type: form.event_type,
      start_datetime: startDt,
      end_datetime: endDt,
      description: form.description.trim(),
      branch: form.all_branches ? null : branchId || null,
      is_forecast_signal: true,
      expected_demand_impact:
        form.expected_demand_impact !== ""
          ? Number(form.expected_demand_impact) / 100
          : null,
      ...(Object.keys(details).length > 0 ? { details } : {}),
    };

    createMutation.mutate(payload, { onSuccess: onClose });
  };

  const eventTypes = eventTypeEnum.options as EventType[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-surface-4 bg-[#141416] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-4 px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
              New Event
            </p>
            <h2 className="font-display text-lg font-semibold text-text-primary">
              Add to planning calendar
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-4 text-text-muted hover:text-text-primary transition-colors"
          >
            <Xmark className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="space-y-4 px-6 py-5">
            {error ? (
              <p className="rounded-lg border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-xs text-status-critical">
                {error}
              </p>
            ) : null}

            {/* Title */}
            <div>
              <label className={LABEL_CLS}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Wedding Reception — 80 guests"
                className={INPUT_CLS}
              />
            </div>

            {/* Event type */}
            <div>
              <label className={LABEL_CLS}>Type</label>
              <select
                value={form.event_type}
                onChange={(e) => {
                  set("event_type", e.target.value as EventType);
                  setSelectedItemIds([]);
                }}
                className={INPUT_CLS}
              >
                {eventTypes.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {/* Date + time row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL_CLS}>Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Start</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => set("start_time", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>End</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => set("end_time", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
            </div>

            {/* ── Type-specific sub-fields ── */}

            {form.event_type === "PROMOTION" ? (
              <div className="space-y-4 rounded-xl border border-status-success/20 bg-status-success/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-status-success">
                  Promotion details
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Promotion name</label>
                    <input
                      type="text"
                      value={form.promotion_name}
                      onChange={(e) => set("promotion_name", e.target.value)}
                      placeholder="e.g. Happy Hour"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Expected uplift (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={form.expected_uplift}
                      onChange={(e) => set("expected_uplift", e.target.value)}
                      placeholder="e.g. 20"
                      className={INPUT_CLS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Discount type</label>
                    <select
                      value={form.discount_type}
                      onChange={(e) => set("discount_type", e.target.value)}
                      className={INPUT_CLS}
                    >
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED">Fixed amount</option>
                      <option value="BOGO">Buy one get one</option>
                      <option value="FREE_ITEM">Free item</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Channel</label>
                    <select
                      value={form.promotion_channel}
                      onChange={(e) => set("promotion_channel", e.target.value)}
                      className={INPUT_CLS}
                    >
                      <option value="IN_STORE">In-store</option>
                      <option value="ONLINE">Online</option>
                      <option value="SOCIAL_MEDIA">Social media</option>
                      <option value="ALL">All channels</option>
                    </select>
                  </div>
                </div>

                <ItemPicker
                  orgId={orgId}
                  selected={selectedItemIds}
                  onChange={setSelectedItemIds}
                />
              </div>
            ) : null}

            {form.event_type === "RESERVATION" ? (
              <div className="space-y-4 rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold">
                  Reservation details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Guest count</label>
                    <input
                      type="number"
                      min="1"
                      value={form.guest_count}
                      onChange={(e) => set("guest_count", e.target.value)}
                      placeholder="e.g. 40"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Type</label>
                    <select
                      value={form.reservation_type}
                      onChange={(e) => set("reservation_type", e.target.value)}
                      className={INPUT_CLS}
                    >
                      <option value="WEDDING">Wedding</option>
                      <option value="CORPORATE">Corporate</option>
                      <option value="BIRTHDAY">Birthday</option>
                      <option value="CONFERENCE">Conference</option>
                      <option value="PRIVATE_DINING">Private dining</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
                <Toggle
                  checked={form.confirmed}
                  onChange={(v) => set("confirmed", v)}
                  label="Reservation confirmed"
                />
              </div>
            ) : null}

            {form.event_type === "CLOSURE" ? (
              <div className="space-y-4 rounded-xl border border-status-critical/20 bg-status-critical/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-status-critical">
                  Closure details
                </p>
                <div>
                  <label className={LABEL_CLS}>Reason</label>
                  <input
                    type="text"
                    value={form.closure_reason}
                    onChange={(e) => set("closure_reason", e.target.value)}
                    placeholder="e.g. Public holiday, maintenance..."
                    className={INPUT_CLS}
                  />
                </div>
                <Toggle
                  checked={form.full_day}
                  onChange={(v) => set("full_day", v)}
                  label="Full-day closure"
                />
              </div>
            ) : null}

            {form.event_type === "DELIVERY" ? (
              <div className="space-y-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-400">
                  Delivery details
                </p>
                <div>
                  <label className={LABEL_CLS}>Supplier name</label>
                  <input
                    type="text"
                    value={form.supplier_name}
                    onChange={(e) => set("supplier_name", e.target.value)}
                    placeholder="e.g. Metro Foods"
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            ) : null}

            {form.event_type === "OPERATIONAL_NOTE" ? (
              <div className="space-y-4 rounded-xl border border-surface-4 bg-surface-2 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Note details
                </p>
                <div>
                  <label className={LABEL_CLS}>Note content</label>
                  <textarea
                    rows={3}
                    value={form.note_content}
                    onChange={(e) => set("note_content", e.target.value)}
                    placeholder="Enter operational note..."
                    className="w-full resize-none rounded-xl border border-surface-4 bg-surface-1 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-brand-gold/50 focus:outline-none"
                  />
                </div>
              </div>
            ) : null}

            {/* Demand impact */}
            <div>
              <label className={LABEL_CLS}>Expected demand impact (%)</label>
              <input
                type="number"
                step="1"
                value={form.expected_demand_impact}
                onChange={(e) => set("expected_demand_impact", e.target.value)}
                placeholder="e.g. 25 for +25%, −40 for −40%"
                className={INPUT_CLS}
              />
            </div>

            {/* Description */}
            <div>
              <label className={LABEL_CLS}>Notes (optional)</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Any context the forecast engine should know..."
                className="w-full resize-none rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-brand-gold/50 focus:outline-none"
              />
            </div>

            {/* All branches toggle */}
            <Toggle
              checked={form.all_branches}
              onChange={(v) => set("all_branches", v)}
              label="Apply to all branches"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-surface-4 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="inline-flex h-9 items-center rounded-full bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "Saving..." : "Add event"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day detail panel
// ─────────────────────────────────────────────────────────────────────────────

function DayPanel({
  date,
  events,
  branchId,
  onCreateClick,
}: {
  date: string;
  events: CalendarEventList[];
  branchId: string;
  onCreateClick: () => void;
}) {
  const deleteMutation = useDeletePlanningEvent();
  const forecastQuery = usePlanningForecastContext(
    { branch_id: branchId, date },
    !!branchId && !!date,
  );
  const fc = forecastQuery.data;
  const displayDate = new Date(date + "T00:00:00");

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-start justify-between pb-4 border-b border-surface-4/60">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {displayDate.toLocaleDateString("en-US", { weekday: "long" })}
          </p>
          <p className="font-display text-2xl font-semibold text-text-primary">
            {displayDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateClick}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary hover:border-brand-gold/50 hover:text-brand-gold transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {/* Forecast context summary */}
      {fc && fc.total_events > 0 ? (
        <div className="mt-4 rounded-xl border border-surface-4 bg-surface-2 p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand-gold mb-2">
            Forecast impact
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div>
              <span className="text-text-muted">Composite impact</span>
              <span
                className={`ml-1.5 font-semibold ${impactTone(fc.composite_demand_impact)}`}
              >
                {formatImpact(fc.composite_demand_impact)}
              </span>
            </div>
            {fc.reservation_total_guests > 0 ? (
              <div>
                <span className="text-text-muted">Reservations</span>
                <span className="ml-1.5 font-semibold text-text-primary">
                  {fc.reservation_total_guests} guests
                </span>
              </div>
            ) : null}
            {fc.local_event_max_attendance > 0 ? (
              <div>
                <span className="text-text-muted">Nearby crowd</span>
                <span className="ml-1.5 font-semibold text-text-primary">
                  {fc.local_event_max_attendance.toLocaleString()}
                </span>
              </div>
            ) : null}
            {fc.has_closure ? (
              <div className="col-span-2">
                <span className="font-semibold text-status-critical">
                  {fc.closure_is_full_day ? "Full-day closure" : "Partial closure"}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Events list */}
      <div className="mt-4 flex-1 overflow-y-auto space-y-2">
        {events.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-text-muted">No events on this day.</p>
            <button
              type="button"
              onClick={onCreateClick}
              className="mt-3 text-xs text-brand-gold hover:underline"
            >
              Add an event →
            </button>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="group rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 transition-colors hover:border-surface-4/80"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${EVENT_TYPE_COLORS[event.event_type]}`}
                    >
                      {EVENT_TYPE_LABELS[event.event_type]}
                    </span>
                    {event.expected_demand_impact != null ? (
                      <span
                        className={`text-[10px] font-semibold ${impactTone(event.expected_demand_impact)}`}
                      >
                        {formatImpact(event.expected_demand_impact)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-text-primary truncate">
                    {event.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-text-muted">
                    {new Date(event.start_datetime).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    –{" "}
                    {new Date(event.end_datetime).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {event.branch_name ? ` · ${event.branch_name}` : " · All branches"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(event.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-status-critical hover:bg-status-critical/10 transition-all disabled:opacity-30"
                >
                  <Xmark className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page content
// ─────────────────────────────────────────────────────────────────────────────

function PlanningPageContent() {
  const today = toIso(new Date());
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: user } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;

  const branchOptions = useMemo(() => {
    const accessibleIds = new Set(accessibleBranches.map((b) => b.id));
    const byId = new Map<string, (typeof branches)[number]>();
    for (const b of branches) byId.set(b.id, b);
    const merged = Array.from(byId.values());
    return accessibleIds.size
      ? merged.filter((b) => accessibleIds.has(b.id))
      : merged;
  }, [branches, accessibleBranches]);

  const defaultBranch =
    branchOptions.find((b) => b.id === accessScope?.default_branch_id) ??
    branchOptions.find((b) => b.is_primary) ??
    branchOptions[0] ??
    null;

  const [branchId, setBranchId] = useState(defaultBranch?.id ?? "");
  const safeBranchId = UUID_PATTERN.test(branchId) ? branchId : "";

  // Calendar range: full month grid including overflow days
  const grid = useMemo(() => calendarGrid(month), [month]);
  const rangeStart = toIso(grid[0]);
  const rangeEnd = toIso(grid[grid.length - 1]);

  const calendarQuery = usePlanningCalendar(
    { start: rangeStart, end: rangeEnd, branch_id: safeBranchId || undefined },
    !!rangeStart && !!rangeEnd,
  );

  const calendarData = calendarQuery.data?.calendar ?? {};

  const selectedDayEvents: CalendarEventList[] =
    calendarData[selectedDate] ?? EMPTY_LIST;

  const isCurrentMonth = (d: Date) => d.getMonth() === month.getMonth();

  return (
    <WorkspaceShell
      eyebrow="Planning"
      title="Planning Calendar"
      description="Every event you enter becomes a forecast signal. Reservations, promotions, closures — all feed the prediction engine."
      insight="The calendar is not for dates. It is for future operational intelligence."
    >
      {/* ── Context bar ── */}
      <div className="mb-6 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-5">
        <div className="flex-1 min-w-[180px] max-w-xs">
          <Select
            label="Branch"
            leadingIcon={<Shop className="h-4 w-4" />}
            options={branchOptions.map((b) => ({ value: b.id, label: b.name }))}
            value={branchId}
            onChange={setBranchId}
            placeholder="All branches"
          />
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New event
        </button>
      </div>

      {/* ── Main layout: calendar + day panel ── */}
      <div className="flex gap-6 min-h-[600px]">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          {/* Month nav */}
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <NavArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </h2>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <NavArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted/60"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-surface-4/60 bg-surface-4/30">
            {grid.map((day) => {
              const iso = toIso(day);
              const isToday = iso === today;
              const isSelected = iso === selectedDate;
              const inMonth = isCurrentMonth(day);
              const dayEvents = calendarData[iso] ?? EMPTY_LIST;

              // Max 3 dots shown, overflow count shown as text
              const dotEvents = dayEvents.slice(0, 3);
              const overflow = dayEvents.length - dotEvents.length;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDate(iso)}
                  className={`relative flex min-h-[80px] flex-col items-start p-2 text-left transition-colors
                    ${inMonth ? "bg-surface-1" : "bg-[#141416]"}
                    ${isSelected ? "ring-1 ring-inset ring-brand-gold/60 bg-brand-gold/5" : "hover:bg-surface-2/80"}
                  `}
                >
                  {/* Day number */}
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold
                      ${isToday ? "bg-brand-gold text-[#141416]" : inMonth ? "text-text-primary" : "text-text-muted/40"}
                    `}
                  >
                    {day.getDate()}
                  </span>

                  {/* Event dots */}
                  {dayEvents.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {dotEvents.map((ev) => (
                        <span
                          key={ev.id}
                          className={`h-1.5 w-1.5 rounded-full ${EVENT_TYPE_DOT[ev.event_type]}`}
                          title={ev.title}
                        />
                      ))}
                      {overflow > 0 ? (
                        <span className="text-[9px] text-text-muted leading-none">
                          +{overflow}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Demand impact indicator for days with events */}
                  {dayEvents.length > 0 ? (() => {
                    const totalImpact = dayEvents.reduce(
                      (sum, ev) => sum + (ev.expected_demand_impact ?? 0),
                      0,
                    );
                    if (Math.abs(totalImpact) < 0.05) return null;
                    return (
                      <span
                        className={`mt-auto text-[9px] font-semibold ${impactTone(totalImpact)}`}
                      >
                        {formatImpact(totalImpact)}
                      </span>
                    );
                  })() : null}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {(["RESERVATION", "PROMOTION", "CLOSURE", "LOCAL_EVENT", "DELIVERY"] as EventType[]).map(
              (t) => (
                <span key={t} className="flex items-center gap-1.5 text-[10px] text-text-muted">
                  <span className={`h-2 w-2 rounded-full ${EVENT_TYPE_DOT[t]}`} />
                  {EVENT_TYPE_LABELS[t]}
                </span>
              ),
            )}
          </div>
        </div>

        {/* Day panel */}
        <div className="w-72 shrink-0 rounded-xl border border-surface-4 bg-surface-1 p-4">
          {calendarQuery.isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
            </div>
          ) : (
            <DayPanel
              date={selectedDate}
              events={selectedDayEvents}
              branchId={safeBranchId}
              onCreateClick={() => setCreateModalOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Create modal */}
      {createModalOpen ? (
        <CreateEventModal
          defaultDate={selectedDate}
          branchId={safeBranchId}
          orgId={user?.organization_id ?? ""}
          onClose={() => setCreateModalOpen(false)}
        />
      ) : null}
    </WorkspaceShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  return (
    <Suspense>
      <PlanningPageContent />
    </Suspense>
  );
}
