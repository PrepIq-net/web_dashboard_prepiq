"use client";

import { EditPencil } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { formatImpact, impactTone } from "@/lib/format";
import { usePlanningEvent } from "@/services/planning/hooks";
import type { CalendarEventDetail } from "@/services/planning/types";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/services/planning/types";
import { EventModalFrame } from "./event-modals";

/**
 * Read-only drawer with everything known about one event: schedule, branch,
 * demand impact, type-specific details, AI provenance, notes, and audit meta.
 * Opens from the calendar cells and from the day panel cards.
 */

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 first:mt-0">
      <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-brand-gold">
        {eyebrow}
      </p>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[10px] text-text-muted">{label}</span>
      <span className="text-right text-[11px] text-text-primary">{value}</span>
    </div>
  );
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventDetailDrawer({
  eventId,
  onClose,
  onEdit,
  canManageCalendar,
}: {
  eventId: string;
  onClose: () => void;
  onEdit: () => void;
  canManageCalendar: boolean;
}) {
  const { t } = useTranslation();
  const query = usePlanningEvent(eventId);
  const event = query.data;
  const isPending = event?.confirmation_status === "PENDING";

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary"
      >
        {t("planning.detail_close")}
      </button>
      {canManageCalendar ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-all hover:bg-brand-gold-hover active:scale-[0.98]"
        >
          <EditPencil className="h-3.5 w-3.5" />
          {t("planning.edit_event")}
        </button>
      ) : null}
    </>
  );

  const statusKey =
    event?.status === "ACTIVE"
      ? "planning.status_active"
      : event?.status === "CANCELLED"
        ? "planning.status_cancelled"
        : event?.status === "COMPLETED"
          ? "planning.status_completed"
          : event?.status === "DRAFT"
            ? "planning.status_draft"
            : null;

  const start = event ? new Date(event.start_datetime) : null;
  const end = event ? new Date(event.end_datetime) : null;
  const startDate = start
    ? start.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const timeRange =
    start && end
      ? `${start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
      : "";

  const confidence = event?.ai_confidence ?? 0;
  const dots = Math.max(0, Math.min(4, Math.round(confidence * 4)));

  const discountTypeLabel = (raw: string): string => {
    const map: Record<string, string> = {
      PERCENTAGE: t("planning.percentage"),
      FIXED: t("planning.fixed_amount"),
      BOGO: t("planning.buy_one_get_one"),
      FREE_ITEM: t("planning.free_item"),
    };
    return map[raw] ?? raw;
  };

  const channelLabel = (raw: string): string => {
    const map: Record<string, string> = {
      IN_STORE: t("planning.in_store"),
      ONLINE: t("planning.online"),
      SOCIAL_MEDIA: t("planning.social_media"),
      ALL: t("planning.all_channels"),
    };
    return map[raw] ?? raw;
  };

  const reservationTypeLabel = (raw: string): string => {
    const map: Record<string, string> = {
      WEDDING: t("planning.wedding"),
      CORPORATE: t("planning.corporate"),
      BIRTHDAY: t("planning.birthday"),
      PRIVATE_DINING: t("planning.private_dining"),
      CONFERENCE: t("planning.conference"),
      OTHER: t("planning.other"),
    };
    return map[raw] ?? raw;
  };

  return (
    <EventModalFrame
      eyebrow={event ? EVENT_TYPE_LABELS[event.event_type] : ""}
      title={event?.title ?? ""}
      onClose={onClose}
      maxWidthClass="max-w-md"
      footer={footer}
    >
      {query.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
        </div>
      ) : !event ? (
        <p className="py-12 text-center text-sm text-text-muted">
          {t("planning.detail_load_error")}
        </p>
      ) : (
        <>
          {/* Status chips */}
          {(statusKey || isPending) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {statusKey ? (
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${EVENT_TYPE_COLORS[event.event_type]}`}
                >
                  {t(statusKey)}
                </span>
              ) : null}
              {isPending ? (
                <span className="inline-flex rounded-full border border-status-warning/30 bg-status-warning/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-status-warning">
                  {t("planning.ai_pending_badge")}
                </span>
              ) : null}
            </div>
          )}

          {/* When */}
          <Section eyebrow={t("planning.detail_when")}>
            <p className="text-sm font-medium text-text-primary">{startDate}</p>
            {timeRange ? (
              <p className="text-[11px] text-text-secondary">{timeRange}</p>
            ) : null}
          </Section>

          {/* Where */}
          {event.branch_name || event.branch ? (
            <Section eyebrow={t("planning.detail_where")}>
              <p className="text-[11px] text-text-primary">
                {event.branch_name ?? t("planning.all_branches")}
              </p>
            </Section>
          ) : null}

          {/* Impact */}
          <Section eyebrow={t("planning.detail_impact")}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {event.expected_demand_impact != null ? (
                <span
                  className={`text-sm font-semibold ${impactTone(event.expected_demand_impact)}`}
                >
                  {formatImpact(event.expected_demand_impact)}
                </span>
              ) : (
                <span className="text-[11px] text-text-muted">—</span>
              )}
              <span className="text-[10px] text-text-muted">
                {isPending
                  ? t("planning.ai_if_confirmed")
                  : event.is_forecast_signal
                    ? t("planning.detail_counted_forecast")
                    : t("planning.detail_not_counted_forecast")}
              </span>
            </div>
            {isPending ? (
              <p className="text-[10px] text-status-warning">
                {t("planning.ai_pending_hint")}
              </p>
            ) : null}
          </Section>

          {/* Type-specific details */}
          {event.event_type === "PROMOTION" && event.promotion ? (
            <Section eyebrow={t("planning.promotion_details")}>
              <MetaRow
                label={t("planning.promotion_name")}
                value={event.promotion.promotion_name}
              />
              {event.promotion.expected_uplift != null ? (
                <MetaRow
                  label={t("planning.expected_uplift")}
                  value={`${event.promotion.expected_uplift}%`}
                />
              ) : null}
              <MetaRow
                label={t("planning.discount_type")}
                value={`${discountTypeLabel(event.promotion.discount_type)} · ${event.promotion.discount_value}`}
              />
              <MetaRow
                label={t("planning.channel")}
                value={channelLabel(event.promotion.promotion_channel)}
              />
              {event.promotion.expected_attendance != null ? (
                <MetaRow
                  label={t("planning.detail_expected_attendance")}
                  value={event.promotion.expected_attendance.toLocaleString()}
                />
              ) : null}
              <MetaRow
                label={t("planning.detail_recurring")}
                value={
                  event.promotion.is_recurring
                    ? t("planning.detail_yes")
                    : t("planning.detail_no")
                }
              />
              {event.promotion.affected_items &&
              event.promotion.affected_items.length > 0 ? (
                <MetaRow
                  label={t("planning.affected_menu_items")}
                  value={event.promotion.affected_items.join(", ")}
                />
              ) : null}
            </Section>
          ) : null}

          {event.event_type === "RESERVATION" && event.reservation ? (
            <Section eyebrow={t("planning.reservation_details")}>
              <MetaRow
                label={t("planning.guest_count")}
                value={event.reservation.guest_count.toLocaleString()}
              />
              <MetaRow
                label={t("planning.detail_reservation_type")}
                value={reservationTypeLabel(event.reservation.reservation_type)}
              />
              <MetaRow
                label={t("planning.detail_service_period")}
                value={event.reservation.service_period}
              />
              {event.reservation.estimated_spend ? (
                <MetaRow
                  label={t("planning.detail_estimated_spend")}
                  value={event.reservation.estimated_spend}
                />
              ) : null}
              <MetaRow
                label={t("planning.reservation_confirmed")}
                value={
                  event.reservation.confirmed
                    ? t("planning.detail_yes")
                    : t("planning.detail_no")
                }
              />
              {event.reservation.notes ? (
                <MetaRow
                  label={t("planning.detail_notes")}
                  value={event.reservation.notes}
                />
              ) : null}
            </Section>
          ) : null}

          {event.event_type === "CLOSURE" && event.closure ? (
            <Section eyebrow={t("planning.closure_details")}>
              <MetaRow
                label={t("planning.detail_closure_coverage")}
                value={
                  event.closure.full_day
                    ? t("planning.full_day_closure")
                    : t("planning.partial_closure")
                }
              />
              {event.closure.reason ? (
                <MetaRow
                  label={t("planning.reason")}
                  value={event.closure.reason}
                />
              ) : null}
            </Section>
          ) : null}

          {event.event_type === "LOCAL_EVENT" && event.local_event ? (
            <Section eyebrow={EVENT_TYPE_LABELS.LOCAL_EVENT}>
              <MetaRow
                label={t("planning.detail_location")}
                value={event.local_event.location}
              />
              {event.local_event.expected_attendance != null ? (
                <MetaRow
                  label={t("planning.detail_expected_attendance")}
                  value={event.local_event.expected_attendance.toLocaleString()}
                />
              ) : null}
              {event.local_event.distance_from_branch_km != null ? (
                <MetaRow
                  label={t("planning.detail_distance")}
                  value={`${event.local_event.distance_from_branch_km.toLocaleString()} km`}
                />
              ) : null}
              <MetaRow
                label={t("planning.detail_source_confidence")}
                value={`${Math.round(event.local_event.confidence * 100)}%`}
              />
              <MetaRow
                label={t("planning.detail_source")}
                value={event.local_event.source}
              />
            </Section>
          ) : null}

          {event.event_type === "DELIVERY" && event.delivery ? (
            <Section eyebrow={t("planning.delivery_details")}>
              <MetaRow
                label={t("planning.supplier_name")}
                value={event.delivery.supplier_name}
              />
              {event.delivery.delivery_date ? (
                <MetaRow
                  label={t("planning.detail_delivery_date")}
                  value={event.delivery.delivery_date}
                />
              ) : null}
              {event.delivery.expected_cost ? (
                <MetaRow
                  label={t("planning.detail_expected_cost")}
                  value={event.delivery.expected_cost}
                />
              ) : null}
              <MetaRow
                label={t("planning.detail_delivery_status")}
                value={event.delivery.delivery_status}
              />
              {event.delivery.items.length > 0 ? (
                <MetaRow
                  label={t("planning.detail_delivery_items")}
                  value={t("planning.detail_delivery_items_count", {
                    count: event.delivery.items.length,
                  })}
                />
              ) : null}
            </Section>
          ) : null}

          {event.event_type === "OPERATIONAL_NOTE" &&
          event.operational_note ? (
            <Section eyebrow={t("planning.note_details")}>
              <MetaRow
                label={t("planning.detail_note_type")}
                value={event.operational_note.note_type}
              />
              <MetaRow
                label={t("planning.note_content")}
                value={event.operational_note.content}
              />
            </Section>
          ) : null}

          {/* AI provenance */}
          {event.source === "AI_DISCOVERED" ? (
            <Section eyebrow={t("planning.detail_ai_provenance")}>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex rounded-full border border-surface-4 bg-surface-3 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-text-secondary">
                  {t("planning.ai_found_badge")}
                </span>
                <span
                  role="img"
                  className="flex items-center gap-0.5"
                  title={
                    dots === 0
                      ? t("planning.ai_no_track_record")
                      : t("planning.ai_track_record")
                  }
                  aria-label={
                    dots === 0
                      ? t("planning.ai_no_track_record")
                      : t("planning.ai_track_record")
                  }
                >
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1 w-1 rounded-full ${
                        i < dots ? "bg-brand-gold" : "bg-surface-4"
                      }`}
                    />
                  ))}
                </span>
              </div>
              {event.ai_reason ? (
                <p className="text-[11px] leading-relaxed text-text-secondary">
                  {event.ai_reason}
                </p>
              ) : null}
              <p
                className={`text-[10px] ${
                  isPending ? "text-status-warning" : "text-text-muted"
                }`}
              >
                {isPending
                  ? t("planning.ai_pending_hint")
                  : event.confirmation_status === "DISMISSED"
                    ? t("planning.ai_dismissed_hint")
                    : t("planning.ai_confirmed_hint")}
              </p>
              {event.confirmed_at ? (
                <MetaRow
                  label={t("planning.detail_confirmed_at")}
                  value={formatDateTime(event.confirmed_at)}
                />
              ) : null}
            </Section>
          ) : null}

          {event.ai_signal ? (
            <Section eyebrow={t("planning.detail_ai_signal")}>
              <MetaRow
                label={t("planning.detail_predicted_delta")}
                value={formatImpact(event.ai_signal.predicted_demand_delta)}
              />
              <MetaRow
                label={t("planning.detail_source_confidence")}
                value={`${Math.round(event.ai_signal.confidence * 100)}%`}
              />
              {event.ai_signal.reasoning ? (
                <MetaRow
                  label={t("planning.detail_reasoning")}
                  value={event.ai_signal.reasoning}
                />
              ) : null}
              {event.ai_signal.model_version ? (
                <MetaRow
                  label={t("planning.detail_model_version")}
                  value={event.ai_signal.model_version}
                />
              ) : null}
              <MetaRow
                label={t("planning.detail_generated_at")}
                value={formatDateTime(event.ai_signal.generated_at)}
              />
            </Section>
          ) : null}

          {/* Notes */}
          {event.description ? (
            <Section eyebrow={t("planning.detail_notes")}>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                {event.description}
              </p>
            </Section>
          ) : null}

          {/* Audit meta */}
          <Section eyebrow={t("planning.detail_meta")}>
            {event.created_by_name ? (
              <MetaRow
                label={t("planning.detail_created_by")}
                value={event.created_by_name}
              />
            ) : null}
            <MetaRow
              label={t("planning.detail_created_at")}
              value={formatDateTime(event.created_at)}
            />
            {event.updated_at ? (
              <MetaRow
                label={t("planning.detail_updated_at")}
                value={formatDateTime(event.updated_at)}
              />
            ) : null}
          </Section>
        </>
      )}
    </EventModalFrame>
  );
}
