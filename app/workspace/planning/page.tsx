"use client";

import { Suspense, useMemo, useState } from "react";
import { Plus, NavArrowLeft, NavArrowRight, Shop } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { useSelectedBranch } from "@/services/context/branch-store";
import { useBranchOptions } from "@/services/context/use-branch-options";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { useAvailabilityOverrides } from "@/services/inventory/hooks";
import type { ItemAvailabilityOverride } from "@/services/inventory/types";
import { usePlanningCalendar } from "@/services/planning/hooks";
import type { CalendarEventList, EventType } from "@/services/planning/types";
import { EVENT_TYPE_LABELS, EVENT_TYPE_DOT } from "@/services/planning/types";
import { useTranslation } from "@/lib/i18n";
import { EMPTY_LIST, UUID_PATTERN } from "@/lib/constants";
import { formatImpact, impactTone } from "@/lib/format";
import {
  CreateEventModal,
  EditEventModal,
} from "@/components/dashboard/planning/event-modals";
import { DayPanel } from "@/components/dashboard/planning/day-panel";
import {
  addMonths,
  calendarGrid,
  getMonths,
  getWeekdays,
  monthStart,
  toIso,
} from "@/components/dashboard/planning/planning-helpers";

function PlanningPageContent() {
  const { t } = useTranslation();
  const today = toIso(new Date());
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const { user, branchOptions, defaultBranch } = useBranchOptions();

  // Shared branch selection — persists across navigation and reloads.
  const [branchId, setBranchId] = useSelectedBranch({
    branches: branchOptions,
    defaultBranchId: defaultBranch?.id,
  });
  const safeBranchId = UUID_PATTERN.test(branchId) ? branchId : "";
  const { isLoading: subLoading, shouldBlockAccess, gateVariant } =
    useSubscriptionTier(safeBranchId || undefined);

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

  const overridesQuery = useAvailabilityOverrides(
    safeBranchId,
    Boolean(safeBranchId),
  );
  const allOverrides: ItemAvailabilityOverride[] =
    overridesQuery.data ?? EMPTY_LIST;
  const dayOverrides = selectedDate
    ? allOverrides.filter(
        (ov) =>
          ov.is_active &&
          ov.start_date <= selectedDate &&
          (ov.end_date == null || ov.end_date >= selectedDate),
      )
    : [];

  const isCurrentMonth = (d: Date) => d.getMonth() === month.getMonth();
  const viewingCurrentMonth =
    month.getMonth() === new Date().getMonth() &&
    month.getFullYear() === new Date().getFullYear();

  // Month-at-a-glance: events, expected guests, promotions (current month only,
  // overflow days excluded) — answers "how busy is this month?" without clicks.
  const monthSummary = useMemo(() => {
    let events = 0;
    let guests = 0;
    let promotions = 0;
    for (const [iso, dayEvents] of Object.entries(calendarData)) {
      const d = new Date(iso + "T00:00:00");
      if (
        d.getMonth() !== month.getMonth() ||
        d.getFullYear() !== month.getFullYear()
      )
        continue;
      for (const ev of dayEvents) {
        if (ev.status === "CANCELLED") continue;
        events += 1;
        if (ev.event_type === "PROMOTION") promotions += 1;
        const guestCount = (ev as { details?: { guest_count?: number } }).details
          ?.guest_count;
        if (ev.event_type === "RESERVATION" && typeof guestCount === "number") {
          guests += guestCount;
        }
      }
    }
    return { events, guests, promotions };
  }, [calendarData, month]);

  return (
    <WorkspaceShell
      eyebrow={t("planning.shell_eyebrow")}
      title={t("planning.shell_title")}
      description={t("planning.shell_description")}
      insight={t("planning.shell_insight")}
    >
      {/* ── Context bar ── */}
      <div className="mb-6 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-5">
        <div className="flex-1 min-w-[180px] max-w-xs">
          <Select
            label={t("planning.branch_label")}
            leadingIcon={<Shop className="h-4 w-4" />}
            options={branchOptions.map((b) => ({ value: b.id, label: b.name }))}
            value={branchId}
            onChange={setBranchId}
            placeholder={t("planning.all_branches_placeholder")}
          />
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-all hover:bg-brand-gold-hover active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          {t("planning.new_event_button")}
        </button>
      </div>

      {safeBranchId && !subLoading && shouldBlockAccess ? (
        <SubscriptionRequiredState variant={gateVariant} compact />
      ) : (
        <>
          {/* ── Main layout: calendar + day panel ── */}
          <div className="flex gap-6 min-h-[600px]">
            {/* Calendar */}
            <div className="flex-1 min-w-0">
              {/* Month nav */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMonth((m) => addMonths(m, -1))}
                    aria-label={t("planning.previous_month")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-4 text-text-muted hover:text-text-primary transition-colors"
                  >
                    <NavArrowLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonth((m) => addMonths(m, 1))}
                    aria-label={t("planning.next_month")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-4 text-text-muted hover:text-text-primary transition-colors"
                  >
                    <NavArrowRight className="h-4 w-4" />
                  </button>
                  {!viewingCurrentMonth ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMonth(monthStart(new Date()));
                        setSelectedDate(today);
                      }}
                      className="inline-flex h-8 items-center rounded-lg border border-surface-4 px-3 text-xs font-medium text-text-secondary hover:border-brand-gold/50 hover:text-brand-gold transition-colors"
                    >
                      {t("planning.today")}
                    </button>
                  ) : null}
                </div>
                <h2 className="font-display text-lg font-semibold text-text-primary">
                  {getMonths(t)[month.getMonth()]} {month.getFullYear()}
                </h2>
                <div className="w-[104px]" aria-hidden />
              </div>

              {/* Month at a glance */}
              <p className="mb-4 text-center text-[11px] text-text-muted">
                {t("planning.month_events", { count: monthSummary.events })}
                {monthSummary.guests > 0
                  ? ` · ${t("planning.month_guests", { count: monthSummary.guests })}`
                  : ""}
                {monthSummary.promotions > 0
                  ? ` · ${t("planning.month_promos", { count: monthSummary.promotions })}`
                  : ""}
              </p>

              {/* Weekday headers */}
              <div className="mb-1 grid grid-cols-7 text-center">
                {getWeekdays(t).map((d) => (
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

                  // Compact screens: dots. Wide screens: first two event titles.
                  const dotEvents = dayEvents.slice(0, 3);
                  const dotOverflow = dayEvents.length - dotEvents.length;
                  const titleEvents = dayEvents.slice(0, 2);
                  const titleOverflow = dayEvents.length - titleEvents.length;

                  const totalImpact = dayEvents.reduce(
                    (sum, ev) => sum + (ev.expected_demand_impact ?? 0),
                    0,
                  );

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

                      {/* Event dots (compact screens) */}
                      {dayEvents.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-0.5 xl:hidden">
                          {dotEvents.map((ev) => (
                            <span
                              key={ev.id}
                              className={`h-1.5 w-1.5 rounded-full ${EVENT_TYPE_DOT[ev.event_type]}`}
                              title={ev.title}
                            />
                          ))}
                          {dotOverflow > 0 ? (
                            <span className="text-[9px] text-text-muted leading-none">
                              +{dotOverflow}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Event titles (wide screens) */}
                      {dayEvents.length > 0 ? (
                        <div className="mt-1 hidden w-full space-y-0.5 xl:block">
                          {titleEvents.map((ev) => (
                            <span
                              key={ev.id}
                              className="flex min-w-0 items-center gap-1"
                              title={ev.title}
                            >
                              <span
                                className={`h-1 w-1 shrink-0 rounded-full ${EVENT_TYPE_DOT[ev.event_type]}`}
                              />
                              <span
                                className={`truncate text-[9px] leading-tight ${ev.status === "CANCELLED" ? "text-text-muted/50 line-through" : "text-text-secondary"}`}
                              >
                                {ev.title}
                              </span>
                            </span>
                          ))}
                          {titleOverflow > 0 ? (
                            <span className="text-[9px] text-text-muted leading-none">
                              +{titleOverflow}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Demand impact indicator for days with events */}
                      {dayEvents.length > 0 && Math.abs(totalImpact) >= 0.05 ? (
                        <span
                          className={`mt-auto text-[9px] font-semibold ${impactTone(totalImpact)}`}
                        >
                          {formatImpact(totalImpact)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-3">
                {(
                  [
                    "RESERVATION",
                    "PROMOTION",
                    "CLOSURE",
                    "LOCAL_EVENT",
                    "DELIVERY",
                  ] as EventType[]
                ).map((type) => (
                  <span
                    key={type}
                    className="flex items-center gap-1.5 text-[10px] text-text-muted"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${EVENT_TYPE_DOT[type]}`}
                    />
                    {EVENT_TYPE_LABELS[type]}
                  </span>
                ))}
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
                  dayOverrides={dayOverrides}
                  onCreateClick={() => setCreateModalOpen(true)}
                  onEditClick={(id) => setEditingEventId(id)}
                />
              )}
            </div>
          </div>

          {createModalOpen ? (
            <CreateEventModal
              defaultDate={selectedDate}
              branchId={safeBranchId}
              orgId={user?.organization_id ?? ""}
              onClose={() => setCreateModalOpen(false)}
            />
          ) : null}

          {editingEventId ? (
            <EditEventModal
              eventId={editingEventId}
              onClose={() => setEditingEventId(null)}
            />
          ) : null}
        </>
      )}
    </WorkspaceShell>
  );
}

export default function PlanningPage() {
  return (
    <Suspense>
      <PlanningPageContent />
    </Suspense>
  );
}
