"use client";

import { Suspense, useMemo, useState } from "react";
import { Plus, NavArrowLeft, NavArrowRight, Xmark, Shop } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
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

function CreateEventModal({
  defaultDate,
  branchId,
  onClose,
}: {
  defaultDate: string;
  branchId: string;
  onClose: () => void;
}) {
  const createMutation = useCreatePlanningEvent();
  const [form, setForm] = useState<{
    title: string;
    event_type: EventType;
    start_date: string;
    start_time: string;
    end_time: string;
    description: string;
    expected_demand_impact: string;
    all_branches: boolean;
  }>({
    title: "",
    event_type: DEFAULT_EVENT_TYPE,
    start_date: defaultDate,
    start_time: "09:00",
    end_time: "17:00",
    description: "",
    expected_demand_impact: "",
    all_branches: false,
  });
  const [error, setError] = useState("");

  const set = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setError("");

    const startDt = `${form.start_date}T${form.start_time}:00`;
    const endDt = `${form.start_date}T${form.end_time}:00`;

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

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {error ? (
            <p className="rounded-lg border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-xs text-status-critical">
              {error}
            </p>
          ) : null}

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Wedding Reception — 80 guests"
              className="w-full rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-brand-gold/50 focus:outline-none"
            />
          </div>

          {/* Event type */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Type
            </label>
            <select
              value={form.event_type}
              onChange={(e) => set("event_type", e.target.value)}
              className="w-full rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 text-sm text-text-primary focus:border-brand-gold/50 focus:outline-none"
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
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Date
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                className="w-full rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 text-sm text-text-primary focus:border-brand-gold/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Start
              </label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => set("start_time", e.target.value)}
                className="w-full rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 text-sm text-text-primary focus:border-brand-gold/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                End
              </label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => set("end_time", e.target.value)}
                className="w-full rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 text-sm text-text-primary focus:border-brand-gold/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Demand impact */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Expected demand impact (%)
            </label>
            <input
              type="number"
              step="1"
              value={form.expected_demand_impact}
              onChange={(e) => set("expected_demand_impact", e.target.value)}
              placeholder="e.g. 25 for +25%, −40 for −40%"
              className="w-full rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-brand-gold/50 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Any context the forecast engine should know..."
              className="w-full resize-none rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-brand-gold/50 focus:outline-none"
            />
          </div>

          {/* All branches toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.all_branches}
                onChange={(e) => set("all_branches", e.target.checked)}
                className="sr-only"
              />
              <div
                className={`h-5 w-9 rounded-full transition-colors ${
                  form.all_branches ? "bg-brand-gold" : "bg-surface-4"
                }`}
              />
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  form.all_branches ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sm text-text-secondary">
              Apply to all branches
            </span>
          </label>
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
