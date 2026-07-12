"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Xmark, EditPencil } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { formatImpact, impactTone } from "@/lib/format";
import {
  usePlanningForecastContext,
  useDeletePlanningEvent,
} from "@/services/planning/hooks";
import type { CalendarEventList } from "@/services/planning/types";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/services/planning/types";
import type { ItemAvailabilityOverride } from "@/services/inventory/types";
import { useAssistantConversations } from "@/services/assistant/hooks";
import type { AssistantConversation } from "@/services/assistant/types";
import { ConversationReadonly } from "@/components/assistant/conversation-readonly";
import { QuickMessageButton } from "@/components/hub/quick-message-button";
import { toIso } from "./planning-helpers";

/**
 * Right-hand detail panel for the selected day: forecast impact, auto-detected
 * signals, events (edit/delete), menu availability, and assistant threads.
 */
export function DayPanel({
  date,
  events,
  branchId,
  dayOverrides,
  onCreateClick,
  onEditClick,
}: {
  date: string;
  events: CalendarEventList[];
  branchId: string;
  dayOverrides: ItemAvailabilityOverride[];
  onCreateClick: () => void;
  onEditClick: (eventId: string) => void;
}) {
  const { t } = useTranslation();
  const deleteMutation = useDeletePlanningEvent();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const forecastQuery = usePlanningForecastContext(
    { branch_id: branchId, date },
    !!branchId && !!date,
  );
  const fc = forecastQuery.data;
  const displayDate = new Date(date + "T00:00:00");

  const conversationsQuery = useAssistantConversations(
    branchId ? { branchId, date } : undefined,
  );
  const conversations = conversationsQuery.data ?? [];
  const isToday = date === toIso(new Date());
  const [openConversation, setOpenConversation] =
    useState<AssistantConversation | null>(null);

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
          {t("planning.add")}
        </button>
      </div>

      {/* Forecast context summary */}
      {fc && fc.total_events > 0 ? (
        <div className="mt-4 rounded-xl border border-surface-4 bg-surface-2 p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand-gold mb-2">
            {t("planning.forecast_impact")}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div>
              <span className="text-text-muted">
                {t("planning.composite_impact")}
              </span>
              <span
                className={`ml-1.5 font-semibold ${impactTone(fc.composite_demand_impact)}`}
              >
                {formatImpact(fc.composite_demand_impact)}
              </span>
            </div>
            {fc.reservation_total_guests > 0 ? (
              <div>
                <span className="text-text-muted">{t("planning.reservations")}</span>
                <span className="ml-1.5 font-semibold text-text-primary">
                  {fc.reservation_total_guests} {t("planning.guests")}
                </span>
              </div>
            ) : null}
            {fc.local_event_max_attendance > 0 ? (
              <div>
                <span className="text-text-muted">{t("planning.nearby_crowd")}</span>
                <span className="ml-1.5 font-semibold text-text-primary">
                  {fc.local_event_max_attendance.toLocaleString()}
                </span>
              </div>
            ) : null}
            {fc.has_closure ? (
              <div className="col-span-2">
                <span className="font-semibold text-status-critical">
                  {fc.closure_is_full_day
                    ? t("planning.full_day_closure")
                    : t("planning.partial_closure")}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Auto-detected signals — weather/sports/religious/payday PrepIQ already
          knows about, with the branch's learned response. Shown independently
          of manual calendar events. */}
      {fc?.automatic_signals && fc.automatic_signals.length > 0 ? (
        <div className="mt-3 rounded-xl border border-surface-4 bg-surface-2 p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand-gold mb-0.5">
            {t("planning.auto_detected")}
          </p>
          <p className="mb-2 text-[10px] text-text-muted">
            {t("planning.auto_detected_hint")}
          </p>
          <ul className="space-y-1.5">
            {fc.automatic_signals.map((signal) => {
              const typeKey = `today.signalType.${signal.signal_type}`;
              const typed = t(typeKey);
              const label = typed === typeKey ? signal.label : typed;
              const pct = signal.learned?.delta_pct ?? null;
              return (
                <li
                  key={signal.signal_type}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="min-w-0 truncate text-text-secondary">
                    {label}
                    {signal.name ? (
                      <span className="text-text-muted"> · {signal.name}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {pct != null && Math.abs(pct) >= 1 ? (
                      <span className={`font-semibold ${impactTone(pct / 100)}`}>
                        {formatImpact(pct / 100)}
                      </span>
                    ) : null}
                    {signal.learned && signal.learned.sample_count > 0 ? (
                      <span className="rounded-full bg-brand-gold/15 px-1.5 py-0.5 text-[9px] font-semibold text-brand-gold">
                        {t("planning.learned_label")}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Events list */}
      <div className="mt-4 flex-1 overflow-y-auto space-y-2">
        {events.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-text-muted">
              {t("planning.no_events_on_this_day")}
            </p>
            <button
              type="button"
              onClick={onCreateClick}
              className="mt-3 text-xs text-brand-gold hover:underline"
            >
              {t("planning.add_event_arrow")}
            </button>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 transition-colors hover:border-surface-4/80"
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
                    {event.status === "CANCELLED" ? (
                      <span className="text-[9px] font-semibold text-text-muted line-through">
                        {t("planning.cancelled")}
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
                    {event.branch_name
                      ? ` · ${event.branch_name}`
                      : ` · ${t("planning.all_branches")}`}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <QuickMessageButton
                    refType="CALENDAR_EVENT"
                    objectId={event.id}
                    title={event.title}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-text-muted hover:text-brand-gold hover:bg-brand-gold/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => onEditClick(event.id)}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-text-muted hover:text-brand-gold hover:bg-brand-gold/10 transition-all"
                    title={t("planning.edit_event")}
                  >
                    <EditPencil className="h-3 w-3" />
                  </button>
                  {confirmDeleteId === event.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          deleteMutation.mutate(event.id);
                          setConfirmDeleteId(null);
                        }}
                        disabled={deleteMutation.isPending}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-status-critical hover:bg-status-critical/10 transition-colors disabled:opacity-30"
                      >
                        {t("planning.delete")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded px-1 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors"
                      >
                        {t("planning.no")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(event.id)}
                      className="h-6 w-6 flex items-center justify-center rounded-md text-text-muted hover:text-status-critical hover:bg-status-critical/10 transition-all"
                      title={t("planning.delete_event")}
                    >
                      <Xmark className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Menu Availability strip */}
      <div className="mt-4 border-t border-surface-4/60 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("planning.menu_availability")}
          </p>
          {branchId && (
            <Link
              href={`/workspace/inventory?tab=ingredients&branch=${branchId}`}
              className="text-[10px] text-text-muted transition-colors hover:text-brand-gold"
            >
              {t("planning.manage_link")}
            </Link>
          )}
        </div>

        {dayOverrides.length === 0 ? (
          <p className="text-[11px] text-text-muted">
            {t("planning.no_unavailable_items")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {dayOverrides.map((ov) => (
              <div key={ov.id} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 inline-flex h-4 shrink-0 items-center rounded-sm border px-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${
                    ov.suppressed_demand
                      ? "border-brand-gold/30 bg-brand-gold/10 text-brand-gold"
                      : "border-status-warning/30 bg-status-warning/10 text-status-warning"
                  }`}
                >
                  {ov.suppressed_demand
                    ? t("planning.off_menu")
                    : t("planning.supply")}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-text-primary truncate">
                    {ov.item_title ?? ov.item_id}
                  </p>
                  {ov.reason && (
                    <p className="text-[10px] text-text-muted truncate">{ov.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assistant conversations for this day. Today's thread is still live, so
          it's not shown read-only here — we point to the Today page where it can
          be continued. Past days open as read-only transcripts. */}
      {isToday && conversations.length > 0 ? (
        <div className="mt-4 border-t border-surface-4/60 pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("planning.conversations")}
          </p>
          <Link
            href={`/workspace/today?assistant=open${branchId ? `&branch_id=${branchId}` : ""}`}
            className="flex items-start gap-2 rounded-lg border border-surface-4 bg-surface-2 px-2.5 py-2 transition-colors hover:border-brand-gold/50"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[9px] font-bold text-brand-gold">
              IQ
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-text-secondary">
                {t("planning.conversation_live")}
              </span>
              <span className="mt-0.5 block text-[10px] font-medium text-brand-gold">
                {t("planning.conversation_continue")}
              </span>
            </span>
          </Link>
        </div>
      ) : !isToday && conversations.length > 0 ? (
        <div className="mt-4 border-t border-surface-4/60 pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("planning.conversations")}
          </p>
          <div className="space-y-1.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setOpenConversation(conv)}
                className="flex w-full items-start gap-2 rounded-lg border border-surface-4 bg-surface-2 px-2.5 py-2 text-left transition-colors hover:border-brand-gold/50"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[9px] font-bold text-brand-gold">
                  IQ
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] text-text-secondary">
                    {conv.last_message || t("planning.conversation_empty")}
                  </span>
                  <span className="block text-[9px] uppercase tracking-[0.1em] text-text-muted">
                    {new Date(conv.updated_at).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ConversationReadonly
        conversation={openConversation}
        onClose={() => setOpenConversation(null)}
      />
    </div>
  );
}
